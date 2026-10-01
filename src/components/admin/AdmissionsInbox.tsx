import React from "react";
import { 
  Check, X, Shield, Clock, FileSpreadsheet, Search, ArrowUpDown, 
  ChevronLeft, ChevronRight, Copy, AlertTriangle, AlertCircle, XCircle, Trash2,
  Download, Image as ImageIcon, ZoomIn, CheckSquare, Eye, FileText, ExternalLink, User, Mail, Phone, MapPin, Award, Tent, Calendar
} from "lucide-react";
import { PlatoonApplication, Member, BNCCRank, MemberStatus } from "../../types";
import { updateDocument, createDocument, deleteDocument, softDeleteRecord, generateId } from "../../firebaseService";
import { auth } from "../../firebase";

interface AdmissionsInboxProps {
  applications: PlatoonApplication[];
  onRefresh: () => void;
}

interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export default function AdmissionsInbox({ applications, onRefresh }: AdmissionsInboxProps) {
  const [localApplications, setLocalApplications] = React.useState<PlatoonApplication[]>(applications);

  React.useEffect(() => {
    setLocalApplications(applications);
  }, [applications]);

  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [showApproveModal, setShowApproveModal] = React.useState(false);
  const [approvingApp, setApprovingApp] = React.useState<PlatoonApplication | null>(null);
  const [cadetIdInput, setCadetIdInput] = React.useState("");
  const [previewImage, setPreviewImage] = React.useState<{ url: string; name: string } | null>(null);
  const [detailedApp, setDetailedApp] = React.useState<PlatoonApplication | null>(null);

  // Filters, search, pagination, sorting, selections
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("Pending");
  const [typeFilter, setTypeFilter] = React.useState("All");
  const [sortBy, setSortBy] = React.useState<"submittedAt" | "fullName">("submittedAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(6);

  // Toasts & Confirmation dialog
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleProcess = async (appId: string, status: "Approved" | "Rejected", approvedCadetId?: string) => {
    setProcessingId(appId);
    try {
      const app = localApplications.find((a) => a.id === appId);

      if (status === "Approved" && app) {
        if (!approvedCadetId || !approvedCadetId.trim()) {
          throw new Error("A valid Cadet ID is required for approval.");
        }
        const memberId = approvedCadetId.trim().toUpperCase();

        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("../../firebase");

        // 1. Prevent duplicate IDs
        const idQuery = query(collection(db, "cadets"), where("id", "==", memberId));
        const idSnap = await getDocs(idQuery);
        if (!idSnap.empty) {
          throw new Error(`A cadet profile with Cadet ID "${memberId}" is already registered in the platoon roster.`);
        }

        // 2. Prevent duplicate emails
        const emailClean = app.email.toLowerCase().trim();
        if (emailClean) {
          const emailQuery = query(collection(db, "cadets"), where("email", "==", emailClean));
          const emailSnap = await getDocs(emailQuery);
          if (!emailSnap.empty) {
            throw new Error(`A cadet profile with email address "${emailClean}" is already registered in the official roster under Cadet ID "${emailSnap.docs[0].id}".`);
          }
        }

        // 3. Prevent duplicate phone contact numbers
        const phoneClean = app.phone.trim();
        if (phoneClean) {
          const phoneQuery = query(collection(db, "cadets"), where("phone", "==", phoneClean));
          const phoneSnap = await getDocs(phoneQuery);
          if (!phoneSnap.empty) {
            throw new Error(`A cadet profile with phone contact number "${phoneClean}" is already registered in the official roster under Cadet ID "${phoneSnap.docs[0].id}".`);
          }
        }

        // Determine correct rank
        let rank: BNCCRank = BNCCRank.CADET;
        if (app.type === "Recruit") {
          rank = BNCCRank.RECRUIT;
        } else if (app.highestRank) {
          rank = app.highestRank;
        }

        // Determine correct member status
        const memberStatus = app.type === "Alumni" ? MemberStatus.ALUMNI : MemberStatus.ACTIVE_CADET;

        const newMember: Member = {
          id: memberId,
          userId: null,
          fullName: app.fullName,
          photoUrl: app.photoUrl || "",
          rank: rank,
          department: app.department,
          session: app.session,
          joiningYear: Number(app.joiningYear || new Date().getFullYear()),
          graduationYear: app.graduationYear ? Number(app.graduationYear) : null,
          bloodGroup: app.bloodGroup || "O+",
          phone: app.phone,
          email: app.email.toLowerCase().trim(),
          biography: app.pastAchievements || "No biography provided.",
          status: memberStatus,
          verified: true,
          address: app.address || "",
          currentProfession: app.currentProfession || "",
          currentOrganization: app.currentOrganization || "",
          currentCity: app.currentCity || "",
          cadetIdImage: ""
        };

        // Create the cadet document
        await createDocument("cadets", newMember, memberId);

        // SYNC CAMPS & ACHIEVEMENTS INTO FIRESTORE COLLECTIONS
        if (app.campsParticipation && Array.isArray(app.campsParticipation)) {
          for (const cp of app.campsParticipation) {
            const cpId = generateId("cp");
            await createDocument("campParticipants", {
              id: cpId,
              campId: cp.campId,
              memberId: memberId,
              role: cp.role || "Participant",
              awards: cp.achievements || "",
              remarks: "Registered during platoon admission application"
            }, cpId);

            if (cp.achievements && cp.achievements.trim()) {
              const achId = generateId("ach");
              const recipientName = `${newMember.rank || 'Cadet'} ${newMember.fullName}`.trim();
              await createDocument("achievements", {
                id: achId,
                memberId: memberId,
                recipientId: memberId,
                cadetId: memberId,
                recipient: recipientName,
                title: cp.achievements.trim(),
                description: `Earned award "${cp.achievements.trim()}" at ${cp.campName || "Battalion Camp"} as ${cp.role || "Participant"}.`,
                date: new Date().toISOString().split("T")[0],
                category: "Camp Honor",
                issuedBy: cp.campName || "3 Ramna Battalion Command",
                campName: cp.campName || "Battalion Camp"
              }, achId);
            }
          }
        }

        if (app.pastAchievements && app.pastAchievements.trim()) {
          const achId = generateId("ach");
          const recipientName = `${newMember.rank || 'Cadet'} ${newMember.fullName}`.trim();
          await createDocument("achievements", {
            id: achId,
            memberId: memberId,
            recipientId: memberId,
            cadetId: memberId,
            recipient: recipientName,
            title: app.pastAchievements.trim(),
            description: "Historical achievement submitted during platoon application.",
            date: app.joiningYear ? `${app.joiningYear}-01-01` : new Date().toISOString().split("T")[0],
            category: "Past Honor",
            issuedBy: "UGC Platoon Command"
          }, achId);
        }
      }

      await updateDocument("applications", appId, { status });
      setLocalApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a))
      );
      showToast(`Application successfully ${status}!`, "success");
      setSelectedIds((prev) => prev.filter((id) => id !== appId));
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (appId: string, name: string) => {
    setConfirmDialog({
      title: "Reject Cadet Application",
      message: `Are you sure you want to reject the platoon admission application for "${name}"?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        await handleProcess(appId, "Rejected");
      }
    });
  };

  const handleDuplicate = async (app: PlatoonApplication) => {
    try {
      const id = generateId("app");
      const duplicatedData = {
        ...app,
        id,
        fullName: `${app.fullName} (Copy)`,
        submittedAt: new Date().toISOString(),
      };
      await createDocument("applications", duplicatedData, id);
      showToast(`Duplicated admission file for "${app.fullName}"`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleBulkReject = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Reject Applications",
      message: `Warning: You are about to reject all ${selectedIds.length} selected applications. Proceed?`,
      onConfirm: async () => {
        try {
          let count = 0;
          for (const id of selectedIds) {
            await updateDocument("applications", id, { status: "Rejected" });
            count++;
          }
          setLocalApplications((prev) =>
            prev.map((a) => (selectedIds.includes(a.id) ? { ...a, status: "Rejected" } : a))
          );
          showToast(`Successfully rejected ${count} applications`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleDelete = (appId: string, name: string) => {
    const appToDel = localApplications.find((a) => a.id === appId);
    setConfirmDialog({
      title: "Delete Application Record",
      message: `Are you sure you want to delete the admission record for "${name}" from the database? It will be moved to the Recycle Bin.`,
      confirmLabel: "DELETE RECORD",
      onConfirm: async () => {
        try {
          if (appToDel) {
            await softDeleteRecord(
              "applications",
              appId,
              `Application: ${name}`,
              appToDel,
              auth.currentUser?.email || "admin@ugcbncc.org",
              auth.currentUser?.uid || "admin"
            );
          } else {
            await deleteDocument("applications", appId);
          }
          setLocalApplications((prev) => prev.filter((a) => a.id !== appId));
          setSelectedIds((prev) => prev.filter((id) => id !== appId));
          showToast(`Application record for "${name}" deleted successfully.`, "success");
          onRefresh();
        } catch (err: any) {
          showToast(err.message || "Failed to delete application.", "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Delete Applications",
      message: `Warning: You are about to delete ${selectedIds.length} application(s) from the database. They will be moved to the Recycle Bin. Proceed?`,
      confirmLabel: `DELETE ${selectedIds.length} APPLICATIONS`,
      onConfirm: async () => {
        try {
          let count = 0;
          for (const id of selectedIds) {
            const app = localApplications.find((a) => a.id === id);
            if (app) {
              await softDeleteRecord(
                "applications",
                id,
                `Application: ${app.fullName}`,
                app,
                auth.currentUser?.email || "admin@ugcbncc.org",
                auth.currentUser?.uid || "admin"
              );
            } else {
              await deleteDocument("applications", id);
            }
            count++;
          }
          setLocalApplications((prev) => prev.filter((a) => !selectedIds.includes(a.id)));
          showToast(`Successfully deleted ${count} application(s).`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(err.message || "Failed to delete selected applications.", "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const exportApplicationsToCSV = (listToExport: PlatoonApplication[], label: string) => {
    if (listToExport.length === 0) {
      showToast(`No applications found to export.`, "info");
      return;
    }

    const headers = [
      "Application ID",
      "Full Name",
      "Email Address",
      "Phone Number",
      "Applicant Type",
      "Department / HSC Group",
      "Session / Academic Year",
      "Joining Year",
      "Graduation Year",
      "Assigned Cadet ID",
      "Highest Rank",
      "Current Profession",
      "Current Organization",
      "Current City",
      "Blood Group",
      "Address",
      "Achievements History",
      "Camp History Summary",
      "Registered Camps Count",
      "Registered Camps Details",
      "Submission Timestamp",
      "Application Status",
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return "";
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(","),
      ...listToExport.map((app) => {
        const campDetails = app.campsParticipation && app.campsParticipation.length > 0
          ? app.campsParticipation.map((c) => `${c.campName} (${c.role}${c.achievements ? ` - Award: ${c.achievements}` : ""})`).join("; ")
          : "";

        return [
          app.id,
          app.fullName,
          app.email,
          app.phone,
          app.type,
          app.department,
          app.session,
          app.joiningYear,
          app.graduationYear || "",
          app.cadetId || "",
          app.highestRank || "",
          app.currentProfession || "",
          app.currentOrganization || "",
          app.currentCity || "",
          app.bloodGroup || "",
          app.address || "",
          app.pastAchievements || "",
          app.campHistory || "",
          app.campsParticipation ? app.campsParticipation.length : 0,
          campDetails,
          new Date(app.submittedAt).toISOString(),
          app.status,
        ]
          .map(escapeCSV)
          .join(",");
      }),
    ];

    const csvContent = "\uFEFF" + csvRows.join("\n"); // UTF-8 BOM for flawless Excel rendering
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `UGC_BNCC_Applications_${label}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Successfully exported ${listToExport.length} application(s) data to CSV/Excel`, "success");
  };

  const exportToExcel = (filter: "All" | "Pending" | "Approved" | "Rejected") => {
    const listToExport = filter === "All"
      ? localApplications
      : localApplications.filter((a) => a.status === filter);
    exportApplicationsToCSV(listToExport, filter);
  };

  const exportSelectedApplications = () => {
    if (selectedIds.length === 0) {
      showToast("Please select at least one application to export.", "info");
      return;
    }
    const listToExport = localApplications.filter((a) => selectedIds.includes(a.id));
    exportApplicationsToCSV(listToExport, `Selected_${listToExport.length}`);
  };

  const downloadApplicantImage = async (photoUrl: string, applicantName: string) => {
    if (!photoUrl) {
      showToast("No photo available for this applicant.", "info");
      return;
    }
    try {
      showToast("Preparing image download...", "info");
      const res = await fetch(photoUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanName = applicantName.replace(/[^a-zA-Z0-9_-]/g, "_");
      const extension = blob.type.includes("png") ? "png" : "jpg";
      link.download = `Applicant_${cleanName}_photo.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("Photo downloaded successfully.", "success");
    } catch (e) {
      // Fallback: direct window download or open in tab
      const link = document.createElement("a");
      link.href = photoUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.download = `Applicant_${applicantName.replace(/[^a-zA-Z0-9_-]/g, "_")}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const exportSelectedImages = async () => {
    const appsWithPhotos = localApplications.filter(
      (a) => selectedIds.includes(a.id) && a.photoUrl && !a.photoUrl.includes("unsplash")
    );
    if (appsWithPhotos.length === 0) {
      showToast("No uploaded photos found among selected applications.", "info");
      return;
    }
    showToast(`Downloading ${appsWithPhotos.length} applicant photo(s)...`, "info");
    for (let i = 0; i < appsWithPhotos.length; i++) {
      const app = appsWithPhotos[i];
      await new Promise((r) => setTimeout(r, 300)); // slight pause between downloads
      downloadApplicantImage(app.photoUrl!, app.fullName);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Filter & Search
  const filteredApps = localApplications.filter((app) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = 
      app.fullName.toLowerCase().includes(s) ||
      app.email.toLowerCase().includes(s) ||
      app.phone.toLowerCase().includes(s) ||
      app.session.toLowerCase().includes(s) ||
      app.department.toLowerCase().includes(s) ||
      app.id.toLowerCase().includes(s);

    if (!matchesSearch) return false;

    if (statusFilter !== "All" && app.status !== statusFilter) {
      return false;
    }

    if (typeFilter !== "All" && app.type !== typeFilter) {
      return false;
    }

    return true;
  });

  // Sort
  const sortedApps = [...filteredApps].sort((a, b) => {
    let comp = 0;
    if (sortBy === "fullName") {
      comp = a.fullName.localeCompare(b.fullName);
    } else {
      const dateA = a.submittedAt || "";
      const dateB = b.submittedAt || "";
      comp = dateA.localeCompare(dateB);
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Pagination Math
  const totalItems = sortedApps.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedApps = sortedApps.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

  const handleToggleSelectAll = () => {
    const pageIds = paginatedApps.map((item) => item.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const pendingAppsCount = localApplications.filter((a) => a.status === "Pending").length;

  return (
    <div id="admissions-inbox-panel" className="space-y-6 text-xs relative">
      {/* Toast Alert elements */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-white font-mono text-[11px] animate-slide-in-right ${
              toast.type === "success" 
                ? "bg-emerald-600 border border-emerald-500" 
                : toast.type === "error" 
                ? "bg-rose-600 border border-rose-500" 
                : "bg-slate-800 border border-slate-700"
            }`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} 
              className="text-white/60 hover:text-white cursor-pointer ml-2"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Overlay */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-bold font-mono uppercase tracking-wider">{confirmDialog.title}</h4>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2.5 pt-2 font-mono">
              <button
                onClick={() => setConfirmDialog(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-3.5 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                {confirmDialog.confirmLabel || "CONFIRM"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center space-x-2">
            <Shield className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span>Portal Admissions Inbox ({pendingAppsCount} Pending Requests)</span>
          </h3>
          <p className="text-slate-400 text-[10px] font-sans mt-1 uppercase font-mono">
            Review, approve, or reject digital enlistment dossiers submitted by prospective recruits or registering alumni.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleBulkDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center space-x-1.5 cursor-pointer transition-colors shadow-sm"
                title="Delete selected applications and move to Recycle Bin"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete ({selectedIds.length})</span>
              </button>

              <button
                onClick={exportSelectedApplications}
                className="bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center space-x-1.5 cursor-pointer transition-colors shadow-sm"
                title="Export only selected applications data to Excel/CSV"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>Export Selected Data ({selectedIds.length})</span>
              </button>

              {localApplications.some((a) => selectedIds.includes(a.id) && a.status === "Pending") && (
                <button
                  onClick={handleBulkReject}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-mono font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Bulk Reject</span>
                </button>
              )}
            </>
          )}

          {/* Export Menu Dropdown / Buttons */}
          <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-850 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="font-mono text-slate-400 text-[9px] uppercase pl-1.5 flex items-center space-x-1">
              <Download className="h-3 w-3" />
              <span>Export:</span>
            </span>
            <button
              onClick={() => exportToExcel("All")}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold uppercase rounded text-[9px] cursor-pointer transition-colors"
              title="Export all applications to Excel/CSV"
            >
              All
            </button>
            <button
              onClick={() => exportToExcel("Approved")}
              className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white font-mono font-bold uppercase rounded text-[9px] cursor-pointer transition-colors"
              title="Export approved/enlisted applications to Excel/CSV"
            >
              Approved
            </button>
            <button
              onClick={() => exportToExcel("Pending")}
              className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold uppercase rounded text-[9px] cursor-pointer transition-colors"
              title="Export pending applications to Excel/CSV"
            >
              Pending
            </button>
            <button
              onClick={() => exportToExcel("Rejected")}
              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-mono font-bold uppercase rounded text-[9px] cursor-pointer transition-colors"
              title="Export rejected applications to Excel/CSV"
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search applications by name, email, phone, session, group, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filtering */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center space-x-1">
              <span className="font-mono text-slate-400 text-[9px] uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 p-1 rounded font-mono text-[10px]"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div className="flex items-center space-x-1">
              <span className="font-mono text-slate-400 text-[9px] uppercase">Applicant:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 p-1 rounded font-mono text-[10px]"
              >
                <option value="All">All Types</option>
                <option value="Recruit">Recruit</option>
                <option value="Cadet">Cadet</option>
                <option value="Alumni">Alumni</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-850 pt-3">
          {/* Sorting */}
          <div className="flex items-center space-x-2">
            <span className="font-mono text-slate-400 uppercase text-[9px]">Sort by:</span>
            <button
              onClick={() => {
                if (sortBy === "submittedAt") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("submittedAt");
                  setSortOrder("desc");
                }
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                sortBy === "submittedAt" 
                  ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <span>Submission Date</span>
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (sortBy === "fullName") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("fullName");
                  setSortOrder("asc");
                }
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                sortBy === "fullName" 
                  ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <span>Applicant Name</span>
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-400 uppercase">
            Discovered {sortedApps.length} entries of {localApplications.length} total
          </div>
        </div>
      </div>

      {/* Select All Bar */}
      {paginatedApps.length > 0 && (
        <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-[10px]">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={paginatedApps.every((item) => selectedIds.includes(item.id))}
              onChange={handleToggleSelectAll}
              className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-slate-600 dark:text-slate-300 font-bold">SELECT ALL ON THIS PAGE</span>
          </label>
          <span className="text-slate-400">PAGE {currentPage} OF {totalPages}</span>
        </div>
      )}

      {/* Grid rendering */}
      {processingId ? (
        <div className="flex items-center justify-center py-20 bg-white dark:bg-slate-900 border border-slate-200 rounded-xl">
          <div className="text-center font-mono space-y-2 text-slate-400 animate-pulse">
            <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
            <span>TRANSMITTING ENLISTMENT LEDGERS TO SERVERS... PLEASE WAIT</span>
          </div>
        </div>
      ) : paginatedApps.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 font-mono text-xs shadow-sm">
          NO APPLICATIONS DISCOVERED WITH THIS COMBINATION IN THE ADMISSIONS LEDGER.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {paginatedApps.map((app) => {
            const isSelected = selectedIds.includes(app.id);
            return (
              <div
                key={app.id}
                className={`bg-white dark:bg-slate-900 rounded-xl border p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all hover:shadow-md ${
                  isSelected 
                    ? "border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/5 dark:bg-amber-950/5" 
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(app.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      {app.photoUrl && !app.photoUrl.includes("unsplash") ? (
                        <div 
                          className="relative group cursor-pointer shrink-0"
                          onClick={() => setPreviewImage({ url: app.photoUrl!, name: app.fullName })}
                          title="Click to view full applicant photo"
                        >
                          <img
                            src={app.photoUrl}
                            alt={app.fullName}
                            className="w-11 h-11 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 group-hover:border-amber-500 transition-all shadow-sm"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <ZoomIn className="h-4 w-4" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-army-900 border border-amber-500/40 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {app.fullName ? app.fullName.charAt(0) : "C"}
                        </div>
                      )}
                      <div 
                        className="cursor-pointer group/title"
                        onClick={() => setDetailedApp(app)}
                        title="Click to view complete dossier"
                      >
                        <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm leading-tight group-hover/title:text-amber-500 transition-colors flex items-center space-x-1">
                          <span>{app.fullName}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover/title:opacity-100 text-amber-500 transition-opacity" />
                        </h4>
                        <span className="inline-block bg-amber-500/10 text-amber-500 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">
                          {app.type}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-slate-400 flex items-center space-x-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      <span>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : "N/A"}</span>
                    </div>
                  </div>

                  {/* Clickable Card Body for Detailed Information */}
                  <div 
                    onClick={() => setDetailedApp(app)}
                    className="cursor-pointer group/card space-y-3"
                    title="Click to view full application dossier details"
                  >
                    {/* Grid details */}
                    <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50 dark:bg-slate-850 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group-hover/card:border-amber-500/40 transition-colors">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-mono">Email</span>
                        <span className="text-slate-700 dark:text-slate-200 break-all">{app.email}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-mono">Phone</span>
                        <span className="text-slate-700 dark:text-slate-200">{app.phone}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-mono">HSC Group</span>
                        <span className="text-slate-700 dark:text-slate-200">{app.department}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-mono">Session / Year</span>
                        <span className="text-slate-700 dark:text-slate-200">{app.session}</span>
                      </div>
                      {app.bloodGroup && (
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-mono">Blood Group</span>
                          <span className="text-slate-700 dark:text-slate-200 font-bold">{app.bloodGroup}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-mono">Status</span>
                        <span className={`font-mono text-[10px] font-bold uppercase ${
                          app.status === "Pending" 
                            ? "text-amber-500" 
                            : app.status === "Approved" 
                            ? "text-emerald-500" 
                            : "text-rose-500"
                        }`}>{app.status}</span>
                      </div>
                      {app.address && (
                        <div className="col-span-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-800/80">
                          <span className="text-slate-400 block text-[9px] uppercase font-mono">Present Address (Confidential)</span>
                          <span className="text-slate-700 dark:text-slate-200 font-sans line-clamp-1 text-[11px]" title={app.address}>{app.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Achievements history */}
                    {app.pastAchievements && (
                      <div className="text-[11px] bg-amber-500/5 border border-amber-500/10 p-2.5 rounded text-slate-600 dark:text-slate-300">
                        <strong className="text-[9px] uppercase font-mono text-amber-500 block">Achievements History:</strong>
                        <p className="mt-0.5 line-clamp-2">{app.pastAchievements}</p>
                      </div>
                    )}

                    {/* Registered Camp Participations */}
                    {app.campsParticipation && app.campsParticipation.length > 0 && (
                      <div className="text-[11px] bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded text-slate-600 dark:text-slate-300 space-y-1">
                        <strong className="text-[9px] uppercase font-mono text-emerald-500 block">Registered Camp Participations ({app.campsParticipation.length}):</strong>
                        <ul className="space-y-1">
                          {app.campsParticipation.slice(0, 2).map((cp, idx) => (
                            <li key={idx} className="text-[10px] font-mono leading-tight truncate">
                              • <span className="font-bold text-slate-800 dark:text-slate-200">{cp.campName}</span> ({cp.role})
                            </li>
                          ))}
                          {app.campsParticipation.length > 2 && (
                            <li className="text-[9px] font-mono text-emerald-500 font-bold">
                              + {app.campsParticipation.length - 2} more camps (click to view all)
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="text-[9.5px] font-mono text-amber-500/80 group-hover/card:text-amber-500 flex items-center justify-end space-x-1 pt-0.5">
                      <Eye className="h-3 w-3" />
                      <span>Click card to view complete dossier ➔</span>
                    </div>
                  </div>
                </div>

                {/* Individual Action buttons */}
                <div className="flex space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setDetailedApp(app)}
                    className="p-2 bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-500 border border-amber-500/30 rounded transition-colors cursor-pointer"
                    title="View Full Detailed Dossier"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(app)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 rounded transition-colors cursor-pointer"
                    title="Duplicate application"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {app.photoUrl && !app.photoUrl.includes("unsplash") && (
                    <button
                      onClick={() => downloadApplicantImage(app.photoUrl!, app.fullName)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-colors cursor-pointer"
                      title="Download applicant photo"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(app.id, app.fullName)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-colors cursor-pointer"
                    title="Delete application record from database"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {app.status === "Pending" && (
                    <>
                      <button
                        onClick={() => {
                          setApprovingApp(app);
                          setCadetIdInput(app.cadetId || "");
                          setShowApproveModal(true);
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold uppercase py-1.5 rounded text-[10px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Check className="h-4 w-4" />
                        <span>APPROVE</span>
                      </button>
                      <button
                        onClick={() => handleReject(app.id, app.fullName)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-mono font-bold uppercase py-1.5 rounded text-[10px] flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <X className="h-4 w-4" />
                        <span>REJECT</span>
                      </button>
                    </>
                  )}
                  {app.status === "Rejected" && (
                    <button
                      onClick={() => handleDelete(app.id, app.fullName)}
                      className="flex-1 bg-rose-600/90 hover:bg-rose-700 text-white font-mono font-bold uppercase py-1.5 rounded text-[10px] flex items-center justify-center space-x-1.5 cursor-pointer transition-colors shadow-sm"
                      title="Permanently remove rejected application from database"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>DELETE REJECTED RECORD</span>
                    </button>
                  )}
                  {app.status === "Approved" && (
                    <div className="flex-1 flex items-center justify-between pl-1">
                      <span className="text-[10px] font-mono text-emerald-500 font-bold flex items-center space-x-1">
                        <Check className="h-3.5 w-3.5" />
                        <span>ENLISTED</span>
                      </span>
                      <button
                        onClick={() => handleDelete(app.id, app.fullName)}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-400 font-mono text-[9px] rounded border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center space-x-1 transition-colors"
                        title="Delete archived application file"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>DELETE</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
          <span className="text-[10px] font-mono text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center space-x-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal with Cadet ID entry */}
      {showApproveModal && approvingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider text-amber-500">
                Confirm Platoon Admission Enlistment
              </h3>
              <p className="text-slate-400 text-[10px] font-sans mt-1">
                Assign or verify the official Cadet ID for this member. This will generate their official profile row instantly.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">
                  Applicant Name
                </label>
                <div className="text-slate-900 dark:text-white font-sans font-medium text-xs bg-slate-50 dark:bg-slate-850 px-3 py-2 rounded border border-slate-100 dark:border-slate-800">
                  {approvingApp.fullName}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">
                    Enlistment Category
                  </label>
                  <span className="inline-block bg-amber-500/10 text-amber-500 font-mono text-[9px] px-1.5 py-1 rounded uppercase font-bold">
                    {approvingApp.type}
                  </span>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">
                    Academic Session
                  </label>
                  <div className="text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                    {approvingApp.session}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase font-mono text-slate-400 mb-1">
                  Assign Cadet ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., UGC-2023-105"
                  value={cadetIdInput}
                  onChange={(e) => setCadetIdInput(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none uppercase font-mono text-xs focus:border-amber-500"
                />
                <p className="text-slate-400 text-[9px] mt-1 font-mono">
                  Format: UGC-YYYY-XXX (e.g. UGC-2018-001)
                </p>
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setApprovingApp(null);
                  setCadetIdInput("");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-bold uppercase py-2 rounded text-[10px] cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cleanedId = cadetIdInput.trim().toUpperCase();
                  if (!cleanedId) {
                    showToast("A valid Cadet ID is strictly required to approve admissions.", "error");
                    return;
                  }
                  setShowApproveModal(false);
                  const appId = approvingApp.id;
                  setApprovingApp(null);
                  setCadetIdInput("");
                  await handleProcess(appId, "Approved", cleanedId);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold uppercase py-2 rounded text-[10px] cursor-pointer text-center animate-pulse"
              >
                Approve & Transmit
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Full Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <div>
                <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm">
                  {previewImage.name}
                </h4>
                <p className="text-[10px] font-mono text-slate-400">Official Applicant Photograph</p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-2 flex items-center justify-center bg-slate-950/5 dark:bg-slate-950/40 rounded-lg mx-5 border border-slate-100 dark:border-slate-800/80">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[60vh] max-w-full rounded-lg object-contain shadow-md"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="flex items-center justify-between px-5 pb-4 pt-1">
              <a
                href={previewImage.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-amber-500 hover:underline flex items-center space-x-1"
              >
                <span>Open original in new tab</span>
              </a>
              <button
                onClick={() => downloadApplicantImage(previewImage.url, previewImage.name)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold uppercase py-1.5 px-4 rounded text-[10px] flex items-center space-x-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Detailed Dossier Modal */}
      {detailedApp && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setDetailedApp(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-wider text-white">
                    Applicant Dossier Ledger
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    ID: {detailedApp.id} • Submitted: {new Date(detailedApp.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailedApp(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
                title="Close Dossier"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Profile Top Summary */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                {detailedApp.photoUrl && !detailedApp.photoUrl.includes("unsplash") ? (
                  <div 
                    className="relative group cursor-pointer shrink-0"
                    onClick={() => setPreviewImage({ url: detailedApp.photoUrl!, name: detailedApp.fullName })}
                    title="Click to view high-resolution image"
                  >
                    <img
                      src={detailedApp.photoUrl}
                      alt={detailedApp.fullName}
                      className="w-20 h-20 rounded-xl object-cover border-2 border-amber-500 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                      <ZoomIn className="h-5 w-5" />
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-army-900 border-2 border-amber-500 text-amber-400 font-bold text-2xl flex items-center justify-center shrink-0 shadow-md">
                    {detailedApp.fullName ? detailedApp.fullName.charAt(0) : "C"}
                  </div>
                )}

                <div className="space-y-1.5 flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="font-display font-black text-slate-900 dark:text-white text-lg">
                      {detailedApp.fullName}
                    </h2>
                    <span className="bg-amber-500/10 text-amber-500 font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold border border-amber-500/20">
                      {detailedApp.type}
                    </span>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                      detailedApp.status === "Pending" 
                        ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
                        : detailedApp.status === "Approved" 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    }`}>
                      {detailedApp.status}
                    </span>
                  </div>

                  {detailedApp.cadetId && (
                    <p className="font-mono text-xs font-bold text-amber-500">
                      Cadet ID: {detailedApp.cadetId}
                    </p>
                  )}

                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    {detailedApp.department} • Session {detailedApp.session} • Joining Year: {detailedApp.joiningYear}
                  </p>
                </div>

                {detailedApp.photoUrl && !detailedApp.photoUrl.includes("unsplash") && (
                  <button
                    onClick={() => downloadApplicantImage(detailedApp.photoUrl!, detailedApp.fullName)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                    title="Download Photo"
                  >
                    <Download className="h-4 w-4 text-emerald-500" />
                    <span>Download Photo</span>
                  </button>
                )}
              </div>

              {/* Contact & Personal Information */}
              <div>
                <h4 className="font-mono text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center space-x-1.5">
                  <User className="h-3.5 w-3.5 text-amber-500" />
                  <span>Contact & Demographic Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Email Address</span>
                    <a href={`mailto:${detailedApp.email}`} className="text-amber-600 dark:text-amber-400 hover:underline font-medium break-all">
                      {detailedApp.email}
                    </a>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Phone Number</span>
                    <a href={`tel:${detailedApp.phone}`} className="text-slate-800 dark:text-slate-200 font-mono font-medium">
                      {detailedApp.phone}
                    </a>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Blood Group</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                      {detailedApp.bloodGroup || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Current City / Location</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {detailedApp.currentCity || "Not provided"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Full Residential Address</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {detailedApp.address || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Academic & Service Credentials */}
              <div>
                <h4 className="font-mono text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center space-x-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  <span>Academic & Cadet Credentials</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Department / Group</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{detailedApp.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Academic Session</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono">{detailedApp.session}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Joining Year</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono">{detailedApp.joiningYear}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Graduation Year</span>
                    <span className="text-slate-800 dark:text-slate-200 font-mono">{detailedApp.graduationYear || "Ongoing / N/A"}</span>
                  </div>
                  {detailedApp.highestRank && (
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase block">Highest BNCC Rank</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">{detailedApp.highestRank}</span>
                    </div>
                  )}
                  {detailedApp.currentProfession && (
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Current Designation / Role</span>
                      <span className="text-slate-900 dark:text-slate-100 font-semibold">{detailedApp.currentProfession}</span>
                    </div>
                  )}
                  {detailedApp.currentOrganization && (
                    <div className="sm:col-span-2">
                      <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Company / Organization Name</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{detailedApp.currentOrganization}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Achievements History */}
              {detailedApp.pastAchievements && (
                <div>
                  <h4 className="font-mono text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center space-x-1.5">
                    <Award className="h-3.5 w-3.5 text-amber-500" />
                    <span>Past Achievements & Military Distinctions</span>
                  </h4>
                  <div className="text-xs bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {detailedApp.pastAchievements}
                  </div>
                </div>
              )}

              {/* Camp History Summary */}
              {detailedApp.campHistory && (
                <div>
                  <h4 className="font-mono text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center space-x-1.5">
                    <Tent className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Historical Camp Summary</span>
                  </h4>
                  <div className="text-xs bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
                    {detailedApp.campHistory}
                  </div>
                </div>
              )}

              {/* Structured Registered Camp Participations */}
              {detailedApp.campsParticipation && detailedApp.campsParticipation.length > 0 && (
                <div>
                  <h4 className="font-mono text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center space-x-1.5">
                    <Tent className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Verified Registered Camps ({detailedApp.campsParticipation.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {detailedApp.campsParticipation.map((cp, idx) => (
                      <div key={idx} className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">{cp.campName}</span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            Role: <span className="text-amber-600 dark:text-amber-400 font-bold">{cp.role}</span>
                          </span>
                        </div>
                        {cp.achievements && (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">
                            ★ {cp.achievements}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => setDetailedApp(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-mono font-bold uppercase transition-colors cursor-pointer"
              >
                Close Dossier
              </button>

              <div className="flex items-center space-x-2">
                {detailedApp.status === "Pending" && (
                  <>
                    <button
                      onClick={() => {
                        const target = detailedApp;
                        setDetailedApp(null);
                        setApprovingApp(target);
                        setCadetIdInput(target.cadetId || "");
                        setShowApproveModal(true);
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-mono font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1.5 shadow-sm"
                    >
                      <Check className="h-4 w-4" />
                      <span>Approve & Enlist</span>
                    </button>
                    <button
                      onClick={() => {
                        const target = detailedApp;
                        setDetailedApp(null);
                        handleReject(target.id, target.fullName);
                      }}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-mono font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1.5 shadow-sm"
                    >
                      <X className="h-4 w-4" />
                      <span>Reject</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    const target = detailedApp;
                    setDetailedApp(null);
                    handleDelete(target.id, target.fullName);
                  }}
                  className="px-3 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/30 rounded-lg text-xs font-mono font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Record</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
