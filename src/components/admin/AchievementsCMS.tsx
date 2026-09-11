import React from "react";
import { 
  Plus, Award, Trash2, Edit, Search, ArrowUpDown, ChevronLeft, ChevronRight, 
  Copy, X, AlertTriangle, ShieldCheck, Filter 
} from "lucide-react";
import { Member } from "../../types";
import { subscribeToCollection, createDocument, updateDocument, softDeleteRecord, generateId } from "../../firebaseService";
import { auth } from "../../firebase";

interface AchievementsCMSProps {
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

export default function AchievementsCMS({ members, onRefresh }: AchievementsCMSProps) {
  const [awards, setAwards] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingAward, setEditingAward] = React.useState<any | null>(null);

  // Filters, search, pagination, and sorting
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("All");
  const [medalFilter, setMedalFilter] = React.useState("All");
  const [sortBy, setSortBy] = React.useState<"date" | "title" | "medalType">("date");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(6);

  // Custom Toast & Confirmation dialog
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  // Form State
  const [form, setForm] = React.useState({
    title: "",
    description: "",
    date: "",
    category: "Competition",
    recipient: "",
    medalType: "Gold",
    issuedBy: "Ramna Regiment Command Center, BNCC",
    memberId: "",
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
    const unsub = subscribeToCollection<any>("achievements", (data) => {
      setAwards(data);
      setSelectedIds([]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleStartEdit = (award: any) => {
    setEditingAward(award);
    setForm({
      title: award.title,
      description: award.description,
      date: award.date || "",
      category: award.category || "Competition",
      recipient: award.recipient || "",
      medalType: award.medalType || "Gold",
      issuedBy: award.issuedBy || "Ramna Regiment Command Center",
      memberId: award.recipientId || award.cadetId || "",
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingAward(null);
    setForm({
      title: "",
      description: "",
      date: "",
      category: "Competition",
      recipient: "",
      medalType: "Gold",
      issuedBy: "Ramna Regiment Command Center, BNCC",
      memberId: "",
    });
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.date) {
      showToast("Missing required award fields.", "error");
      return;
    }

    // Attempt to auto-fill recipient from selected member
    let finalRecipient = form.recipient;
    if (form.memberId) {
      const match = members.find((m) => m.id === form.memberId);
      if (match) {
        finalRecipient = `${match.rank} ${match.fullName}`;
      }
    }

    try {
      const awardData = {
        ...form,
        recipient: finalRecipient || "Platoon Squad",
        recipientId: form.memberId || "",
        cadetId: form.memberId || "",
        memberId: form.memberId || "",
      };

      if (editingAward) {
        await updateDocument("achievements", editingAward.id, awardData);
        showToast(`Accolade "${form.title}" successfully updated!`, "success");
      } else {
        const id = generateId("ach");
        await createDocument("achievements", {
          ...awardData,
          id,
        }, id);
        showToast(`Accolade "${form.title}" committed successfully!`, "success");
      }
      handleCancelEdit();
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = (id: string, title: string) => {
    setConfirmDialog({
      title: "Soft Delete Accolade",
      message: `Are you sure you want to move achievement "${title}" to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          const awardToDel = awards.find(a => a.id === id);
          if (awardToDel) {
            await softDeleteRecord("achievements", id, title, awardToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            showToast(`Moved "${title}" to Recycle Bin`, "success");
            setSelectedIds((prev) => prev.filter((item) => item !== id));
            onRefresh();
          }
        } catch (err: any) {
          showToast(err.message, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleDuplicate = async (award: any) => {
    try {
      const id = generateId("ach");
      const duplicatedData = {
        ...award,
        id,
        title: `${award.title} (Copy)`,
      };
      await createDocument("achievements", duplicatedData, id);
      showToast(`Duplicated accolade "${award.title}" successfully`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Soft Delete Accolades",
      message: `Are you sure you want to move the ${selectedIds.length} selected accolades to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          let count = 0;
          for (const id of selectedIds) {
            const awardToDel = awards.find(a => a.id === id);
            if (awardToDel) {
              await softDeleteRecord("achievements", id, awardToDel.title, awardToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
              count++;
            }
          }
          showToast(`Successfully moved ${count} achievements to Recycle Bin`, "success");
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

  const getRecipientName = (ach: any) => {
    const mId = ach.recipientId || ach.memberId || ach.cadetId;
    if (mId) {
      const match = members.find((m) => m.id === mId || (m as any).cadetId === mId);
      if (match) {
        return `${match.rank || 'Cadet'} ${match.fullName}`.trim();
      }
    }
    return ach.recipient || "Cadet Personnel";
  };

  // Filter & Search Logic
  const filteredAwards = awards.filter((ach) => {
    const s = searchTerm.toLowerCase();
    const recipientName = getRecipientName(ach);
    const matchesSearch = 
      ach.title.toLowerCase().includes(s) ||
      ach.description.toLowerCase().includes(s) ||
      recipientName.toLowerCase().includes(s) ||
      (ach.recipient && ach.recipient.toLowerCase().includes(s));

    if (!matchesSearch) return false;

    if (categoryFilter !== "All" && ach.category !== categoryFilter) {
      return false;
    }

    if (medalFilter !== "All" && ach.medalType !== medalFilter) {
      return false;
    }

    return true;
  });

  // Sort Logic
  const sortedAwards = [...filteredAwards].sort((a, b) => {
    let comp = 0;
    if (sortBy === "title") {
      comp = a.title.localeCompare(b.title);
    } else if (sortBy === "medalType") {
      comp = (a.medalType || "").localeCompare(b.medalType || "");
    } else {
      const dateA = a.date || "";
      const dateB = b.date || "";
      comp = dateA.localeCompare(dateB);
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Pagination Bounds
  const totalItems = sortedAwards.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedAwards = sortedAwards.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, medalFilter, sortBy, sortOrder]);

  const handleToggleSelectAll = () => {
    const pageIds = paginatedAwards.map((item) => item.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  return (
    <div id="achievements-cms-panel" className="space-y-6 text-xs relative">
      {/* Floating Toast alerts */}
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

      {/* CMS Header panel */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center space-x-2">
            <Award className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>Achievements & Accolades Ledger System</span>
          </h3>
          <p className="text-slate-400 text-[10px] mt-0.5 uppercase font-mono">
            Log shooting trophies, parade decorations, exemplary drill ribbon awards, and connect them to cadet portfolios.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white font-mono font-bold uppercase px-3 py-2 rounded text-[9px] flex items-center space-x-1 cursor-pointer transition-all"
            >
              <Trash2 className="h-3 w-3" />
              <span>Bulk Delete ({selectedIds.length})</span>
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
            <span>{showForm ? "Hide Form" : "RECORD EXPLOIT / AWARD"}</span>
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Achievements list & Controls block */}
        <div className={`space-y-4 ${showForm ? "lg:col-span-2" : "lg:col-span-3"}`}>
          
          {/* Controls Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search accolades by title, description or recipient name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-slate-400 uppercase text-[9px]">Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 p-1 rounded font-mono text-[10px]"
                  >
                    <option value="All">All Categories</option>
                    <option value="Competition">Parade Competition</option>
                    <option value="Drill">Silent Drill</option>
                    <option value="Shooting">🎯 Target Shooting</option>
                    <option value="Community Service">Community deployment</option>
                    <option value="Leadership">Exemplary Leadership</option>
                  </select>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="font-mono text-slate-400 uppercase text-[9px]">Medal:</span>
                  <select
                    value={medalFilter}
                    onChange={(e) => setMedalFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 p-1 rounded font-mono text-[10px]"
                  >
                    <option value="All">All Medals</option>
                    <option value="Gold">Gold Medal</option>
                    <option value="Silver">Silver Medal</option>
                    <option value="Bronze">Bronze Medal</option>
                    <option value="Honor">Honor Commendation</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-850 pt-3">
              {/* Sort by controls */}
              <div className="flex items-center space-x-2">
                <span className="font-mono text-slate-400 uppercase text-[10px]">Sort by:</span>
                <button
                  onClick={() => {
                    if (sortBy === "title") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("title");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "title" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Title</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "date") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("date");
                      setSortOrder("desc");
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "date" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Award Date</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </div>

              <div className="text-[10px] font-mono text-slate-400 uppercase">
                Showing {sortedAwards.length} of {awards.length} listed honors
              </div>
            </div>
          </div>

          {/* Bulk Select All bar inside grid */}
          {paginatedAwards.length > 0 && (
            <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between font-mono text-[10px]">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paginatedAwards.every((item) => selectedIds.includes(item.id))}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-slate-600 dark:text-slate-300 font-bold">SELECT ALL ON THIS PAGE</span>
              </label>
              <span className="text-slate-400">PAGE {currentPage} OF {totalPages}</span>
            </div>
          )}

          {/* Accolades Card Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3 animate-pulse">
                  <div className="flex justify-between items-center">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-10"></div>
                  </div>
                  <div className="h-5 bg-slate-300 dark:bg-slate-800 rounded w-2/3"></div>
                  <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : paginatedAwards.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 font-mono text-xs shadow-sm">
              NO PRE-LOGGED ACCOLADES RECORDED WITH THIS SELECTION.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paginatedAwards.map((ach) => {
                const isSelected = selectedIds.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                      isSelected 
                        ? "border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/5 dark:bg-amber-950/5" 
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(ach.id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                          />
                          <span className={`inline-block px-1.5 py-0.5 rounded uppercase font-bold text-[9px] font-mono border ${
                            ach.medalType === "Gold" 
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                              : ach.medalType === "Silver"
                              ? "bg-slate-300/10 text-slate-400 border-slate-300/20"
                              : ach.medalType === "Bronze"
                              ? "bg-amber-750/10 text-amber-700 border-amber-700/20"
                              : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          }`}>
                            {ach.medalType || "Gold"} | {ach.category}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handleDuplicate(ach)}
                            className="text-slate-400 hover:text-blue-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            title="Duplicate Accolade Entry"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleStartEdit(ach)}
                            className="text-slate-400 hover:text-amber-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            title="Edit achievement details"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(ach.id, ach.title)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            title="Move achievement to Recycle Bin"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-display font-bold text-slate-900 dark:text-white text-xs leading-snug">
                        {ach.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-500 inline" />
                        <span>Recipient: {getRecipientName(ach)}</span>
                        {ach.cadetId && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded text-[8px] text-amber-500">LINKED</span>}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans font-light leading-relaxed">
                        {ach.description}
                      </p>
                    </div>

                    <div className="text-[9px] font-mono text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-850 mt-3 uppercase">
                      Issued: {ach.date} | By: {ach.issuedBy}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls Footer */}
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
        </div>

        {/* Accolade Form sidebar panel */}
        {showForm && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                {editingAward ? "UPDATE LEDGER EXPLOIT" : "RECORD ACCOLADE"}
              </h4>
              <button
                onClick={handleCancelEdit}
                className="text-red-500 hover:text-red-600 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer"
              >
                [Cancel]
              </button>
            </div>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Accolade / Trophy Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Best Drill Squad Trophy"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Medal Type</label>
                  <select
                    value={form.medalType}
                    onChange={(e) => setForm({ ...form, medalType: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="Gold">Gold Medal</option>
                    <option value="Silver">Silver Medal</option>
                    <option value="Bronze">Bronze Medal</option>
                    <option value="Honor">Honor Commendation</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Accolade Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="Competition">Parade Competition</option>
                    <option value="Drill">Silent drill choreography</option>
                    <option value="Shooting">🎯 Target Shooting practice</option>
                    <option value="Community Service">Community deployment</option>
                    <option value="Leadership">Exemplary Leadership</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Award Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Link Active Cadet (Recommended)</label>
                  <select
                    value={form.memberId}
                    onChange={(e) => setForm({ ...form, memberId: e.target.value, recipient: e.target.value ? "" : form.recipient })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-750 dark:text-slate-350 focus:outline-none"
                  >
                    <option value="">-- Manual entry instead --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.rank})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!form.memberId && (
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Recipient Manual Name</label>
                  <input
                    type="text"
                    placeholder="e.g., UGC Platoon Drill Squad"
                    value={form.recipient}
                    onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Awarding Authority</label>
                <input
                  type="text"
                  required
                  value={form.issuedBy}
                  onChange={(e) => setForm({ ...form, issuedBy: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Award description / Achievement details</label>
                <textarea
                  required
                  placeholder="Explain details of the competition, Cadet achievements, or points scored..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-20 resize-none"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-black uppercase py-2 rounded text-[10px] tracking-wider transition-all cursor-pointer"
                >
                  {editingAward ? "SAVE CHANGES" : "COMMIT LEDGER EXPLOIT"}
                </button>
                {editingAward && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-black uppercase px-3 py-2 text-[10px] tracking-wider transition-all cursor-pointer rounded"
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
