import React from "react";
import { 
  Plus, Trash2, Pin, Calendar, AlertCircle, Edit, Search, 
  Download, FileSpreadsheet, Trash, Star, Filter, ArrowUpDown,
  ChevronLeft, ChevronRight, Check, Copy, X, AlertTriangle 
} from "lucide-react";
import { Announcement } from "../../types";
import { subscribeToCollection, createDocument, updateDocument, softDeleteRecord, generateId } from "../../firebaseService";
import { auth } from "../../firebase";

interface NoticeBoardCMSProps {
  onRefresh: () => void;
}

export default function NoticeBoardCMS({ onRefresh }: NoticeBoardCMSProps) {
  const [list, setList] = React.useState<Announcement[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingNotice, setEditingNotice] = React.useState<Announcement | null>(null);

  // Custom Toast & Confirmation
  const [toasts, setToasts] = React.useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<null | { title: string; message: string; onConfirm: () => void }>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Filters & Sorting state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("All");
  const [pinnedFilter, setPinnedFilter] = React.useState("All");
  const [sortBy, setSortBy] = React.useState("date"); // "date" | "title"
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");

  // Selection & Pagination
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(5);

  // Form State
  const [form, setForm] = React.useState({
    title: "",
    content: "",
    category: "General",
    pinned: false,
  });

  React.useEffect(() => {
    setLoading(true);
    const unsub = subscribeToCollection<Announcement>("notices", (data) => {
      setList(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleStartEdit = (notice: Announcement) => {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      category: notice.category || "General",
      pinned: !!notice.pinned,
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingNotice(null);
    setForm({
      title: "",
      content: "",
      category: "General",
      pinned: false,
    });
  };

  const handlePublishOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      showToast("Please provide a title and notice content.", "error");
      return;
    }

    try {
      if (editingNotice) {
        await updateDocument("notices", editingNotice.id, {
          ...form,
        });
        showToast("Notice successfully updated!", "success");
      } else {
        const id = generateId("not");
        await createDocument("notices", {
          ...form,
          id,
          date: new Date().toISOString().split("T")[0]
        }, id);
        showToast("Notice successfully published on the board!", "success");
      }
      handleCancelEdit();
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      showToast("Action failed: " + err.message, "error");
    }
  };

  const handleDuplicate = async (notice: Announcement) => {
    try {
      const id = generateId("not");
      const duplicateData = {
        ...notice,
        id,
        title: `${notice.title} (Copy)`,
        date: new Date().toISOString().split("T")[0]
      };
      await createDocument("notices", duplicateData, id);
      showToast(`Duplicated notice "${notice.title}" successfully`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = (id: string, title: string) => {
    setConfirmDialog({
      title: "Soft Delete Command Notice",
      message: `Are you sure you want to move notice "${title}" to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          const noticeToDel = list.find(n => n.id === id);
          if (noticeToDel) {
            await softDeleteRecord("notices", id, title, noticeToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            showToast(`Moved "${title}" to Recycle Bin`, "success");
            setSelectedIds((prev) => {
              const copy = new Set(prev);
              copy.delete(id);
              return copy;
            });
            onRefresh();
          }
        } catch (err: any) {
          showToast("Failed to delete notice: " + err.message, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredAndSortedList.map((n) => n.id));
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

  const handleBulkPin = (pinnedState: boolean) => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      title: "Bulk Pin notices",
      message: `Are you sure you want to modify PIN state to ${pinnedState ? "PINNED" : "UNPINNED"} for all ${selectedIds.size} selected notices?`,
      onConfirm: () => {
        const promises = (Array.from(selectedIds) as string[]).map((id) => {
          return updateDocument("notices", id, { pinned: pinnedState });
        });

        Promise.all(promises).then(() => {
          setSelectedIds(new Set());
          onRefresh();
          showToast("Selected notices priority status updated.", "success");
        }).catch((err) => showToast(err.message, "error"));
        setConfirmDialog(null);
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      title: "Bulk Soft Delete Notices",
      message: `Are you sure you want to move all ${selectedIds.size} selected notices to the Recycle Bin?`,
      onConfirm: () => {
        const promises = (Array.from(selectedIds) as string[]).map(async (id) => {
          const noticeToDel = list.find(n => n.id === id);
          if (noticeToDel) {
            return softDeleteRecord("notices", id, noticeToDel.title, noticeToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
          }
        });

        Promise.all(promises).then(() => {
          setSelectedIds(new Set());
          onRefresh();
          showToast("Selected notices successfully soft-deleted!", "success");
        }).catch((err) => showToast(err.message, "error"));
        setConfirmDialog(null);
      }
    });
  };

  const handleBulkSetCategory = (cat: string) => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      title: "Bulk Update Notice Category",
      message: `Are you sure you want to update category to "${cat}" for all ${selectedIds.size} selected notices?`,
      onConfirm: () => {
        const promises = (Array.from(selectedIds) as string[]).map((id) => {
          return updateDocument("notices", id, { category: cat });
        });

        Promise.all(promises).then(() => {
          setSelectedIds(new Set());
          onRefresh();
          showToast("Selected notices categorized successfully.", "success");
        }).catch((err) => showToast(err.message, "error"));
        setConfirmDialog(null);
      }
    });
  };

  // Export & download tools
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredAndSortedList, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bncc_notices_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Title", "Category", "Date Published", "Pinned Status", "Content"];
    const rows = filteredAndSortedList.map((n) => [
      n.id,
      n.title,
      n.category || "General",
      n.date || "",
      n.pinned ? "Pinned" : "Standard",
      n.content,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `bncc_notices_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.removeChild(downloadAnchor);
  };

  // Memoized Filters & Sorting
  const filteredAndSortedList = React.useMemo(() => {
    return list
      .filter((n) => {
        const matchesSearch = 
          n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.content.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCat = categoryFilter === "All" || n.category === categoryFilter;
        
        let matchesPin = true;
        if (pinnedFilter === "Pinned") matchesPin = !!n.pinned;
        if (pinnedFilter === "Unpinned") matchesPin = !n.pinned;

        return matchesSearch && matchesCat && matchesPin;
      })
      .sort((a, b) => {
        let compare = 0;
        if (sortBy === "title") {
          compare = a.title.localeCompare(b.title);
        } else {
          compare = new Date(a.date || "").getTime() - new Date(b.date || "").getTime();
        }
        return sortOrder === "asc" ? compare : -compare;
      });
  }, [list, searchTerm, categoryFilter, pinnedFilter, sortBy, sortOrder]);

  // Handle page resets
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, pinnedFilter]);

  // Pagination bounds
  const totalItems = filteredAndSortedList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedList = filteredAndSortedList.slice(indexOfFirstItem, indexOfLastItem);

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast notifications */}
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

      {/* Notice Board Header Actions */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div>
            <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
              NOTICE BOARD COMMAND CMS
            </h3>
            <p className="text-slate-400 text-[10px] mt-0.5">
              Publish recruitment notices, training dates, emergency circulars, and pin essential briefs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportJSON}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-mono font-bold uppercase px-3 py-2 rounded flex items-center space-x-1.5 border border-slate-200 dark:border-slate-750 transition-colors text-[9px] cursor-pointer"
            >
              <Download className="h-3 w-3" />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-mono font-bold uppercase px-3 py-2 rounded flex items-center space-x-1.5 border border-slate-200 dark:border-slate-750 transition-colors text-[9px] cursor-pointer"
            >
              <FileSpreadsheet className="h-3 w-3" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-extrabold uppercase px-4 py-2 rounded flex items-center space-x-2 transition-all cursor-pointer text-[10px]"
            >
              <Plus className="h-4 w-4" />
              <span>{showForm ? "Hide Notice Form" : "PUBLISH NEW NOTICE"}</span>
            </button>
          </div>
        </div>

        {/* Live Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-850">
          <div className="relative md:col-span-2">
            <input
              type="text"
              placeholder="Search notice header or text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 pl-9 pr-3 text-xs w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-sans"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          </div>

          <div className="space-y-0.5">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 w-full text-slate-750 dark:text-slate-350 focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="General">General Notice</option>
              <option value="Recruitment">Recruitment</option>
              <option value="Training">Drills / Parade Practice</option>
              <option value="Emergency">🚨 Command Alert</option>
            </select>
          </div>

          <div className="space-y-0.5">
            <select
              value={pinnedFilter}
              onChange={(e) => setPinnedFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1.5 w-full text-slate-750 dark:text-slate-350 focus:outline-none"
            >
              <option value="All">All Priority Levels</option>
              <option value="Pinned">Pinned Notices Only</option>
              <option value="Unpinned">Standard Notices Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid structure: Left list, Right form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Notices container list */}
        <div className={`space-y-4 ${showForm ? "lg:col-span-2" : "lg:col-span-3"}`}>
          
          {/* Bulk Action Controls */}
          {selectedIds.size > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono">
              <span className="text-amber-800 dark:text-amber-400 font-bold">
                {selectedIds.size} NOTICE ACTIONS ELECTED:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleBulkPin(true)}
                  className="bg-amber-500 text-slate-950 hover:bg-amber-600 px-2.5 py-1 rounded font-bold uppercase transition-colors cursor-pointer"
                >
                  Pin to Top
                </button>
                <button
                  onClick={() => handleBulkPin(false)}
                  className="bg-slate-600 text-white hover:bg-slate-700 px-2.5 py-1 rounded font-bold uppercase transition-colors cursor-pointer"
                >
                  Unpin
                </button>
                <button
                  onClick={() => handleBulkSetCategory("Emergency")}
                  className="bg-red-600 text-white hover:bg-red-700 px-2.5 py-1 rounded font-bold uppercase transition-colors cursor-pointer"
                >
                  Emergency
                </button>
                <button
                  onClick={() => handleBulkSetCategory("Training")}
                  className="bg-teal-600 text-white hover:bg-teal-700 px-2.5 py-1 rounded font-bold uppercase transition-colors cursor-pointer"
                >
                  Training
                </button>
                <button
                  onClick={() => handleBulkSetCategory("General")}
                  className="bg-slate-500 text-white hover:bg-slate-600 px-2.5 py-1 rounded font-bold uppercase transition-colors cursor-pointer"
                >
                  General
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-600 text-white hover:bg-red-700 px-2.5 py-1 rounded font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <Trash className="h-3 w-3" />
                  <span>Delete Selected</span>
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-slate-500 hover:text-slate-800 dark:text-slate-400 underline font-semibold cursor-pointer"
                >
                  Deselect
                </button>
              </div>
            </div>
          )}

          {/* Table-Header inside List representation */}
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-200/50 dark:border-slate-850 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={paginatedList.length > 0 && paginatedList.every(n => selectedIds.has(n.id))}
                onChange={handleSelectAll}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
              />
              <span>SELECT ALL ON THIS PAGE</span>
            </div>

            <div className="flex space-x-4">
              <button onClick={() => toggleSort("date")} className="hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 cursor-pointer">
                <span>Date</span>
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => toggleSort("title")} className="hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 cursor-pointer">
                <span>Heading</span>
                <ArrowUpDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {paginatedList.map((notice) => (
            <div
              key={notice.id}
              className={`bg-white dark:bg-slate-900 rounded-xl border p-4 sm:p-5 shadow-sm space-y-3 flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 transition-all hover:shadow-md ${
                selectedIds.has(notice.id) 
                  ? "border-amber-500 ring-1 ring-amber-500/20 bg-amber-50/10 dark:bg-amber-950/5" 
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="flex items-start space-x-3 flex-1 min-w-0 w-full">
                <input
                  type="checkbox"
                  checked={selectedIds.has(notice.id)}
                  onChange={(e) => handleSelectRow(notice.id, e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 mt-1 cursor-pointer shrink-0"
                />

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-mono text-[9px] px-2 py-0.5 rounded uppercase font-bold border ${
                      notice.category === "Emergency"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/10 animate-pulse"
                        : notice.category === "Recruitment"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/10"
                        : notice.category === "Training"
                        ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/10"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:border-transparent"
                    }`}>
                      {notice.category || "General"}
                    </span>

                    {notice.pinned && (
                      <span className="bg-amber-500/10 text-amber-500 font-mono text-[9px] px-1.5 py-0.5 rounded flex items-center space-x-1 border border-amber-500/10 font-bold">
                        <Pin className="h-3 w-3 fill-amber-500" />
                        <span>PINNED</span>
                      </span>
                    )}

                    <span className="text-[10px] text-slate-400 font-mono">
                      Published: {new Date(notice.date || "").toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm break-words">
                    {notice.title}
                  </h4>

                  <p className="text-xs text-slate-600 dark:text-slate-400 font-sans font-light leading-relaxed whitespace-pre-line break-words">
                    {notice.content}
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end space-x-1 sm:space-x-0 sm:space-y-1 shrink-0 self-end sm:self-start pt-2 sm:pt-0 border-t border-slate-100 dark:border-slate-800 sm:border-t-0 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleDuplicate(notice)}
                  className="text-slate-400 hover:text-blue-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Duplicate notice"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleStartEdit(notice)}
                  className="text-slate-400 hover:text-amber-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Edit notice details"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(notice.id, notice.title)}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  title="Move Notice to Recycle Bin"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Skeleton Loaders and Empty Notices State */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12"></div>
                  </div>
                  <div className="h-5 bg-slate-300 dark:bg-slate-800 rounded w-1/2"></div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 font-mono text-xs">
              NO REGISTERED COMMAND NOTICES DISCOVERED.
            </div>
          ) : null}

          {/* Pagination Controls */}
          {totalItems > 0 && (
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-1 text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value={5}>5 records</option>
                  <option value={10}>10 records</option>
                  <option value={20}>20 records</option>
                </select>
                <span>notices per page</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="text-xs font-mono px-3 py-1 bg-slate-100 dark:bg-slate-850 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right side panel: Notice create/edit form */}
        {showForm && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                {editingNotice ? "UPDATE BOARD NOTICE" : "PUBLISH BOARD NOTICE"}
              </h4>
              {editingNotice && (
                <button
                  onClick={handleCancelEdit}
                  className="text-red-500 hover:text-red-600 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  [Cancel Edit]
                </button>
              )}
            </div>
            
            <form onSubmit={handlePublishOrUpdate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Notice Heading / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., UGC BNCC Recruitment Circular 2026"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Category Group</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="General">General Notice</option>
                    <option value="Recruitment">Recruitment Enlistment</option>
                    <option value="Training">Drills / Parade Practice</option>
                    <option value="Emergency">🚨 Command Alert</option>
                  </select>
                </div>
                <div className="space-y-1 flex flex-col justify-end pb-1.5 pl-2">
                  <label className="font-mono text-slate-500 uppercase text-[9px] mb-2">Priority Pin</label>
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.pinned}
                      onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">PIN TO TOP</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Notice Core Content</label>
                <textarea
                  required
                  placeholder="Type official notice details, directions, contact people, deadlines, etc..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-32 resize-none"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-army-900 text-amber-500 hover:bg-army-950 border border-amber-500/50 font-mono font-black uppercase py-2 text-[10px] tracking-wider transition-all cursor-pointer rounded"
                >
                  {editingNotice ? "COMMIT CHANGES" : "PUBLISH LIVE NOTICE"}
                </button>
                {editingNotice && (
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
