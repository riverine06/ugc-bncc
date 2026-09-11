import React from "react";
import { 
  Check, X, Shield, Clock, FileSpreadsheet, Search, ArrowUpDown, 
  ChevronLeft, ChevronRight, Copy, AlertTriangle, AlertCircle, XCircle 
} from "lucide-react";
import { PlatoonApplication, Member, BNCCRank, MemberStatus } from "../../types";
import { updateDocument, createDocument, generateId } from "../../firebaseService";

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

  const exportToExcel = (filter: "All" | "Pending" | "Approved" | "Rejected") => {
    const listToExport = filter === "All"
      ? localApplications
      : localApplications.filter((a) => a.status === filter);

    if (listToExport.length === 0) {
      showToast(`No applications found with status "${filter}" to export.`, "info");
      return;
    }

    const headers = [
      "Application ID",
      "Full Name",
      "Email Address",
      "Phone Number",
      "Type (Recruit/Cadet/Alumni)",
      "Department/HSC Group",
      "Session/Year",
      "Joining Year",
      "Graduation Year",
      "Highest Rank",
      "Current Profession",
      "Current Organization",
      "Current City",
      "Past Achievements",
      "Camp History",
      "Address",
      "Blood Group",
      "Submission Date",
      "Status",
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
      ...listToExport.map((app) =>
        [
          app.id,
          app.fullName,
          app.email,
          app.phone,
          app.type,
          app.department,
          app.session,
          app.joiningYear,
          app.graduationYear || "",
          app.highestRank || "",
          app.currentProfession || "",
          app.currentOrganization || "",
          app.currentCity || "",
          app.pastAchievements || "",
          app.campHistory || "",
          app.address || "",
          app.bloodGroup || "",
          new Date(app.submittedAt).toISOString(),
          app.status,
        ]
          .map(escapeCSV)
          .join(",")
      ),
    ];

    const csvContent = "\uFEFF" + csvRows.join("\n"); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `UGC_BNCC_Applications_${filter}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Successfully exported application sheet to CSV`, "success");
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
                REJECT APPLICATION
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

        <div className="flex flex-wrap gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkReject}
              className="bg-red-600 hover:bg-red-700 text-white font-mono font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Bulk Reject ({selectedIds.length})</span>
            </button>
          )}
          <button
            onClick={() => exportToExcel("All")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center space-x-1.5 cursor-pointer transition-colors"
            title="Export all applications to Excel/CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Export All (Excel)</span>
          </button>
          <button
            onClick={() => exportToExcel("Pending")}
            className="bg-amber-600 hover:bg-amber-700 text-white font-mono font-bold uppercase py-1.5 px-3 rounded text-[10px] flex items-center space-x-1.5 cursor-pointer transition-colors"
            title="Export pending applications to Excel/CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>Pending Only</span>
          </button>
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
                        <img
                          src={app.photoUrl}
                          alt={app.fullName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-army-900 border border-amber-500/40 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {app.fullName ? app.fullName.charAt(0) : "C"}
                        </div>
                      )}
                      <div>
                        <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm leading-tight">
                          {app.fullName}
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

                  {/* Grid details */}
                  <div className="grid grid-cols-2 gap-3 text-[11px] bg-slate-50 dark:bg-slate-850 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
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
                      <span className="text-slate-400 block text-[9px] uppercase font-mono">Status Status</span>
                      <span className={`font-mono text-[10px] font-bold uppercase ${
                        app.status === "Pending" 
                          ? "text-amber-500" 
                          : app.status === "Approved" 
                          ? "text-emerald-500" 
                          : "text-rose-500"
                      }`}>{app.status}</span>
                    </div>
                  </div>

                  {/* Achievements history */}
                  {app.pastAchievements && (
                    <div className="text-[11px] bg-amber-500/5 border border-amber-500/10 p-2.5 rounded text-slate-600 dark:text-slate-300">
                      <strong className="text-[9px] uppercase font-mono text-amber-500 block">Achievements History:</strong>
                      <p className="mt-0.5 line-clamp-3">{app.pastAchievements}</p>
                    </div>
                  )}

                  {/* Registered Camp Participations */}
                  {app.campsParticipation && app.campsParticipation.length > 0 && (
                    <div className="text-[11px] bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded text-slate-600 dark:text-slate-300 space-y-1">
                      <strong className="text-[9px] uppercase font-mono text-emerald-500 block">Registered Camp Participations ({app.campsParticipation.length}):</strong>
                      <ul className="space-y-1">
                        {app.campsParticipation.map((cp, idx) => (
                          <li key={idx} className="text-[10px] font-mono leading-tight">
                            • <span className="font-bold text-slate-800 dark:text-slate-200">{cp.campName}</span> — Role: <span className="text-amber-600 dark:text-amber-400 font-bold">{cp.role}</span>
                            {cp.achievements && <span className="text-emerald-600 dark:text-emerald-400 block pl-3">★ Award: {cp.achievements}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Individual Action buttons */}
                <div className="flex space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleDuplicate(app)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 dark:text-slate-400 rounded transition-colors"
                    title="Duplicate application"
                  >
                    <Copy className="h-3.5 w-3.5" />
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
    </div>
  );
}
