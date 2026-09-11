import React from "react";
import { 
  Plus, Search, Check, UserPlus, Edit, Trash2, ArrowUpCircle, 
  ArrowUpDown, Download, Upload, Trash, ShieldCheck, RefreshCw,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet,
  Info, Sparkles, Eye, EyeOff, Copy, AlertTriangle, X 
} from "lucide-react";
import { Member, BNCCRank, MemberStatus } from "../../types";
import { createDocument, updateDocument, deleteDocument, softDeleteRecord, generateId } from "../../firebaseService";
import { auth } from "../../firebase";

interface MembersManagerProps {
  members: Member[];
  onRefresh: () => void;
  onDeleteMember: (id: string, name: string) => void;
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

export default function MembersManager({ members, onRefresh, onDeleteMember }: MembersManagerProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);

  // Filter & Sort State
  const [statusFilter, setStatusFilter] = React.useState<string>("All");
  const [rankFilter, setRankFilter] = React.useState<string>("All");
  const [deptFilter, setDeptFilter] = React.useState<string>("All");
  const [bloodFilter, setBloodFilter] = React.useState<string>("All");
  const [sortBy, setSortBy] = React.useState<string>("fullName");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Toasts & Confirmations
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Form State
  const [form, setForm] = React.useState({
    id: "",
    photoUrl: "",
    fullName: "",
    rank: BNCCRank.RECRUIT,
    department: "",
    session: "",
    joiningYear: new Date().getFullYear().toString(),
    bloodGroup: "O+",
    phone: "",
    email: "",
    biography: "",
    status: MemberStatus.ACTIVE_CADET,
    cadetIdImage: "",
    hideContactInfo: false,
    isArmyStaff: false,
  });

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleStartEdit = (member: Member) => {
    setEditingMember(member);
    setForm({
      id: member.id,
      photoUrl: member.photoUrl || "",
      fullName: member.fullName,
      rank: member.rank,
      department: member.department || "",
      session: member.session || "",
      joiningYear: String(member.joiningYear || new Date().getFullYear()),
      bloodGroup: member.bloodGroup || "O+",
      phone: member.phone || "",
      email: member.email || "",
      biography: member.biography || "",
      status: member.status || MemberStatus.ACTIVE_CADET,
      cadetIdImage: member.cadetIdImage || "",
      hideContactInfo: !!member.hideContactInfo,
      isArmyStaff: !!member.isArmyStaff,
    });
    setShowAddForm(true);
    showToast("Loaded cadet profile for modification", "info");
  };

