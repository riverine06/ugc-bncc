import React from "react";
import { 
  Trash2, RefreshCw, Loader2, Search, ArrowUpDown, ChevronLeft, ChevronRight, Check, X, AlertTriangle 
} from "lucide-react";
import { deleteFileFromStorage } from "../../firebase";
import { subscribeToCollection, restoreRecordFromTrash, permanentPurgeRecord, generateId } from "../../firebaseService";
import { auth } from "../../firebase";

interface RecycleBinCMSProps {
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

export default function RecycleBinCMS({ onRefresh }: RecycleBinCMSProps) {
  const [trashItems, setTrashItems] = React.useState<any[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Search, Filters, Sorting, Pagination states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("All");
  const [sortBy, setSortBy] = React.useState<"title" | "deletedAt">("deletedAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Toast & Custom dialogue state
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  React.useEffect(() => {
    setLoading(true);
    const unsub = subscribeToCollection<any>("trash", (data) => {
      setTrashItems(data);
      setSelectedIds([]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleRestore = async (id: string, title: string) => {
    try {
      await restoreRecordFromTrash(id, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
      showToast(`Successfully restored "${title}" from Recycle Bin`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const cleanFirebaseStorageForTrashItem = async (item: any) => {
    try {
      const urls: string[] = [];
      const findUrls = (obj: any, visited = new Set()) => {
        if (!obj || visited.has(obj)) return;
        if (typeof obj === "object") visited.add(obj);

        if (typeof obj === "string") {
          if (obj.includes("firebasestorage.googleapis.com")) {
            urls.push(obj);
          }
        } else if (Array.isArray(obj)) {
          for (const val of obj) {
            findUrls(val, visited);
          }
        } else if (typeof obj === "object") {
          for (const key of Object.keys(obj)) {
            findUrls(obj[key], visited);
          }
        }
      };

      findUrls(item);

      await Promise.allSettled(
        urls.map((url) =>
          Promise.race([
            deleteFileFromStorage(url),
            new Promise((resolve) => setTimeout(resolve, 3000))
          ]).catch((err) => console.warn("Failed storage purge:", err))
        )
      );
    } catch (e) {
      console.warn("Failed to clean storage for trash item:", e);
    }
  };

  const handlePurge = (id: string, title: string) => {
    setConfirmDialog({
      title: "CRITICAL: Permanent Purge Record",
      message: `WARNING: Permanent deletion of "${title}" is completely IRREVERSIBLE. Purge physical copy anyway?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const itemToPurge = trashItems.find((t) => t.id === id);
          if (itemToPurge) {
            await cleanFirebaseStorageForTrashItem(itemToPurge);
          }
          await permanentPurgeRecord(id, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
          showToast(`Permanently purged "${title}" from memory`, "success");
          setSelectedIds((prev) => prev.filter((item) => item !== id));
          onRefresh();
        } catch (err: any) {
          showToast(`Purge error: ${err.message || err}`, "error");
        } finally {
          setLoading(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleBulkRestore = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Restore Records",
      message: `Are you sure you want to restore all ${selectedIds.length} selected items to their respective modules?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          let count = 0;
          for (const id of selectedIds) {
            await restoreRecordFromTrash(id, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            count++;
          }
          showToast(`Successfully restored ${count} records`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        } finally {
          setLoading(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleBulkPurge = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "CRITICAL: Bulk Permanent Purge",
      message: `CRITICAL DANGER WARNING: You are about to permanently purge ${selectedIds.length} selected records. This is IRREVERSIBLE. Proceed?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          let count = 0;
          for (const id of selectedIds) {
            const itemToPurge = trashItems.find((t) => t.id === id);
            if (itemToPurge) {
              await cleanFirebaseStorageForTrashItem(itemToPurge);
            }
            await permanentPurgeRecord(id, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            count++;
          }
          showToast(`Successfully purged ${count} records from database`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(`Bulk purge error: ${err.message || err}`, "error");
        } finally {
          setLoading(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  // Filters, search & sorting logic
  const filteredTrash = trashItems.filter((item) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = 
      item.title.toLowerCase().includes(s) ||
      item.id.toLowerCase().includes(s);

    if (!matchesSearch) return false;

    if (typeFilter !== "All" && item.type !== typeFilter) {
      return false;
    }
    return true;
  });

  // Sorting
  const sortedTrash = [...filteredTrash].sort((a, b) => {
    let comp = 0;
    if (sortBy === "title") {
      comp = a.title.localeCompare(b.title);
    } else if (sortBy === "deletedAt") {
      const dateA = a.deletedAt || "";
      const dateB = b.deletedAt || "";
      comp = dateA.localeCompare(dateB);
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Pagination Math
  const totalItems = sortedTrash.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTrash = sortedTrash.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, sortBy, sortOrder]);

  const handleToggleSelectAll = () => {
    const pageIds = paginatedTrash.map((item) => item.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // Extract all unique types present for filtering
  const uniqueTypes = Array.from(new Set(trashItems.map((item) => item.type)));

  return (
    <div id="recycle-bin-cms-panel" className="space-y-6 text-xs relative">
      {/* Toasts overlay */}
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
            <div className="flex items-center space-x-3 text-red-500">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
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
                CONFIRM ACTION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-sm uppercase flex items-center space-x-2">
            <Trash2 className="h-4 w-4 text-red-500 animate-pulse" />
            <span>Tactical Recycle Bin (Soft Deletion Ledger)</span>
          </h3>
          <p className="text-[11px] text-slate-400 font-mono uppercase mt-0.5">
            Retrieve or permanently purge soft-deleted cadets, events, achievements, gallery assets, or notices.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-500 rounded-lg cursor-pointer flex items-center space-x-1.5 font-mono text-[10px]"
            title="Refresh Bin"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>REFRESH</span>
          </button>
          {selectedIds.length > 0 && (
            <div className="flex gap-1.5 font-mono">
              <button
                onClick={handleBulkRestore}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1 cursor-pointer"
              >
                <span>Restore ({selectedIds.length})</span>
              </button>
              <button
                onClick={handleBulkPurge}
                className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase flex items-center space-x-1 cursor-pointer"
              >
                <span>Purge ({selectedIds.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search soft-deleted records by title or original ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filter by Original Module Type */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-slate-400 uppercase text-[10px]">Source Module:</span>
            <button
              onClick={() => setTypeFilter("All")}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                typeFilter === "All"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            {uniqueTypes.map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                  typeFilter === type
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-850 pt-3">
          {/* Sort controls */}
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
              <span>Record Title</span>
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (sortBy === "deletedAt") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("deletedAt");
                  setSortOrder("desc");
                }
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                sortBy === "deletedAt" 
                  ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <span>Deletion Date</span>
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>

          <div className="text-[10px] font-mono text-slate-400">
            Scanning result: {filteredTrash.length} soft-deleted files cataloged
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-slate-50 dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
              <div className="h-5 bg-slate-300 dark:bg-slate-850 rounded w-1/3"></div>
              <div className="h-4 bg-slate-300 dark:bg-slate-850 rounded w-16"></div>
              <div className="h-3 bg-slate-200 dark:bg-slate-850 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : paginatedTrash.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm">
          <Trash2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 italic text-xs font-mono">Recycle bin is completely empty. No files require processing.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-500 uppercase">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedTrash.length > 0 && paginatedTrash.every((item) => selectedIds.includes(item.id))}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="p-3">Title / Record Name</th>
                <th className="p-3">Module Type</th>
                <th className="p-3">Deleted Date / Timestamp</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedTrash.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <tr key={item.id} className={`transition-all ${isSelected ? "bg-amber-500/5" : "hover:bg-slate-50/50 dark:hover:bg-slate-850/10"}`}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(item.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{item.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {item.id}</div>
                    </td>
                    <td className="p-3 font-mono">
                      <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold border border-slate-200 dark:border-slate-750">
                        {item.type}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {item.deletedAt ? item.deletedAt.substring(0, 19).replace("T", " ") : "N/A"}
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      <button
                        onClick={() => handleRestore(item.id, item.title)}
                        className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase cursor-pointer"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurge(item.id, item.title)}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1 rounded-md text-[10px] font-mono font-bold uppercase cursor-pointer"
                      >
                        Purge
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between shadow-sm">
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
  );
}
