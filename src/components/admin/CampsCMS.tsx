import React from "react";
import { 
  Plus, Trash2, Calendar, Edit, Search, MapPin, 
  Trash, Info, ArrowUpDown, ChevronLeft, ChevronRight, Check, X, Copy, AlertTriangle, Loader2,
  Users, UserPlus, Award, Shield, CheckSquare, Square, Filter, UserCheck, RefreshCw
} from "lucide-react";
import { Camp, Member, CampParticipant, BNCCRank, MemberStatus } from "../../types";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument, softDeleteRecord, generateId } from "../../firebaseService";
import { auth } from "../../firebase";

interface CampsCMSProps {
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

export default function CampsCMS({ onRefresh }: CampsCMSProps) {
  const [list, setList] = React.useState<Camp[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [campParticipants, setCampParticipants] = React.useState<CampParticipant[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingCamp, setEditingCamp] = React.useState<Camp | null>(null);

  // Manage Participants Modal state
  const [managingCamp, setManagingCamp] = React.useState<Camp | null>(null);
  const [participantsSubTab, setParticipantsSubTab] = React.useState<"list" | "add">("list");
  const [searchMemberQuery, setSearchMemberQuery] = React.useState("");
  const [filterMemberBatch, setFilterMemberBatch] = React.useState("");
  const [filterMemberRank, setFilterMemberRank] = React.useState("");
  const [filterMemberType, setFilterMemberType] = React.useState<"All" | "Active" | "Alumni">("All");
  const [selectedMemberIdsForCamp, setSelectedMemberIdsForCamp] = React.useState<string[]>([]);
  
  // Assignment Config State
  const [assignRole, setAssignRole] = React.useState("Participant");
  const [customRoleInput, setCustomRoleInput] = React.useState("");
  const [assignAwards, setAssignAwards] = React.useState("");
  const [assignRemarks, setAssignRemarks] = React.useState("");
  const [submittingParticipants, setSubmittingParticipants] = React.useState(false);

  // Inline editing of current participant
  const [editingParticipantId, setEditingParticipantId] = React.useState<string | null>(null);
  const [editRole, setEditRole] = React.useState("Participant");
  const [editAwards, setEditAwards] = React.useState("");
  const [editRemarks, setEditRemarks] = React.useState("");

  // Filters & Sorting & Selection state for camps
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"All" | "Upcoming" | "Ongoing" | "Completed">("All");
  const [sortBy, setSortBy] = React.useState<"name" | "startDate">("startDate");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);

  // Toast & Custom Dialog State
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  // Form State
  const [form, setForm] = React.useState({
    name: "",
    location: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    description: "",
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  React.useEffect(() => {
    setLoading(true);
    const unsubCamps = subscribeToCollection<Camp>("camps", (data) => {
      setList(data);
      setLoading(false);
    });

    const unsubMembers = subscribeToCollection<Member>("cadets", (data) => {
      setMembers(data);
    });

    const unsubParticipants = subscribeToCollection<CampParticipant>("campParticipants", (data) => {
      setCampParticipants(data);
    });

    return () => {
      unsubCamps();
      unsubMembers();
      unsubParticipants();
    };
  }, []);

  const handleStartEdit = (camp: Camp) => {
    setEditingCamp(camp);
    setForm({
      name: camp.name,
      location: camp.location,
      startDate: camp.startDate,
      endDate: camp.endDate,
      description: camp.description,
    });
    setShowForm(true);
    showToast(`Loaded "${camp.name}" for editing`, "info");
  };

  const handleCancelEdit = () => {
    setEditingCamp(null);
    setForm({
      name: "",
      location: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      description: "",
    });
  };

  const handlePublishOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.location || !form.startDate || !form.endDate || !form.description) {
      showToast("Please provide all camp details.", "error");
      return;
    }

    try {
      if (editingCamp) {
        await updateDocument("camps", editingCamp.id, {
          ...form,
        });
        showToast("Camp entry successfully updated!", "success");
      } else {
        const id = generateId("cmp");
        await createDocument("camps", {
          ...form,
          id,
        }, id);
        showToast("New Camp entry successfully created!", "success");
      }
      handleCancelEdit();
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDuplicate = async (camp: Camp) => {
    try {
      const id = generateId("cmp");
      const duplicateData: Camp = {
        ...camp,
        id,
        name: `${camp.name} (Copy)`,
      };
      await createDocument("camps", duplicateData, id);
      showToast(`Duplicated "${camp.name}" as "${duplicateData.name}"`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDialog({
      title: "Soft Delete Camp Registry",
      message: `Are you sure you want to move "${name}" to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          const campToDel = list.find((c) => c.id === id);
          if (campToDel) {
            await softDeleteRecord("camps", id, name, campToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            showToast(`Moved "${name}" to Recycle Bin`, "success");
            setSelectedIds((prev) => prev.filter((item) => item !== id));
            onRefresh();
          }
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Soft Delete",
      message: `Are you sure you want to move ${selectedIds.length} selected camps to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          for (const id of selectedIds) {
            const campToDel = list.find((c) => c.id === id);
            if (campToDel) {
              await softDeleteRecord("camps", id, campToDel.name, campToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            }
          }
          showToast(`Successfully moved ${selectedIds.length} camps to Recycle Bin`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  const getStatus = (start: string, end: string): "Upcoming" | "Ongoing" | "Completed" => {
    const now = new Date().toISOString().split("T")[0];
    if (now < start) return "Upcoming";
    if (now > end) return "Completed";
    return "Ongoing";
  };

  // Filter & Sort Logic for Camps Table
  const filteredCamps = list.filter((camp) => {
    const status = getStatus(camp.startDate, camp.endDate);
    if (statusFilter !== "All" && status !== statusFilter) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = camp.name.toLowerCase().includes(term);
      const matchLoc = camp.location.toLowerCase().includes(term);
      const matchDesc = camp.description.toLowerCase().includes(term);
      if (!matchName && !matchLoc && !matchDesc) return false;
    }
    return true;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortBy === "name") {
      comparison = a.name.localeCompare(b.name);
    } else {
      comparison = a.startDate.localeCompare(b.startDate);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredCamps.length / itemsPerPage) || 1;
  const paginatedCamps = filteredCamps.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleToggleSelectAll = () => {
    const currentPageIds = paginatedCamps.map((c) => c.id);
    const allSelected = currentPageIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ---------------------------------------------------------------------------
  // MANAGE PARTICIPANTS MODAL HANDLERS
  // ---------------------------------------------------------------------------
  const handleOpenManageParticipants = (camp: Camp) => {
    setManagingCamp(camp);
    setParticipantsSubTab("list");
    setSearchMemberQuery("");
    setFilterMemberBatch("");
    setFilterMemberRank("");
    setFilterMemberType("All");
    setSelectedMemberIdsForCamp([]);
    setAssignRole("Participant");
    setCustomRoleInput("");
    setAssignAwards("");
    setAssignRemarks("");
    setEditingParticipantId(null);
  };

  const handleCloseManageParticipants = () => {
    setManagingCamp(null);
  };

  // Get current participants for selected camp
  const currentCampParticipants = React.useMemo(() => {
    if (!managingCamp) return [];
    return campParticipants.filter((cp) => cp.campId === managingCamp.id);
  }, [campParticipants, managingCamp]);

  // Derived batches from members
  const memberBatches = React.useMemo(() => {
    const batches = members
      .map((m) => m.joiningYear?.toString() || m.session?.split("-")[0] || "")
      .filter((b) => b && !isNaN(Number(b)));
    const currentYr = new Date().getFullYear();
    const defaultYrs = Array.from({ length: currentYr - 2018 + 1 }, (_, i) => (currentYr - i).toString());
    return Array.from(new Set([...defaultYrs, ...batches])).sort((a, b) => Number(b) - Number(a));
  }, [members]);

  // Available members for assignment (excluding members already participating)
  const availableMembers = React.useMemo(() => {
    if (!managingCamp) return [];
    const existingMemberIds = new Set(currentCampParticipants.map((cp) => cp.memberId));

    return members.filter((m) => {
      // Filter out already participating members
      if (existingMemberIds.has(m.id)) return false;

      // Type filter
      if (filterMemberType === "Active" && m.status !== MemberStatus.ACTIVE_CADET) return false;
      if (filterMemberType === "Alumni" && m.status !== MemberStatus.ALUMNI) return false;

      // Batch filter
      if (filterMemberBatch) {
        const mYear = m.joiningYear?.toString() || "";
        const mSession = m.session || "";
        if (mYear !== filterMemberBatch && !mSession.includes(filterMemberBatch)) return false;
      }

      // Rank filter
      if (filterMemberRank && m.rank !== filterMemberRank) return false;

      // Search query filter (Member ID, Full Name, Department)
      if (searchMemberQuery.trim()) {
        const q = searchMemberQuery.toLowerCase();
        const matchName = m.fullName.toLowerCase().includes(q);
        const matchId = m.id.toLowerCase().includes(q);
        const matchDept = (m.department || "").toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDept) return false;
      }

      return true;
    });
  }, [members, currentCampParticipants, managingCamp, filterMemberType, filterMemberBatch, filterMemberRank, searchMemberQuery]);

  // Handle Assigning Selected Members
  const handleAssignSelectedMembers = async () => {
    if (!managingCamp || selectedMemberIdsForCamp.length === 0) return;
    
    const finalRole = assignRole === "Other" ? customRoleInput.trim() || "Participant" : assignRole;
    setSubmittingParticipants(true);

    try {
      for (const mId of selectedMemberIdsForCamp) {
        const cpId = generateId("cp");
        await createDocument("campParticipants", {
          id: cpId,
          campId: managingCamp.id,
          memberId: mId,
          role: finalRole,
          awards: assignAwards.trim(),
          remarks: assignRemarks.trim(),
        }, cpId);
      }

      showToast(`Successfully assigned ${selectedMemberIdsForCamp.length} participant(s) to ${managingCamp.name}!`, "success");
      setSelectedMemberIdsForCamp([]);
      setAssignRole("Participant");
      setCustomRoleInput("");
      setAssignAwards("");
      setAssignRemarks("");
      setParticipantsSubTab("list");
      onRefresh();
    } catch (err: any) {
      showToast("Failed to assign participants: " + err.message, "error");
    } finally {
      setSubmittingParticipants(false);
    }
  };

  // Handle Save Inline Participant Edit
  const handleSaveParticipantEdit = async (cpId: string) => {
    try {
      await updateDocument("campParticipants", cpId, {
        role: editRole.trim() || "Participant",
        awards: editAwards.trim(),
        remarks: editRemarks.trim(),
      });
      showToast("Participant record updated successfully!", "success");
      setEditingParticipantId(null);
      onRefresh();
    } catch (err: any) {
      showToast("Failed to update participant: " + err.message, "error");
    }
  };

  // Handle Remove Participant
  const handleRemoveParticipant = (cpId: string, memberName: string) => {
    setConfirmDialog({
      title: "Remove Camp Participant",
      message: `Are you sure you want to remove "${memberName}" from this camp registry?`,
      onConfirm: async () => {
        try {
          await deleteDocument("campParticipants", cpId);
          showToast(`Removed "${memberName}" from camp participants`, "success");
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        }
      }
    });
  };

  // Role Distribution summary computation
  const roleDistribution = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const cp of currentCampParticipants) {
      const r = cp.role || "Participant";
      map[r] = (map[r] || 0) + 1;
    }
    return map;
  }, [currentCampParticipants]);

  // Earned awards count computation
  const totalEarnedAwards = React.useMemo(() => {
    return currentCampParticipants.filter((cp) => cp.awards && cp.awards.trim().length > 0).length;
  }, [currentCampParticipants]);

  return (
    <div className="space-y-6">
      {/* Toast Notifications Overlay */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`p-3 rounded-md shadow-lg text-xs font-mono font-bold flex items-center space-x-2 pointer-events-auto transition-all ${
              t.type === "success"
                ? "bg-emerald-600 text-white"
                : t.type === "error"
                ? "bg-red-600 text-white"
                : "bg-blue-600 text-white"
            }`}
          >
            <Info className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirmation Dialog Overlay */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/50 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start space-x-3 text-amber-500">
              <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-bold text-sm text-slate-100 uppercase">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-1.5 rounded text-xs font-mono uppercase font-bold cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-1.5 rounded text-xs font-mono uppercase font-black cursor-pointer shadow"
              >
                CONFIRM ACTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-display font-black text-slate-950 dark:text-amber-500 uppercase tracking-wide flex items-center gap-2">
            <span>BATTALION CAMPS REGISTRY</span>
          </h2>
          <p className="text-xs text-slate-500 font-mono font-medium uppercase">
            Manage active military training camps, venues, and centralized participant rosters.
          </p>
        </div>
        {!showForm && (
          <button
            id="create-camp-btn"
            onClick={() => {
              handleCancelEdit();
              setShowForm(true);
            }}
            className="inline-flex items-center space-x-2 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded text-xs font-mono font-bold uppercase transition shadow cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>CREATE CAMP REGISTRY</span>
          </button>
        )}
      </div>

      {/* Editor Form */}
      {showForm && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border-2 border-amber-500/40 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest">
              {editingCamp ? `// UPDATE CAMP ENTRY: ${editingCamp.id}` : "// ESTABLISH NEW CAMP ENTRY"}
            </span>
            <button
              onClick={() => {
                setShowForm(false);
                handleCancelEdit();
              }}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handlePublishOrUpdate} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Camp Official Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Central Command Drills Camp 2026"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded py-2 px-3 w-full text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Location / Venue</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Savar Cantonment, Dhaka"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded py-2 px-3 w-full text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Commencement Date</label>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded py-2 px-3 w-full text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Completion Date</label>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded py-2 px-3 w-full text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Operational description / Agenda</label>
              <textarea
                required
                rows={3}
                placeholder="Describe tactical maneuvers, shooting instructions, specialized regiment modules, or camp logistics..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded py-2 px-3 w-full text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  handleCancelEdit();
                }}
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-mono text-xs font-bold px-4 py-2 rounded uppercase cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono text-xs font-bold px-5 py-2 rounded uppercase cursor-pointer shadow"
              >
                {editingCamp ? "COMMIT UPDATE" : "PUBLISH REGISTRY"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Database List */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Controls Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by camp name, venue, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Filter by Timeline Status */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-slate-400 uppercase text-[10px]">Filter:</span>
              {(["All", "Upcoming", "Ongoing", "Completed"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                    statusFilter === filter
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            {/* Sorting Toggles */}
            <div className="flex items-center space-x-2">
              <span className="font-mono text-slate-400 uppercase text-[10px]">Sort by:</span>
              <button
                onClick={() => {
                  if (sortBy === "name") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("name");
                    setSortOrder("asc");
                  }
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase border flex items-center space-x-1 ${
                  sortBy === "name" 
                    ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                    : "border-slate-200 dark:border-slate-800 text-slate-500"
                }`}
              >
                <span>Camp Name</span>
                <ArrowUpDown className="h-3 w-3" />
              </button>
              <button
                onClick={() => {
                  if (sortBy === "startDate") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("startDate");
                    setSortOrder("desc");
                  }
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase border flex items-center space-x-1 ${
                  sortBy === "startDate" 
                    ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                    : "border-slate-200 dark:border-slate-800 text-slate-500"
                }`}
              >
                <span>Commencement</span>
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </div>

            {/* Selection & Bulk actions count */}
            <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-500">
              <span>{filteredCamps.length} camp records found</span>
              {selectedIds.length > 0 && (
                <div className="flex items-center space-x-1.5">
                  <span className="text-amber-500 font-bold">({selectedIds.length} Selected)</span>
                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[9px] uppercase font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <Trash className="h-2.5 w-2.5" />
                    <span>BULK DELETE</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* List Content */}
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-5 bg-slate-300 dark:bg-slate-800 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-300 dark:bg-slate-800 rounded w-16"></div>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
              </div>
            ))}
          </div>
        ) : paginatedCamps.length === 0 ? (
          <div className="py-16 text-center text-slate-500 italic text-xs font-mono">
            NO BATTALION CAMP RECORDS FOUND MATCHING SPECIFIED CRITERIA.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {/* Header selection trigger bar */}
            <div className="bg-slate-100/50 dark:bg-slate-900/40 p-3 px-5 flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                checked={paginatedCamps.length > 0 && paginatedCamps.every((c) => selectedIds.includes(c.id))}
                onChange={handleToggleSelectAll}
                className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
              />
              <span className="font-mono text-[10px] text-slate-500 uppercase font-semibold">Select All On Page</span>
            </div>

            {paginatedCamps.map((camp) => {
              const isSelected = selectedIds.includes(camp.id);
              const pCount = campParticipants.filter((cp) => cp.campId === camp.id).length;

              return (
                <div 
                  key={camp.id} 
                  className={`p-5 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isSelected ? "bg-amber-500/5 border-l-2 border-amber-500" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(camp.id)}
                      className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 mt-1 cursor-pointer"
                    />
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono text-[9px] uppercase font-bold">
                          {camp.id}
                        </span>
                        <h3 className="font-display font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {camp.name}
                        </h3>
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded font-mono text-[10px] font-bold">
                          {pCount} Participant{pCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
                        <span className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          <span>{camp.location}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          <span>{camp.startDate} to {camp.endDate}</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                        {camp.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                    {/* MANAGE PARTICIPANTS ACTION */}
                    <button
                      onClick={() => handleOpenManageParticipants(camp)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono text-xs font-bold uppercase rounded transition cursor-pointer shadow-sm"
                      title="Manage Camp Participants"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>MANAGE PARTICIPANTS ({pCount})</span>
                    </button>

                    <button
                      onClick={() => handleDuplicate(camp)}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-500/10 hover:text-blue-500 text-slate-600 dark:text-slate-400 rounded transition cursor-pointer"
                      title="Duplicate Registry (Copy)"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(camp)}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/10 hover:text-amber-500 text-slate-600 dark:text-slate-400 rounded transition cursor-pointer"
                      title="Edit Camp details"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(camp.id, camp.name)}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-slate-600 dark:text-slate-400 rounded transition cursor-pointer"
                      title="Permanently Delete Camp"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center space-x-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1 rounded bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------------- */}
      {/* MANAGE CAMP PARTICIPANTS MODAL / PANEL */}
      {/* ----------------------------------------------------------------------- */}
      {managingCamp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-xl w-full max-w-5xl my-auto shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-950 p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-mono text-[9px] uppercase font-bold">
                    CAMP ID: {managingCamp.id}
                  </span>
                  <span className="text-slate-400 font-mono text-xs">
                    ({managingCamp.startDate} to {managingCamp.endDate})
                  </span>
                </div>
                <h3 className="text-lg font-display font-black text-amber-500 uppercase tracking-wide mt-1">
                  MANAGE PARTICIPANTS — {managingCamp.name}
                </h3>
                <p className="text-xs text-slate-400 font-mono flex items-center space-x-1 mt-0.5">
                  <MapPin className="h-3 w-3 text-slate-500" />
                  <span>Venue: {managingCamp.location}</span>
                </p>
              </div>

              <button
                onClick={handleCloseManageParticipants}
                className="self-end sm:self-center text-slate-400 hover:text-white p-1.5 bg-slate-800 hover:bg-slate-700 rounded transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Camp Metrics & Summary Bar */}
            <div className="bg-slate-900/90 p-4 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[9px] font-mono text-slate-400 uppercase block">Total Assigned Participants</span>
                <span className="text-xl font-display font-black text-amber-400 mt-0.5 block">
                  {currentCampParticipants.length} Personnel
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[9px] font-mono text-slate-400 uppercase block">Role Distribution</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.keys(roleDistribution).length === 0 ? (
                    <span className="text-xs text-slate-500 italic">No roles assigned</span>
                  ) : (
                    Object.entries(roleDistribution).map(([role, count]) => (
                      <span key={role} className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-300 font-bold">
                        {role}: {count}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[9px] font-mono text-slate-400 uppercase block">Earned Achievements / Medals</span>
                <span className="text-xl font-display font-black text-emerald-400 mt-0.5 block">
                  ★ {totalEarnedAwards} Honor Record{totalEarnedAwards !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Sub Tabs Bar */}
            <div className="bg-slate-950 px-4 pt-3 border-b border-slate-800 flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setParticipantsSubTab("list")}
                className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition cursor-pointer flex items-center space-x-1.5 ${
                  participantsSubTab === "list"
                    ? "bg-slate-900 text-amber-400 border-t-2 border-x border-amber-500/60"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>CURRENT PARTICIPANTS ({currentCampParticipants.length})</span>
              </button>

              <button
                onClick={() => setParticipantsSubTab("add")}
                className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded-t-lg transition cursor-pointer flex items-center space-x-1.5 ${
                  participantsSubTab === "add"
                    ? "bg-slate-900 text-amber-400 border-t-2 border-x border-amber-500/60"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>ASSIGN NEW PARTICIPANTS</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* TAB 1: CURRENT PARTICIPANTS LIST */}
              {participantsSubTab === "list" && (
                <div className="space-y-4">
                  {currentCampParticipants.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 font-mono text-xs italic bg-slate-950/50 rounded-lg border border-slate-800">
                      NO CADETS OR ALUMNI CURRENTLY ASSIGNED TO THIS CAMP. CLICK "ASSIGN NEW PARTICIPANTS" TO ADD CADETS.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid divide-y divide-slate-800 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                        {currentCampParticipants.map((cp) => {
                          const memberDoc = members.find((m) => m.id === cp.memberId);
                          const isEditingThis = editingParticipantId === cp.id;

                          return (
                            <div key={cp.id} className="p-4 hover:bg-slate-900/60 transition space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center space-x-3">
                                  {memberDoc?.photoUrl ? (
                                    <img
                                      src={memberDoc.photoUrl}
                                      alt={memberDoc.fullName}
                                      className="w-10 h-10 rounded object-cover border border-slate-700 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                                      <Shield className="h-5 w-5 text-slate-500" />
                                    </div>
                                  )}

                                  <div>
                                    <div className="flex items-center space-x-2 flex-wrap">
                                      <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-bold uppercase">
                                        {cp.memberId}
                                      </span>
                                      <h4 className="font-display font-bold text-slate-100 text-sm">
                                        {memberDoc?.fullName || "Unregistered Member"}
                                      </h4>
                                      <span className="text-xs text-amber-500 font-mono font-bold">
                                        ({memberDoc?.rank || "Cadet"})
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                      Batch / Session: {memberDoc?.joiningYear || memberDoc?.session || "N/A"} | Dept: {memberDoc?.department || "General"}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                                  {!isEditingThis && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingParticipantId(cp.id);
                                          setEditRole(cp.role || "Participant");
                                          setEditAwards(cp.awards || "");
                                          setEditRemarks(cp.remarks || "");
                                        }}
                                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-mono text-[10px] uppercase font-bold flex items-center space-x-1 cursor-pointer"
                                      >
                                        <Edit className="h-3 w-3 text-amber-400" />
                                        <span>EDIT DETAILS</span>
                                      </button>
                                      <button
                                        onClick={() => handleRemoveParticipant(cp.id, memberDoc?.fullName || cp.memberId)}
                                        className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 rounded font-mono text-[10px] uppercase font-bold flex items-center space-x-1 cursor-pointer"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                        <span>REMOVE</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Details view or Edit mode */}
                              {!isEditingThis ? (
                                <div className="bg-slate-900/80 p-3 rounded border border-slate-800 text-xs space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">Role in Camp:</span>
                                    <span className="font-mono text-amber-400 font-bold">{cp.role || "Participant"}</span>
                                  </div>
                                  {cp.awards && (
                                    <div className="flex items-center space-x-2 text-emerald-400 font-mono">
                                      <Award className="h-3.5 w-3.5 shrink-0" />
                                      <span>Achievement / Medal: {cp.awards}</span>
                                    </div>
                                  )}
                                  {cp.remarks && (
                                    <p className="text-[11px] text-slate-400 font-sans italic">
                                      Remarks: {cp.remarks}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="bg-slate-900 p-3 rounded border-2 border-amber-500/40 space-y-3">
                                  <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
                                    // UPDATE PARTICIPANT ROLE & AWARDS
                                  </span>
                                  <div className="grid sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-mono text-slate-400 uppercase block font-bold">Role in Camp</label>
                                      <input
                                        type="text"
                                        value={editRole}
                                        onChange={(e) => setEditRole(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded py-1 px-2 w-full text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-mono text-slate-400 uppercase block font-bold">Achievement / Award</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. Best Platoon Leader"
                                        value={editAwards}
                                        onChange={(e) => setEditAwards(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded py-1 px-2 w-full text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[9px] font-mono text-slate-400 uppercase block font-bold">Remarks</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. Top marksman"
                                        value={editRemarks}
                                        onChange={(e) => setEditRemarks(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded py-1 px-2 w-full text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-end space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingParticipantId(null)}
                                      className="px-3 py-1 bg-slate-800 text-slate-300 rounded font-mono text-[10px] uppercase font-bold cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveParticipantEdit(cp.id)}
                                      className="px-3 py-1 bg-amber-500 text-slate-950 rounded font-mono text-[10px] uppercase font-black cursor-pointer shadow"
                                    >
                                      Save Update
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: ADD / ASSIGN NEW PARTICIPANTS */}
              {participantsSubTab === "add" && (
                <div className="space-y-5">
                  {/* Search & Filter Controls Panel */}
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                    <span className="text-[10px] font-mono text-amber-400 uppercase font-bold block">
                      // SEARCH & FILTER CANDIDATES FOR CAMP ASSIGNMENT
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Search Query */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search Member ID, Name..."
                          value={searchMemberQuery}
                          onChange={(e) => setSearchMemberQuery(e.target.value)}
                          className="pl-8 pr-3 py-1.5 w-full bg-slate-900 border border-slate-800 rounded text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Type Filter */}
                      <select
                        value={filterMemberType}
                        onChange={(e) => setFilterMemberType(e.target.value as any)}
                        className="bg-slate-900 border border-slate-800 rounded py-1.5 px-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                      >
                        <option value="All">Status: All Personnel</option>
                        <option value="Active">Active Cadets Only</option>
                        <option value="Alumni">Alumni Only</option>
                      </select>

                      {/* Batch Filter */}
                      <select
                        value={filterMemberBatch}
                        onChange={(e) => setFilterMemberBatch(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded py-1.5 px-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Filter by Batch (All)</option>
                        {memberBatches.map((b) => (
                          <option key={b} value={b}>Batch {b}</option>
                        ))}
                      </select>

                      {/* Rank Filter */}
                      <select
                        value={filterMemberRank}
                        onChange={(e) => setFilterMemberRank(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded py-1.5 px-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                      >
                        <option value="">Filter by Rank (All)</option>
                        {Object.values(BNCCRank).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Candidate Selection List */}
                  <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden space-y-2 p-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 px-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            if (selectedMemberIdsForCamp.length === availableMembers.length && availableMembers.length > 0) {
                              setSelectedMemberIdsForCamp([]);
                            } else {
                              setSelectedMemberIdsForCamp(availableMembers.map((m) => m.id));
                            }
                          }}
                          className="font-mono text-xs text-slate-300 hover:text-amber-400 flex items-center space-x-1.5 cursor-pointer font-bold"
                        >
                          {selectedMemberIdsForCamp.length > 0 && selectedMemberIdsForCamp.length === availableMembers.length ? (
                            <CheckSquare className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-500" />
                          )}
                          <span>Select All Available ({availableMembers.length})</span>
                        </button>
                      </div>

                      <span className="font-mono text-xs text-amber-400 font-bold">
                        {selectedMemberIdsForCamp.length} Selected
                      </span>
                    </div>

                    {availableMembers.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 font-mono text-xs italic">
                        NO CANDIDATES MATCHING SPECIFIED CRITERIA AVAILABLE FOR ASSIGNMENT.
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 pr-1">
                        {availableMembers.map((member) => {
                          const isChecked = selectedMemberIdsForCamp.includes(member.id);

                          return (
                            <label
                              key={member.id}
                              className={`p-2.5 rounded flex items-center justify-between gap-3 cursor-pointer transition ${
                                isChecked ? "bg-amber-500/10 border-l-2 border-amber-500" : "hover:bg-slate-900"
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedMemberIdsForCamp((prev) => prev.filter((id) => id !== member.id));
                                    } else {
                                      setSelectedMemberIdsForCamp((prev) => [...prev, member.id]);
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                                />

                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded font-bold">
                                      {member.id}
                                    </span>
                                    <span className="text-xs font-display font-bold text-slate-100">
                                      {member.fullName}
                                    </span>
                                    <span className="text-[10px] text-amber-500 font-mono font-bold">
                                      ({member.rank})
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-mono block">
                                    Batch: {member.joiningYear || member.session || "N/A"} | Dept: {member.department || "N/A"}
                                  </span>
                                </div>
                              </div>

                              <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                                member.status === MemberStatus.ACTIVE_CADET
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              }`}>
                                {member.status === MemberStatus.ACTIVE_CADET ? "Active Cadet" : "Alumni"}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Assignment Parameters Form */}
                  {selectedMemberIdsForCamp.length > 0 && (
                    <div className="bg-slate-950 p-4 rounded-lg border-2 border-amber-500/40 space-y-4">
                      <span className="text-xs font-mono font-bold text-amber-400 uppercase block">
                        // CONFIGURE ASSIGNMENT PARAMETERS FOR {selectedMemberIdsForCamp.length} SELECTED MEMBER(S)
                      </span>

                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Role in Camp</label>
                          <select
                            value={assignRole}
                            onChange={(e) => setAssignRole(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded py-1.5 px-3 w-full text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                          >
                            <option value="Participant">Participant (Standard)</option>
                            <option value="Platoon Commander">Platoon Commander</option>
                            <option value="Section Commander">Section Commander</option>
                            <option value="Squad Lead">Squad Lead</option>
                            <option value="Other">Other Custom Appointment</option>
                          </select>

                          {assignRole === "Other" && (
                            <input
                              type="text"
                              required
                              placeholder="Enter custom role title..."
                              value={customRoleInput}
                              onChange={(e) => setCustomRoleInput(e.target.value)}
                              className="mt-2 bg-slate-900 border border-slate-800 rounded py-1.5 px-3 w-full text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                            />
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Achievements / Awards (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Best Air Rifles Marksman, Best Cadet Commander"
                            value={assignAwards}
                            onChange={(e) => setAssignAwards(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded py-1.5 px-3 w-full text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block font-bold">Remarks / Notes (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Pass B-certificate drills exam"
                            value={assignRemarks}
                            onChange={(e) => setAssignRemarks(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded py-1.5 px-3 w-full text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          disabled={submittingParticipants}
                          onClick={handleAssignSelectedMembers}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono text-xs font-black px-6 py-2 rounded uppercase cursor-pointer shadow flex items-center space-x-2 disabled:opacity-50"
                        >
                          {submittingParticipants ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>COMMITTING ASSIGNMENT...</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4" />
                              <span>CONFIRM ASSIGNMENT ({selectedMemberIdsForCamp.length})</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={handleCloseManageParticipants}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs font-bold px-5 py-2 rounded uppercase cursor-pointer"
              >
                CLOSE MANAGE PARTICIPANTS
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