  const handleDuplicate = (member: Member) => {
    setEditingMember(null);
    setForm({
      id: `${member.id}-DUP`,
      photoUrl: member.photoUrl || "",
      fullName: `${member.fullName} (COPY)`,
      rank: member.rank,
      department: member.department || "",
      session: member.session || "",
      joiningYear: String(member.joiningYear || new Date().getFullYear()),
      bloodGroup: member.bloodGroup || "O+",
      phone: member.phone || "",
      email: member.email || "",
      biography: member.biography || "",
      status: member.status || MemberStatus.ACTIVE_CADET,
      cadetIdImage: member.cadetIdImage || "",
      hideContactInfo: !!member.hideContactInfo,
      isArmyStaff: !!member.isArmyStaff,
    });
    setShowAddForm(true);
    showToast("Replicated cadet parameters into registration form", "success");
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setForm({
      id: "",
      photoUrl: "",
      fullName: "",
      rank: BNCCRank.RECRUIT,
      department: "",
      session: "",
      joiningYear: new Date().getFullYear().toString(),
      bloodGroup: "O+",
      phone: "",
      email: "",
      biography: "",
      status: MemberStatus.ACTIVE_CADET,
      cadetIdImage: "",
      hideContactInfo: false,
      isArmyStaff: false,
    });
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const targetId = form.id.trim();
      if (!targetId) {
        throw new Error("Cadet ID is strictly required and cannot be left blank.");
      }

      const emailClean = form.email.trim().toLowerCase();
      const phoneClean = form.phone.trim();

      // Check for duplicate email across other registered cadets
      if (emailClean) {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("../../firebase");
        
        const emailQuery = query(collection(db, "cadets"), where("email", "==", emailClean));
        const emailSnap = await getDocs(emailQuery);
        for (const doc of emailSnap.docs) {
          if (!editingMember || doc.id !== editingMember.id) {
            throw new Error(`The email address "${emailClean}" is already assigned to Cadet "${doc.data().fullName}" (ID: ${doc.id}).`);
          }
        }
      }

      // Check for duplicate phone across other registered cadets
      if (phoneClean) {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("../../firebase");

        const phoneQuery = query(collection(db, "cadets"), where("phone", "==", phoneClean));
        const phoneSnap = await getDocs(phoneQuery);
        for (const doc of phoneSnap.docs) {
          if (!editingMember || doc.id !== editingMember.id) {
            throw new Error(`The phone number "${phoneClean}" is already assigned to Cadet "${doc.data().fullName}" (ID: ${doc.id}).`);
          }
        }
      }

      if (editingMember) {
        if (targetId !== editingMember.id) {
          const { collection, query, where, getDocs } = await import("firebase/firestore");
          const { db } = await import("../../firebase");
          
          // Check if new targetId is already taken
          const idQuery = query(collection(db, "cadets"), where("id", "==", targetId));
          const idSnap = await getDocs(idQuery);
          if (!idSnap.empty) {
            throw new Error(`A cadet profile with ID "${targetId}" already exists in the registry.`);
          }

          // Write new document and delete the old one to perform a clean transfer
          const docData = {
            ...form,
            id: targetId,
            joiningYear: Number(form.joiningYear),
          };
          await createDocument("cadets", docData, targetId);
          await deleteDocument("cadets", editingMember.id);
        } else {
          // Normal inline field updates
          await updateDocument("cadets", editingMember.id, {
            ...form,
            joiningYear: Number(form.joiningYear),
          });
        }
        showToast("Cadet profile successfully updated!", "success");
      } else {
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const { db } = await import("../../firebase");

        // Check if targetId is already taken
        const idQuery = query(collection(db, "cadets"), where("id", "==", targetId));
        const idSnap = await getDocs(idQuery);
        if (!idSnap.empty) {
          throw new Error(`A cadet profile with ID "${targetId}" already exists in the registry.`);
        }

        await createDocument("cadets", {
          ...form,
          id: targetId,
          joiningYear: Number(form.joiningYear),
        }, targetId);
        showToast("Member profile successfully created and cataloged!", "success");
      }
      handleCancelEdit();
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNextRank = (rank: BNCCRank): BNCCRank => {
    switch (rank) {
      case BNCCRank.RECRUIT: return BNCCRank.CADET;
      case BNCCRank.CADET: return BNCCRank.LANCE_CORPORAL;
      case BNCCRank.LANCE_CORPORAL: return BNCCRank.CORPORAL;
      case BNCCRank.CORPORAL: return BNCCRank.SERGEANT;
      case BNCCRank.SERGEANT: return BNCCRank.CADET_UNDER_OFFICER;
      case BNCCRank.CADET_UNDER_OFFICER: return BNCCRank.PLATOON_UNDER_OFFICER;
      default: return rank;
    }
  };

  const handlePromoteRank = (memberId: string, currentRank: BNCCRank) => {
    const newRank = getNextRank(currentRank);
    if (newRank === currentRank) {
      showToast("This cadet is already at the highest platoon rank!", "info");
      return;
    }
    
    setConfirmDialog({
      title: "Promote Cadet Rank",
      message: `Confirm advancement of Cadet ${memberId} to the commission rank level of ${newRank}?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await updateDocument("cadets", memberId, { rank: newRank });
          showToast(`Cadet promoted to ${newRank}!`, "success");
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const handleToggleStatus = async (memberId: string, currentStatus: MemberStatus) => {
    let nextStatus = MemberStatus.ACTIVE_CADET;
    if (currentStatus === MemberStatus.ACTIVE_CADET) {
      nextStatus = MemberStatus.PLATOON_OFFICER;
    } else if (currentStatus === MemberStatus.PLATOON_OFFICER) {
      nextStatus = MemberStatus.ALUMNI;
    } else {
      nextStatus = MemberStatus.ACTIVE_CADET;
    }
    try {
      await updateDocument("cadets", memberId, { status: nextStatus });
      showToast(`Member status updated to ${nextStatus}`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleToggleVerification = async (memberId: string, currentVerified: boolean) => {
    try {
      await updateDocument("cadets", memberId, { verified: !currentVerified });
      showToast(
        !currentVerified ? "Cadet verification credentials set to VERIFIED" : "Cadet verification revoked", 
        "info"
      );
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleToggleContactHide = async (memberId: string, currentHidden: boolean) => {
    try {
      await updateDocument("cadets", memberId, { hideContactInfo: !currentHidden });
      showToast(
        !currentHidden ? "Contact visibility set to HIDDEN" : "Contact visibility set to VISIBLE", 
        "info"
      );
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredAndSortedMembers.map(m => m.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const updated = new Set(selectedIds);
    if (checked) {
      updated.add(id);
    } else {
      updated.delete(id);
    }
    setSelectedIds(updated);
  };

  const handleBulkPromote = () => {
    if (selectedIds.size === 0) return;
    
    setConfirmDialog({
      title: "Bulk Advise Promotion",
      message: `Are you sure you want to promote ${selectedIds.size} selected cadets to their respective next higher ranks?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const promises = Array.from(selectedIds).map(async (id: string) => {
            const m = members.find(x => x.id === id);
            if (!m) return;
            const newRank = getNextRank(m.rank);
            if (newRank === m.rank) return;
            return updateDocument("cadets", id, { rank: newRank });
          });
          await Promise.all(promises);
          setSelectedIds(new Set());
          onRefresh();
          showToast("Bulk rank promotions compiled successfully!", "success");
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const handleBulkVerify = (verified: boolean) => {
    if (selectedIds.size === 0) return;

    setConfirmDialog({
      title: "Bulk Adjust Verification",
      message: `Set verification flag to ${verified ? "VERIFIED" : "UNVERIFIED"} for ${selectedIds.size} selected cadets?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const promises = Array.from(selectedIds).map((id: string) => {
            return updateDocument("cadets", id, { verified });
          });
          await Promise.all(promises);
          setSelectedIds(new Set());
          onRefresh();
          showToast("Bulk verification modifications complete", "success");
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const handleBulkStatusChange = (status: MemberStatus) => {
    if (selectedIds.size === 0) return;

    setConfirmDialog({
      title: "Bulk Status Shift",
      message: `Shift roster service status of ${selectedIds.size} selected cadets to ${status}?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const promises = Array.from(selectedIds).map((id: string) => {
            return updateDocument("cadets", id, { status });
          });
          await Promise.all(promises);
          setSelectedIds(new Set());
          onRefresh();
          showToast(`Bulk status migrated to ${status}`, "success");
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    setConfirmDialog({
      title: "Bulk Committal to Recycle Bin",
      message: `Are you sure you want to move the ${selectedIds.size} selected cadet profiles into the Recycle Bin?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const promises = Array.from(selectedIds).map(async (id: string) => {
            const m = members.find(x => x.id === id);
            if (m) {
              return softDeleteRecord("cadets", id, m.fullName, m, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            }
          });
          await Promise.all(promises);
          setSelectedIds(new Set());
          onRefresh();
          showToast("Profiles migrated to Recycle Bin", "success");
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const handleSingleDelete = (id: string, name: string) => {
    setConfirmDialog({
      title: "Decommission Cadet Profile",
      message: `Are you sure you want to decommission the profile for Cadet ${name} (ID: ${id}) and transfer it to the Recycle Bin?`,
      onConfirm: () => {
        setConfirmDialog(null);
        onDeleteMember(id, name);
        showToast(`${name}'s profile has been moved to the Recycle Bin`, "info");
      }
    });
  };

  // Import / Export JSON & CSV
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredAndSortedMembers, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bncc_cadet_roster_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
    showToast("JSON roster export completed!", "success");
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Full Name", "Rank", "Department", "Session", "Joining Year", "Blood Group", "Phone", "Email", "Status", "Verified"];
    const rows = filteredAndSortedMembers.map(m => [
      m.id,
      m.fullName,
      m.rank,
      m.department || "",
      m.session || "",
      m.joiningYear || "",
      m.bloodGroup || "",
      m.phone || "",
      m.email || "",
      m.status,
      m.verified ? "Yes" : "No"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `bncc_cadet_roster_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
    showToast("CSV roster export completed!", "success");
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const toImport = Array.isArray(parsed) ? parsed : [parsed];

        const valid = toImport.every(m => m.fullName && m.id);
        if (!valid) {
          showToast("Check that all records have 'fullName' and a unique 'id' string.", "error");
          return;
        }

        setConfirmDialog({
          title: "Database Batch Import",
          message: `Are you sure you want to register ${toImport.length} cadets into the live platoon database?`,
          onConfirm: async () => {
            setConfirmDialog(null);
            let successCount = 0;
            const promises = toImport.map(async (m) => {
              try {
                const id = m.id || generateId("ugc");
                await createDocument("cadets", {
                  id,
                  fullName: m.fullName,
                  rank: m.rank || BNCCRank.RECRUIT,
                  department: m.department || "Science",
                  session: m.session || "2023-2024",
                  joiningYear: Number(m.joiningYear || new Date().getFullYear()),
                  bloodGroup: m.bloodGroup || "O+",
                  phone: m.phone || "+880 1700-000000",
                  email: m.email || "cadet@ugcbncc.org",
                  biography: m.biography || "System imported cadet record.",
                  status: m.status || MemberStatus.ACTIVE_CADET,
                  photoUrl: m.photoUrl || "",
                  verified: m.verified || false
                }, id);
                successCount++;
              } catch (e) {}
            });

            await Promise.all(promises);
            showToast(`Batch Import Complete: Registered ${successCount} records.`, "success");
            onRefresh();
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        });

      } catch (err: any) {
        showToast("Failed to parse input file: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  };

  // Helper arrays for filters
  const uniqueDepts = Array.from(new Set(members.map(m => m.department).filter(Boolean)));
  const uniqueBloods = Array.from(new Set(members.map(m => m.bloodGroup).filter(Boolean)));

  // Filtering and Sorting Process
  const filteredAndSortedMembers = React.useMemo(() => {
    return members
      .filter((m) => {
        const matchesSearch = 
          m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (m.email && m.email.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = statusFilter === "All" || m.status === statusFilter;
        const matchesRank = rankFilter === "All" || m.rank === rankFilter;
        const matchesDept = deptFilter === "All" || m.department === deptFilter;
        const matchesBlood = bloodFilter === "All" || m.bloodGroup === bloodFilter;

        return matchesSearch && matchesStatus && matchesRank && matchesDept && matchesBlood;
      })
      .sort((a, b) => {
        let compare = 0;
        if (sortBy === "fullName") {
          compare = a.fullName.localeCompare(b.fullName);
        } else if (sortBy === "id") {
          compare = a.id.localeCompare(b.id);
        } else if (sortBy === "joiningYear") {
          compare = (a.joiningYear || 0) - (b.joiningYear || 0);
        } else if (sortBy === "rank") {
          const rankWeight = (r: BNCCRank) => {
            const weights: Record<string, number> = {
              [BNCCRank.RECRUIT]: 1,
              [BNCCRank.CADET]: 2,
              [BNCCRank.LANCE_CORPORAL]: 3,
              [BNCCRank.CORPORAL]: 4,
              [BNCCRank.SERGEANT]: 5,
              [BNCCRank.CADET_UNDER_OFFICER]: 6,
              [BNCCRank.PLATOON_UNDER_OFFICER]: 7
            };
            return weights[r] || 0;
          };
          compare = rankWeight(a.rank) - rankWeight(b.rank);
        }

        return sortOrder === "asc" ? compare : -compare;
      });
  }, [members, searchTerm, statusFilter, rankFilter, deptFilter, bloodFilter, sortBy, sortOrder]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, rankFilter, deptFilter, bloodFilter]);

  // Pagination bounds
  const totalItems = filteredAndSortedMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedMembers = filteredAndSortedMembers.slice(indexOfFirstItem, indexOfLastItem);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  return (
    <div id="members-manager-panel" className="space-y-6 relative text-xs">
      {/* Toast alert system */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-white font-mono text-[11px] animate-slide-in-right ${
              toast.type === "success" 
                ? "bg-emerald-650 border border-emerald-550" 
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

      {/* Confirmation Overlays */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-500">
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
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                PROCEED
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Quick Filters Row */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-250 dark:border-slate-800 shadow-sm space-y-4 text-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by full name, cadet ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-2 pl-9 pr-3 text-xs w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-sans"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-mono font-bold uppercase px-3 py-2 rounded flex items-center space-x-1 border border-slate-200 dark:border-slate-750 transition-colors text-[9px] cursor-pointer"
              title="Bulk import cadets via JSON record"
            >
              <Upload className="h-3 w-3" />
              <span>Import JSON</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-mono font-bold uppercase px-3 py-2 rounded flex items-center space-x-1 border border-slate-200 dark:border-slate-750 transition-colors text-[9px] cursor-pointer"
              title="Download filtered cadets roster as JSON file"
            >
              <Download className="h-3 w-3" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-mono font-bold uppercase px-3 py-2 rounded flex items-center space-x-1 border border-slate-200 dark:border-slate-750 transition-colors text-[9px] cursor-pointer"
              title="Download filtered cadets roster as CSV sheet"
            >
              <FileSpreadsheet className="h-3 w-3" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-extrabold uppercase px-4 py-2 rounded flex items-center space-x-1.5 transition-all cursor-pointer text-[10px]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{showAddForm ? "CLOSE FORM" : "+ NEW CADET"}</span>
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Service Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="All">All Statuses</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.ACTIVE_CADET}>Active Cadet</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.PLATOON_OFFICER}>Platoon Officer (PUO)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.ALUMNI}>Alumni</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.HONORARY_MEMBER}>Honorary Member</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Platoon Rank</label>
            <select
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="All">All Ranks</option>
              {Object.values(BNCCRank).map(r => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">HSC Academic Group</label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="All">All Groups</option>
              {uniqueDepts.map(d => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">Blood Group</label>
            <select
              value={bloodFilter}
              onChange={(e) => setBloodFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="All">All Groups</option>
              {uniqueBloods.map(b => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid: List and Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Roster database column */}
        <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${showAddForm ? "lg:col-span-2" : "lg:col-span-3"}`}>
          
          {/* Bulk Actions Bar if selection active */}
          {selectedIds.size > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 animate-pulse">
              <div className="flex items-center space-x-2 text-xs font-mono text-amber-800 dark:text-amber-400 font-bold">
                <ShieldCheck className="h-4 w-4" />
                <span>{selectedIds.size} CADETS SELECTED:</span>
              </div>
              <div className="flex items-center flex-wrap gap-1.5 text-[9px] font-mono">
                <button
                  onClick={handleBulkPromote}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Promote Rank
                </button>
                <button
                  onClick={() => handleBulkVerify(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Verify
                </button>
                <button
                  onClick={() => handleBulkVerify(false)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Unverify
                </button>
                <button
                  onClick={() => handleBulkStatusChange(MemberStatus.ACTIVE_CADET)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Active Status
                </button>
                <button
                  onClick={() => handleBulkStatusChange(MemberStatus.ALUMNI)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Alumni Status
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <Trash className="h-3 w-3" />
                  <span>Trash</span>
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-1 py-1 uppercase underline font-semibold cursor-pointer"
                >
                  Deselect
                </button>
              </div>
            </div>
          )}

          {/* Table Header and count */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-850 flex justify-between items-center bg-slate-50/50 dark:bg-slate-955/20">
            <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              CADET DATABASE REGISTRY ({filteredAndSortedMembers.length} OF {members.length} ROSTER)
            </h3>
            {totalItems > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItems)} of {totalItems}
              </span>
            )}
          </div>

          {/* Table container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-850 text-slate-400 uppercase tracking-wider font-mono text-[10px] whitespace-nowrap">
                  <th className="py-3 px-2.5 w-9 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedMembers.length > 0 && paginatedMembers.every(m => selectedIds.has(m.id))}
                      onChange={handleSelectAll}
                      className="rounded text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white font-semibold transition-colors" onClick={() => toggleSort("fullName")}>
                    <div className="flex items-center space-x-1.5">
                      <span>Name & Cadet Profile</span>
                      <ArrowUpDown className="h-3 w-3 text-amber-500" />
                    </div>
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:text-slate-950 dark:hover:text-white font-semibold transition-colors whitespace-nowrap" onClick={() => toggleSort("rank")}>
                    <div className="flex items-center space-x-1.5">
                      <span>Rank</span>
                      <ArrowUpDown className="h-3 w-3 text-amber-500" />
                    </div>
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 whitespace-nowrap">Group / Dept</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedMembers.map((m) => (
                  <tr key={m.id} className={`hover:bg-slate-50/40 dark:hover:bg-slate-850/25 transition-colors ${selectedIds.has(m.id) ? "bg-amber-50/20 dark:bg-amber-955/10" : ""}`}>
                    <td className="py-2.5 px-2.5 w-9 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={(e) => handleSelectRow(m.id, e.target.checked)}
                        className="rounded text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 border-slate-300 cursor-pointer"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center space-x-2.5">
                        {m.photoUrl && !m.photoUrl.includes("unsplash") ? (
                          <img
                            src={m.photoUrl}
                            alt={m.fullName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-army-900 border border-amber-500/40 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {m.fullName ? m.fullName.charAt(0) : "C"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                            <span className="font-sans font-bold text-xs">{m.fullName}</span>
                            {m.verified && (
                              <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0" title="Verified Cadet">V</span>
                            )}
                            {m.isArmyStaff && (
                              <span className="text-[8px] bg-red-600 text-white px-1.5 py-0.2 rounded font-mono uppercase font-black shrink-0">Army Staff</span>
                            )}
                            {m.rank === BNCCRank.PLATOON_UNDER_OFFICER && (
                              <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-mono uppercase font-black shrink-0">Faculty PUO</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-1.5 flex-wrap gap-y-0.5 mt-0.5">
                            <span>ID: {m.id}</span>
                            {m.cadetIdImage && (
                              <a
                                href={m.cadetIdImage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-amber-500 hover:text-amber-600 font-black text-[8px] tracking-wide font-mono border border-amber-500/20 bg-amber-500/5 px-1 py-0.2 rounded leading-none inline-block hover:scale-105 transition-all shrink-0"
                                title="Click to view Cadet ID Card reference image in a new tab"
                              >
                                ID CARD
                              </a>
                            )}
                            <span>•</span>
                            <span>Joined: {m.joiningYear}</span>
                            {m.bloodGroup && (
                              <>
                                <span>•</span>
                                <span className="text-red-500 font-bold">{m.bloodGroup}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-amber-400 border border-slate-200 dark:border-slate-700 text-[10px]">
                        {m.rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(m.id, m.status)}
                        className={`text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wide border cursor-pointer font-bold transition-all ${
                          m.status === MemberStatus.PLATOON_OFFICER || m.rank === BNCCRank.PLATOON_UNDER_OFFICER
                            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                            : m.status === MemberStatus.ACTIVE_CADET
                            ? "bg-emerald-50 dark:bg-emerald-955/20 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
                            : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        }`}
                        title="Click to toggle member status (Active Cadet -> Platoon Officer -> Alumni)"
                      >
                        {m.rank === BNCCRank.PLATOON_UNDER_OFFICER && m.status === MemberStatus.ACTIVE_CADET
                          ? MemberStatus.PLATOON_OFFICER
                          : m.status}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-200 font-sans text-xs whitespace-nowrap">
                      {m.department || "General"}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1 shrink-0">
                        <button
                          onClick={() => handleToggleVerification(m.id, m.verified)}
                          className={`text-[8px] px-1.5 py-1 rounded font-mono uppercase border cursor-pointer transition-colors ${
                            m.verified
                              ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
                              : "bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-750 hover:border-slate-300 dark:hover:border-slate-600"
                          }`}
                          title={m.verified ? "Verified profile. Click to unverify." : "Click to mark profile verified"}
                        >
                          {m.verified ? "Verified" : "Verify"}
                        </button>

                        <button
                          onClick={() => handleToggleContactHide(m.id, !!m.hideContactInfo)}
                          className={`p-1.5 rounded border cursor-pointer transition-colors ${
                            m.hideContactInfo
                              ? "border-red-200 text-red-500 bg-red-50 dark:border-red-900 dark:bg-red-955/20"
                              : "border-slate-200 text-slate-500 hover:text-emerald-500 hover:border-emerald-500 dark:border-slate-700 dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:border-emerald-400"
                          }`}
                          title={m.hideContactInfo ? "Contact info is HIDDEN. Click to SHOW contact info." : "Contact info is VISIBLE. Click to HIDE contact info."}
                        >
                          {m.hideContactInfo ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          onClick={() => handlePromoteRank(m.id, m.rank)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-500 hover:text-amber-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Promote Cadet to Next Higher Rank"
                        >
                          <ArrowUpCircle className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleDuplicate(m)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-500 hover:text-amber-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Duplicate Cadet parameters for swift Batch Entry"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleStartEdit(m)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-500 hover:text-amber-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Profile Dossier"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => handleSingleDelete(m.id, m.fullName)}
                          className="p-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-sm"
                          title="Migrate to Recycle Bin (Trash)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Empty filter state */}
            {filteredAndSortedMembers.length === 0 && (
              <div className="py-12 text-center text-slate-400 font-mono text-xs space-y-2">
                <Info className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="uppercase">No Cadet Profiles match the selected filter query.</p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("All");
                    setRankFilter("All");
                    setDeptFilter("All");
                    setBloodFilter("All");
                  }}
                  className="text-amber-500 hover:underline text-[10px] uppercase font-bold cursor-pointer"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-955/20">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1 text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value={10}>10 records</option>
                  <option value={20}>20 records</option>
                  <option value={50}>50 records</option>
                </select>
                <span>per page</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="text-xs font-mono px-3 py-1 bg-slate-100 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Form */}
        {showAddForm && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-250 dark:border-slate-800 shadow-sm p-5 space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                {editingMember ? "UPDATE CADET PROFILE" : "MANUAL PROFILE REGISTRY"}
              </h3>
              {editingMember && (
                <button
                  onClick={handleCancelEdit}
                  className="text-red-500 hover:text-red-600 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  [Cancel Edit]
                </button>
              )}
            </div>
            
            <form onSubmit={handleCreateMember} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Cadet ID (Manual Entry)</label>
                <input
                  type="text"
                  required
                  disabled={!!(editingMember && editingMember.id && editingMember.id.startsWith("UGC-"))}
                  placeholder="e.g., UGC-2023-105"
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none disabled:opacity-60 focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., KAZI SAKIB"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Rank</label>
                  <select
                    value={form.rank}
                    onChange={(e) => {
                      const selectedRank = e.target.value as BNCCRank;
                      const autoStatus = selectedRank === BNCCRank.PLATOON_UNDER_OFFICER ? MemberStatus.PLATOON_OFFICER : form.status;
                      setForm({ ...form, rank: selectedRank, status: autoStatus });
                    }}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={BNCCRank.RECRUIT}>Recruit</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={BNCCRank.CADET}>Cadet</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={BNCCRank.LANCE_CORPORAL}>Lance Corporal</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={BNCCRank.CORPORAL}>Corporal</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={BNCCRank.SERGEANT}>Sergeant</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={BNCCRank.CADET_UNDER_OFFICER}>Cadet Under Officer</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={BNCCRank.PLATOON_UNDER_OFFICER}>Platoon Under Officer</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">
                    {form.isArmyStaff
                      ? "Assigned Role / Army Appointment"
                      : form.rank === BNCCRank.PLATOON_UNDER_OFFICER
                      ? "Designation / Department (Group)"
                      : "HSC Group"}
                  </label>
                  {form.isArmyStaff || form.rank === BNCCRank.PLATOON_UNDER_OFFICER ? (
                    <input
                      type="text"
                      required
                      placeholder={form.isArmyStaff ? "e.g., Military Instructor" : "e.g., Associate Professor, Bangla"}
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  ) : (
                    <select
                      required
                      value={form.department}
                      onChange={(e) => setForm({ ...form, department: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    >
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="">Select Group</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="Science">Science</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="Humanities">Humanities</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="Business Studies">Business Studies</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">
                    {form.isArmyStaff || form.rank === BNCCRank.PLATOON_UNDER_OFFICER
                      ? "Service / Posting Session"
                      : "Academic Session"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 2023-2024"
                    value={form.session}
                    onChange={(e) => setForm({ ...form, session: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">
                    {form.isArmyStaff
                      ? "Posting Year"
                      : form.rank === BNCCRank.PLATOON_UNDER_OFFICER
                      ? "Appointment Year"
                      : "Joining Year"}
                  </label>
                  <input
                    type="number"
                    required
                    value={form.joiningYear}
                    onChange={(e) => setForm({ ...form, joiningYear: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Blood Group</label>
                  <select
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="A+">A+</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="A-">A-</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="B+">B+</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="B-">B-</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="O+">O+</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="O-">O-</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="AB+">AB+</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="AB-">AB-</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as MemberStatus })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  >
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.ACTIVE_CADET}>Active Cadet</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.PLATOON_OFFICER}>Platoon Officer (PUO)</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.ALUMNI}>Alumni</option>
                    <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={MemberStatus.HONORARY_MEMBER}>Honorary Member</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Hotline Mobile</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., +880 170 000000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Secure Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g., cadet@ugcbncc.org"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-col space-y-1.5 pt-1 pb-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="hideContactInfo"
                    checked={form.hideContactInfo}
                    onChange={(e) => setForm({ ...form, hideContactInfo: e.target.checked })}
                    className="rounded border-slate-200 dark:border-slate-800 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="hideContactInfo" className="font-mono text-slate-700 dark:text-slate-300 uppercase text-[9px] cursor-pointer font-bold select-none">
                    Hide Contact Info (Phone/Email) on public profile
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isArmyStaff"
                    checked={form.isArmyStaff}
                    onChange={(e) => setForm({ ...form, isArmyStaff: e.target.checked })}
                    className="rounded border-slate-200 dark:border-slate-800 text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="isArmyStaff" className="font-mono text-slate-700 dark:text-slate-300 uppercase text-[9px] cursor-pointer font-bold select-none">
                    Is Assigned Regular Army Staff (Military Instructor/NCO/WO)
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Short Biography</label>
                <textarea
                  placeholder="Insert cadet historical records..."
                  value={form.biography}
                  onChange={(e) => setForm({ ...form, biography: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none h-16 resize-none font-sans focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Profile Photo</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste Image URL or upload a file"
                    value={form.photoUrl}
                    onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <label className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded px-3 py-1.5 font-mono text-[10px] font-bold cursor-pointer shrink-0 flex items-center justify-center text-slate-700 dark:text-slate-300">
                    UPLOAD PHOTO
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setForm({ ...form, photoUrl: reader.result as string });
                            showToast("Uploaded photo preview successfully", "success");
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                {form.photoUrl && (
                  <div className="mt-1.5 relative border border-slate-200 dark:border-slate-800 rounded p-1.5 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                    <img
                      src={form.photoUrl}
                      alt="Profile Photo Preview"
                      className="h-14 w-14 object-cover rounded-full"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, photoUrl: "" })}
                      className="text-red-500 hover:text-red-600 font-bold uppercase text-[9px] font-mono cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Cadet ID Reference Image</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste Image URL or upload a file"
                    value={form.cadetIdImage}
                    onChange={(e) => setForm({ ...form, cadetIdImage: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <label className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded px-3 py-1.5 font-mono text-[10px] font-bold cursor-pointer shrink-0 flex items-center justify-center text-slate-700 dark:text-slate-300">
                    UPLOAD
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setForm({ ...form, cadetIdImage: reader.result as string });
                            showToast("Uploaded ID card reference successfully", "success");
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                {form.cadetIdImage && (
                  <div className="mt-1.5 relative border border-slate-200 dark:border-slate-800 rounded p-1.5 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                    <img
                      src={form.cadetIdImage}
                      alt="Cadet ID Reference Preview"
                      className="h-14 w-auto object-contain rounded"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, cadetIdImage: "" })}
                      className="text-red-500 hover:text-red-600 font-bold uppercase text-[9px] font-mono cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="flex space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-black uppercase py-2.5 rounded text-[10px] tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "COMMITING..." : (editingMember ? "COMMIT CHANGES" : "COMMIT CADET DOSSIER")}
                </button>
                {editingMember && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-black uppercase px-4 py-2.5 rounded text-[10px] tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
