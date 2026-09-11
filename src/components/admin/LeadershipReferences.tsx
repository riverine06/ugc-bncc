import React from "react";
import { 
  Plus, Trash2, ArrowUpDown, ShieldAlert, Check, Copy, X, Search, 
  ChevronLeft, ChevronRight, AlertTriangle, ShieldCheck, Edit 
} from "lucide-react";
import { Member, LeadershipReference } from "../../types";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument, generateId } from "../../firebaseService";

interface LeadershipReferencesProps {
  members: Member[];
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

export default function LeadershipReferences({ members, onRefresh }: LeadershipReferencesProps) {
  const [refs, setRefs] = React.useState<LeadershipReference[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingRef, setEditingRef] = React.useState<LeadershipReference | null>(null);

  // Filters, search, pagination, sorting, selections
  const [searchTerm, setSearchTerm] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("All");
  const [sortBy, setSortBy] = React.useState<"displayOrder" | "position" | "cadetName">("displayOrder");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Toasts & Confirmation dialogues state
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  // Form State
  const [form, setForm] = React.useState({
    memberId: "",
    position: "",
    displayOrder: "10",
    roleType: "platoon_commander",
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
    const unsub = subscribeToCollection<any>("leadership", (data) => {
      setRefs(data);
      setSelectedIds([]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Resolve cadet name from memberId / cadetId
  const getCadetName = (id: string) => {
    const m = members.find((member) => member.id === id);
    return m ? `${m.rank} ${m.fullName}` : `ID: ${id}`;
  };

  const handleStartEdit = (ref: LeadershipReference) => {
    setEditingRef(ref);
    setForm({
      memberId: ref.memberId || ref.cadetId || "",
      position: ref.position,
      displayOrder: String(ref.displayOrder),
      roleType: ref.roleType || "platoon_commander",
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingRef(null);
    setForm({ memberId: "", position: "", displayOrder: "10", roleType: "platoon_commander" });
  };

  const handleAddOrUpdateRef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId || !form.position) {
      showToast("Please select a cadet and specify their command position.", "error");
      return;
    }

    try {
      if (editingRef) {
        const refData = {
          ...editingRef,
          cadetId: form.memberId,
          memberId: form.memberId,
          position: form.position,
          displayOrder: Number(form.displayOrder),
          roleType: form.roleType,
        };
        await createDocument("leadership", refData, editingRef.id);
        showToast(`Command role "${form.position}" updated successfully!`, "success");
      } else {
        const id = generateId("ldr");
        const refData = {
          id,
          cadetId: form.memberId,
          memberId: form.memberId,
          position: form.position,
          displayOrder: Number(form.displayOrder),
          roleType: form.roleType,
          status: "active",
          appointmentDate: new Date().toISOString().split("T")[0],
        };
        await createDocument("leadership", refData, id);
        showToast(`Leadership position "${form.position}" committed successfully!`, "success");
      }

      // Sync Platoon Commander to Homepage document if applicable
      if (form.roleType === "platoon_commander" || form.position.toLowerCase().includes("commander")) {
        const member = members.find((m) => m.id === form.memberId);
        if (member) {
          try {
            await updateDocument("homepage", "main", {
              commanderName: member.fullName,
              commanderRank: form.position || member.rank || "Platoon Commander",
              commanderPhoto: member.photoUrl || "",
              ...(member.biography ? { commanderMessage: member.biography } : {})
            });
          } catch (err) {
            console.warn("Homepage document sync notice:", err);
          }
        }
      }

      handleCancelEdit();
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleRemoveRef = (id: string, position: string) => {
    setConfirmDialog({
      title: "Revoke Command Assignment",
      message: `Are you sure you want to revoke assignment "${position}"? This is irreversible.`,
      onConfirm: async () => {
        try {
          await deleteDocument("leadership", id);
          showToast(`Successfully revoked command position "${position}"`, "success");
          setSelectedIds((prev) => prev.filter((item) => item !== id));
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleDuplicate = async (ref: LeadershipReference) => {
    try {
      const id = generateId("ldr");
      const duplicatedData = {
        ...ref,
        id,
        position: `${ref.position} (Duplicate)`,
        displayOrder: ref.displayOrder + 1,
      };
      await createDocument("leadership", duplicatedData, id);
      showToast(`Duplicated assignment "${ref.position}"`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleBulkRevoke = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Revoke Assignments",
      message: `Are you sure you want to revoke the ${selectedIds.length} selected command assignments?`,
      onConfirm: async () => {
        try {
          let count = 0;
          for (const id of selectedIds) {
            await deleteDocument("leadership", id);
            count++;
          }
          showToast(`Successfully revoked ${count} command positions`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Filter & Search Logic
  const filteredRefs = refs.filter((r) => {
    const s = searchTerm.toLowerCase();
    const name = getCadetName(r.memberId || r.cadetId || "").toLowerCase();
    const pos = (r.position || "").toLowerCase();
    const matchesSearch = name.includes(s) || pos.includes(s) || r.id.includes(s);

    if (!matchesSearch) return false;

    if (roleFilter !== "All" && r.roleType !== roleFilter) {
      return false;
    }

    return true;
  });

  // Sort Logic
  const sortedRefs = [...filteredRefs].sort((a, b) => {
    let comp = 0;
    if (sortBy === "position") {
      comp = (a.position || "").localeCompare(b.position || "");
    } else if (sortBy === "cadetName") {
      const nameA = getCadetName(a.memberId || a.cadetId || "");
      const nameB = getCadetName(b.memberId || b.cadetId || "");
      comp = nameA.localeCompare(nameB);
    } else {
      comp = (a.displayOrder || 0) - (b.displayOrder || 0);
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Pagination Bounds
  const totalItems = sortedRefs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRefs = sortedRefs.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, sortBy, sortOrder]);

  const handleToggleSelectAll = () => {
    const pageIds = paginatedRefs.map((item) => item.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  return (
    <div id="leadership-references-panel" className="space-y-6 text-xs relative">
      {/* Floating Toast notification alerts */}
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

      {/* Confirmation Dialog Overlay */}
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
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CMS Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>Platoon Command structure (HQ)</span>
          </h3>
          <p className="text-slate-400 text-[10px] mt-0.5 uppercase font-mono">
            Assign active/faculty cadets to official command leadership ranks and display priority.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end font-mono">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkRevoke}
              className="bg-red-600 hover:bg-red-700 text-white font-mono font-bold uppercase px-3 py-2 rounded text-[9px] flex items-center space-x-1 cursor-pointer transition-all"
            >
              <Trash2 className="h-3 w-3" />
              <span>Bulk Revoke ({selectedIds.length})</span>
            </button>
          )}
          <button
            onClick={() => {
              if (showForm) {
                handleCancelEdit();
              }
              setShowForm(!showForm);
            }}
            className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-extrabold uppercase px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer text-[10px]"
          >
            <Plus className="h-4 w-4" />
            <span>{showForm ? "Hide Form" : "ASSIGN NEW POSITION"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Command roster list */}
        <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${showForm ? "lg:col-span-2" : "lg:col-span-3"}`}>
          
          {/* Controls bar inside card */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search assignments by cadet name or role title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded text-[11px] focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Filtering */}
              <div className="flex items-center space-x-1 shrink-0">
                <span className="font-mono text-slate-400 text-[9px] uppercase">Group:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-1 rounded font-mono text-[10px] text-slate-700 dark:text-slate-300"
                >
                  <option value="All">All Roles</option>
                  <option value="platoon_commander">Platoon Commanders</option>
                  <option value="platoon_in_charge">Platoon In charge</option>
                  <option value="section_leader">Section Leaders</option>
                  <option value="section_2ic">2nd In Command</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200/50 dark:border-slate-800/50 pt-2.5">
              {/* Sorting */}
              <div className="flex items-center space-x-2">
                <span className="font-mono text-slate-400 uppercase text-[9px]">Sort by:</span>
                <button
                  onClick={() => {
                    if (sortBy === "displayOrder") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("displayOrder");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "displayOrder" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Priority Order</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "cadetName") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("cadetName");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "cadetName" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Cadet Name</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </div>

              <div className="text-[9px] font-mono text-slate-400">
                Displaying {sortedRefs.length} of {refs.length} active roles
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg animate-pulse"></div>
                ))}
              </div>
            ) : paginatedRefs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-mono text-[11px]">
                NO ACTIVE SECURE COMMAND ASSIGNMENTS DEFINED WITH CURRENT SELECTION.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-850 text-slate-400 uppercase tracking-wider font-mono text-[9px]">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={paginatedRefs.every((r) => selectedIds.includes(r.id))}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                      />
                    </th>
                    <th className="p-3">Cadet</th>
                    <th className="p-3">Command Position</th>
                    <th className="p-3">Role Group</th>
                    <th className="p-3">Display Priority</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedRefs.map((r) => {
                    const isSelected = selectedIds.includes(r.id);
                    return (
                      <tr key={r.id} className={`hover:bg-slate-50/40 dark:hover:bg-slate-850/20 transition-colors ${isSelected ? "bg-amber-500/5" : ""}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(r.id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                          />
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                          {getCadetName(r.memberId || r.cadetId || "")}
                        </td>
                        <td className="p-3">
                          <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-[10px] px-2 py-0.5 rounded border border-amber-500/10 uppercase font-semibold">
                            {r.position}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-slate-500 dark:text-slate-400 capitalize">{r.roleType?.replace(/_/g, " ")}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                          {r.displayOrder}
                        </td>
                        <td className="p-3 text-right space-x-1 shrink-0">
                          <button
                            onClick={() => handleDuplicate(r)}
                            className="text-slate-400 hover:text-blue-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Duplicate Assignment Entry"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleStartEdit(r)}
                            className="text-slate-400 hover:text-amber-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit Assignment details"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveRef(r.id, r.position)}
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Revoke Command Assignment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shadow-sm">
              <span className="text-[10px] font-mono text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Assignment Form sidebar */}
        {showForm && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                {editingRef ? "UPDATE COMMISSION ROLE" : "NEW COMMAND ASSIGNMENT"}
              </h4>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-red-500 hover:text-red-600 font-mono text-[9px] font-bold uppercase cursor-pointer"
              >
                [Cancel]
              </button>
            </div>
            <form onSubmit={handleAddOrUpdateRef} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Select Platoon Cadet</label>
                <select
                  required
                  value={form.memberId}
                  onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-2.5 w-full text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="">-- Choose Cadet --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} ({m.rank} | {m.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Official Command Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Platoon Commander, Cadet Quartermaster"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Role Group</label>
                  <select
                    value={form.roleType}
                    onChange={(e) => setForm({ ...form, roleType: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-750 dark:text-slate-350 focus:outline-none"
                  >
                    <option value="platoon_commander">Platoon Commander</option>
                    <option value="platoon_in_charge">Platoon In charge</option>
                    <option value="section_leader">Section Leader</option>
                    <option value="section_2ic">2nd in command</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Display priority</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    placeholder="e.g., 10 (lowest priority display)"
                    value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-black uppercase py-2.5 rounded text-[10px] tracking-wider transition-all cursor-pointer"
              >
                {editingRef ? "SAVE ROLE CHANGES" : "COMMIT COMMISSION COMMAND"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
