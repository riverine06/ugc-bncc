import React from "react";
import { 
  History, Search, RefreshCw, ArrowUpDown, ChevronLeft, ChevronRight, X, ShieldAlert,
  User, Clock, ShieldCheck, Plus, Trash2, Edit, AlertCircle, FileText, Filter
} from "lucide-react";
import { subscribeToCollection, generateId } from "../../firebaseService";

interface AuditLogsTrailProps {}

interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export default function AuditLogsTrail({}: AuditLogsTrailProps) {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("All");

  // Sorting & Pagination
  const [sortBy, setSortBy] = React.useState<"timestamp" | "userEmail">("timestamp");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(15);

  // Toasts
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const fetchLogs = () => {
    setLoading(true);
    const unsub = subscribeToCollection<any>("activityLogs", (data) => {
      setLogs(data);
      setLoading(false);
      showToast("Audit operations ledger synchronized successfully", "success");
    });
    return unsub;
  };

  React.useEffect(() => {
    const unsub = fetchLogs();
    return () => unsub();
  }, []);

  // Filtering
  const filteredLogs = logs.filter((l) => {
    const s = searchTerm.toLowerCase();
    const action = (l.action || "").toLowerCase();
    const details = (l.details || "").toLowerCase();
    const email = (l.userEmail || "").toLowerCase();
    const targetType = (l.targetType || "").toLowerCase();
    const targetId = (l.targetId || "").toLowerCase();

    const matchesSearch = 
      action.includes(s) || 
      details.includes(s) || 
      email.includes(s) || 
      targetType.includes(s) || 
      targetId.includes(s);

    if (!matchesSearch) return false;

    if (actionFilter !== "All") {
      const isMatch = action.includes(actionFilter.toLowerCase());
      if (!isMatch) return false;
    }

    return true;
  });

  // Sorting
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    let comp = 0;
    if (sortBy === "userEmail") {
      comp = (a.userEmail || "").localeCompare(b.userEmail || "");
    } else {
      const dateA = a.timestamp || "";
      const dateB = b.timestamp || "";
      comp = dateA.localeCompare(dateB);
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Pagination Math
  const totalItems = sortedLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = sortedLogs.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, sortBy, sortOrder]);

  return (
    <div id="audit-logs-panel" className="space-y-6 text-xs relative">
      {/* Toast Alert floating notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-white font-mono text-[11px] animate-slide-in-right bg-slate-800 border border-slate-700"
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

      {/* Control bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex-1 space-y-1">
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
            <History className="h-4.5 w-4.5 text-amber-500" />
            <span>Audit Trail Control Ledger</span>
          </h3>
          <p className="text-slate-400 text-[10px] uppercase font-mono mt-0.5">
            Track actions taken by administrators, security parameters, and credential changes.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
          {/* Action Filter */}
          <div className="flex items-center space-x-1 font-mono text-[10px]">
            <span className="text-slate-400 uppercase text-[9px]">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 p-1.5 rounded font-bold"
            >
              <option value="All">All Operations</option>
              <option value="DELETE">DELETE/ARCHIVE</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="RESTORE">RESTORE</option>
            </select>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 rounded-lg flex items-center justify-center space-x-1.5 font-mono uppercase text-[10px] font-extrabold cursor-pointer transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Synchronize Ledger</span>
          </button>
        </div>
      </div>

      {/* Search & Sorting Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter audit trail by action, details, user email, or target ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 rounded text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="text-[10px] font-mono text-slate-400 uppercase">
            Discovered {sortedLogs.length} events of {logs.length} total
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-850 pt-3">
          {/* Sorting */}
          <div className="flex items-center space-x-2">
            <span className="font-mono text-slate-400 uppercase text-[9px]">Sort by:</span>
            <button
              onClick={() => {
                if (sortBy === "timestamp") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("timestamp");
                  setSortOrder("desc");
                }
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                sortBy === "timestamp" 
                  ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <span>Log Timestamp</span>
              <ArrowUpDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                if (sortBy === "userEmail") {
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                } else {
                  setSortBy("userEmail");
                  setSortOrder("asc");
                }
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                sortBy === "userEmail" 
                  ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                  : "border-slate-200 dark:border-slate-800 text-slate-500"
              }`}
            >
              <span>Authorized Admin</span>
              <ArrowUpDown className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
            <History className="h-4.5 w-4.5 text-amber-500" />
            <span>REGIMENTAL CHRONOLOGICAL OPERATIONS TRAIL</span>
          </h3>
        </div>

        <div className="overflow-x-auto text-xs">
          {loading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-10 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg"></div>
              ))}
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono">
              NO OPERATIONS DETECTED WITH FILTER CRITERIA.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-850 text-slate-400 uppercase tracking-wider font-mono text-[9px] whitespace-nowrap">
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Authorized Administrator</th>
                  <th className="py-3 px-3">Secure Operation</th>
                  <th className="py-3 px-3">Affected Entity</th>
                  <th className="py-3 px-3">Dossier Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedLogs.map((log) => {
                  const actionUpper = (log.action || "").toUpperCase();
                  const isDelete = actionUpper.includes("DELETE") || actionUpper.includes("ARCHIVE") || actionUpper.includes("TRASH");
                  const isCreate = actionUpper.includes("CREATE") || actionUpper.includes("ADD") || actionUpper.includes("PUBLISH");
                  const isRestore = actionUpper.includes("RESTORE") || actionUpper.includes("RECOVER");
                  const isUpdate = actionUpper.includes("UPDATE") || actionUpper.includes("EDIT");

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/30 font-sans transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>{log.timestamp ? new Date(log.timestamp).toLocaleString() : "N/A"}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                            <User className="h-3 w-3" />
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[150px]" title={log.userEmail}>
                            {log.userEmail || "system@ugcbncc.org"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 font-mono text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                          isDelete 
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" 
                            : isCreate 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                            : isRestore 
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                            : isUpdate
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                        }`}>
                          {isDelete && <Trash2 className="h-3 w-3 shrink-0" />}
                          {isCreate && <Plus className="h-3 w-3 shrink-0" />}
                          {isRestore && <RefreshCw className="h-3 w-3 shrink-0" />}
                          {isUpdate && <Edit className="h-3 w-3 shrink-0" />}
                          <span>{log.action || "LOG_ENTRY"}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[10px] whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold">
                          {log.targetType || "Platoon"}
                        </span>
                        <span className="text-slate-400 ml-1.5 text-[9px]">
                          ({log.targetId ? (log.targetId.length > 12 ? `${log.targetId.substring(0, 10)}...` : log.targetId) : "Global"})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-xs leading-relaxed">
                        <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-850 text-[11px] font-sans">
                          {log.details || "Administrative event logged successfully."}
                        </div>
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
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 flex justify-between items-center shadow-sm">
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
    </div>
  );
}
