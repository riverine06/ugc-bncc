import React from "react";
import { 
  Database, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, 
  Trash2, FileSearch, ArrowRight, Lock, Check, Info
} from "lucide-react";
import { User } from "../../types";
import { 
  getSystemInitMeta, 
  initializeDatabase, 
  runControlledSchemaMigration, 
  SystemInitMeta, 
  MigrationReport 
} from "../../services/dbInit";
import { 
  auditDuplicates, 
  archiveDuplicateRecord, 
  DuplicateAuditReport, 
  DuplicateAuditItem 
} from "../../services/dbMaintenance";

interface DatabaseIntegrityCMSProps {
  currentUser: User | null;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  onRefresh?: () => void;
}

export default function DatabaseIntegrityCMS({ currentUser, showToast, onRefresh }: DatabaseIntegrityCMSProps) {
  const [initMeta, setInitMeta] = React.useState<SystemInitMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = React.useState<boolean>(true);

  // Duplicate Audit State
  const [auditReport, setAuditReport] = React.useState<DuplicateAuditReport | null>(null);
  const [auditing, setAuditing] = React.useState<boolean>(false);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  // Migration State
  const [migrationReport, setMigrationReport] = React.useState<MigrationReport | null>(null);
  const [runningMigration, setRunningMigration] = React.useState<boolean>(false);
  const [isDryRun, setIsDryRun] = React.useState<boolean>(true);

  // Seeding State
  const [seeding, setSeeding] = React.useState<boolean>(false);

  // Confirm Modal
  const [confirmConfig, setConfirmConfig] = React.useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const fetchSentinel = React.useCallback(async () => {
    setLoadingMeta(true);
    try {
      const meta = await getSystemInitMeta();
      setInitMeta(meta);
    } catch (err: any) {
      console.warn("Failed to load sentinel meta:", err);
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSentinel();
  }, [fetchSentinel]);

  // Handle Safe Duplicate Audit
  const handleRunAudit = async () => {
    setAuditing(true);
    try {
      const rep = await auditDuplicates();
      setAuditReport(rep);
      if (rep.duplicateCount === 0) {
        showToast("Database clean: zero duplicate records identified.", "success");
      } else {
        showToast(`Audit identified ${rep.duplicateCount} duplicate records for review.`, "info");
      }
    } catch (err: any) {
      showToast(err.message || "Audit failed", "error");
    } finally {
      setAuditing(false);
    }
  };

  // Handle Safe Archival of Duplicate (moves to trash, never permanent wipe)
  const handleArchiveDuplicate = (item: DuplicateAuditItem) => {
    setConfirmConfig({
      title: "Safe Archival to Recycle Bin",
      message: `Move candidate duplicate record [${item.collection}/${item.id}] to the Recycle Bin? This action is 100% reversible via the Recycle Bin CMS and does not permanently wipe any data.`,
      onConfirm: async () => {
        setConfirmConfig(null);
        setArchivingId(item.id);
        try {
          await archiveDuplicateRecord(
            item.collection,
            item.id,
            { memberId: item.memberId, key: item.key },
            item.titleOrDetail,
            currentUser?.email || "admin@ugcbncc.org",
            currentUser?.id || "admin"
          );
          showToast(`Archived record to Recycle Bin: ${item.id}`, "success");
          // Update local audit report
          setAuditReport((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              duplicateCount: Math.max(0, prev.duplicateCount - 1),
              duplicates: prev.duplicates.filter((d) => d.id !== item.id),
            };
          });
          if (onRefresh) onRefresh();
        } catch (err: any) {
          showToast(err.message || "Archive failed", "error");
        } finally {
          setArchivingId(null);
        }
      },
    });
  };

  // Handle Controlled Schema Migration
  const handleExecuteMigration = () => {
    const actionLabel = isDryRun ? "Simulate Dry Run" : "Apply Controlled Migration";
    setConfirmConfig({
      title: `${actionLabel} Schema Update`,
      message: isDryRun
        ? "Run non-destructive simulation to inspect documents needing backward-compatible schema backfills? No documents will be modified."
        : "Apply backward-compatible schema backfills? This will strictly add missing metadata without removing legacy fields or deleting any collections.",
      onConfirm: async () => {
        setConfirmConfig(null);
        setRunningMigration(true);
        try {
          const report = await runControlledSchemaMigration({
            dryRun: isDryRun,
            executedBy: currentUser?.email || "admin@ugcbncc.org",
          });
          setMigrationReport(report);
          showToast(
            isDryRun
              ? `Dry run finished: ${report.recordsMigrated} candidates identified.`
              : `Migration applied: ${report.recordsMigrated} records updated non-destructively.`,
            "success"
          );
          await fetchSentinel();
          if (onRefresh) onRefresh();
        } catch (err: any) {
          showToast(err.message || "Migration failed", "error");
        } finally {
          setRunningMigration(false);
        }
      },
    });
  };

  // Handle Safe Non-Destructive Initial Seeding
  const handleSafeInit = () => {
    setConfirmConfig({
      title: "Verify & Seed Missing Core Baselines",
      message: "Execute safe non-destructive initialization. This will populate missing system collections (homepage, about, contact) only if absent. Existing records and admin customizations will NEVER be overwritten or deleted.",
      onConfirm: async () => {
        setConfirmConfig(null);
        setSeeding(true);
        try {
          const res = await initializeDatabase({ force: false });
          showToast(res.message, res.alreadyInitialized ? "info" : "success");
          await fetchSentinel();
          if (onRefresh) onRefresh();
        } catch (err: any) {
          showToast(err.message || "Initialization failed", "error");
        } finally {
          setSeeding(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Confirmation Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-bold font-mono uppercase tracking-wider">{confirmConfig.title}</h4>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed font-sans">
              {confirmConfig.message}
            </p>
            <div className="flex justify-end gap-2.5 pt-2 font-mono">
              <button
                onClick={() => setConfirmConfig(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3.5 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmConfig.onConfirm}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                Proceed Safely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Guarantee Banner */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4.5 flex items-start space-x-3.5">
        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <h4 className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">
            Zero-Data-Loss Architecture Active
          </h4>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-400/90 leading-relaxed font-sans">
            Automatic collection wiping, silent cascading deletions, and unconfirmed background deduplications are strictly decoupled from normal application usage. Public visitors cannot trigger database writes or resets. All maintenance operations below are explicit, transparent, and non-destructive.
          </p>
        </div>
      </div>

      {/* Section 1: Database Sentinel & Initialization State */}
      <div className="bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <Lock className="h-4 w-4 text-amber-500" />
            <h4 className="font-mono text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Database Sentinel & Initialization Lock
            </h4>
          </div>
          <button
            onClick={fetchSentinel}
            disabled={loadingMeta}
            className="flex items-center space-x-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-mono text-[10px] uppercase cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className={`h-3 w-3 ${loadingMeta ? "animate-spin" : ""}`} />
            <span>Refresh Sentinel</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 font-mono text-[9px] uppercase tracking-wider">Sentinel Status</div>
            <div className="mt-1 flex items-center space-x-1.5 font-bold font-mono">
              {initMeta?.initialized ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">LOCKED (Initialized)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">NOT INITIALIZED</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 font-mono text-[9px] uppercase tracking-wider">Active Schema Version</div>
            <div className="mt-1 font-mono font-bold text-slate-800 dark:text-slate-200">
              {initMeta?.schemaVersion || "v1.0 (Baseline)"}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="text-slate-400 font-mono text-[9px] uppercase tracking-wider">Initialization Timestamp</div>
            <div className="mt-1 font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate">
              {initMeta?.initializedAt ? new Date(initMeta.initializedAt).toLocaleString() : "Pending"}
            </div>
          </div>
        </div>

        <div className="pt-1 flex flex-wrap items-center gap-3">
          <button
            onClick={handleSafeInit}
            disabled={seeding}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 text-white px-3.5 py-2 rounded-lg font-mono text-[10px] font-bold uppercase transition cursor-pointer"
          >
            <Database className="h-3.5 w-3.5 text-amber-500" />
            <span>{seeding ? "Verifying..." : "Verify & Seed Missing Core Baselines"}</span>
          </button>
          <span className="text-slate-400 text-[10px] font-sans">
            Guaranteed safe: never overwrites or resets existing collections or documents.
          </span>
        </div>
      </div>

      {/* Section 2: Safe Duplicate Record Audit (Read-Only Scan) */}
      <div className="bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <FileSearch className="h-4 w-4 text-sky-500" />
            <h4 className="font-mono text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Safe Duplicate Audit (Zero-Risk Dry-Run)
            </h4>
          </div>
          <button
            onClick={handleRunAudit}
            disabled={auditing}
            className="flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase cursor-pointer"
          >
            <RefreshCw className={`h-3 w-3 ${auditing ? "animate-spin" : ""}`} />
            <span>{auditing ? "Scanning Collections..." : "Scan Collections for Duplicates"}</span>
          </button>
        </div>

        <p className="text-slate-600 dark:text-slate-400 text-[11px] font-sans leading-relaxed">
          Inspects <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">campParticipants</code> and <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">achievements</code> for candidate duplicates without altering or deleting any documents. Duplicates can be moved to the Recycle Bin with 100% undoability.
        </p>

        {auditReport && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
              <span className="text-slate-500">Scanned Documents: <strong className="text-slate-800 dark:text-slate-200">{auditReport.totalChecked}</strong></span>
              <span className={auditReport.duplicateCount > 0 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>
                {auditReport.duplicateCount === 0 ? "0 Duplicates Found (Healthy)" : `${auditReport.duplicateCount} Candidate Duplicates Found`}
              </span>
            </div>

            {auditReport.duplicates.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5">Collection</th>
                      <th className="p-2.5">Document ID</th>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Member ID</th>
                      <th className="p-2.5 text-right">Safe Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900">
                    {auditReport.duplicates.map((dup) => (
                      <tr key={dup.id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                        <td className="p-2.5 font-bold text-slate-700 dark:text-slate-300">{dup.collection}</td>
                        <td className="p-2.5 text-slate-500 text-[10px]">{dup.id}</td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{dup.titleOrDetail}</td>
                        <td className="p-2.5 text-amber-600">{dup.memberId || "N/A"}</td>
                        <td className="p-2.5 text-right">
                          <button
                            onClick={() => handleArchiveDuplicate(dup)}
                            disabled={archivingId === dup.id}
                            className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-300 px-2 py-1 rounded text-[9px] font-bold uppercase transition cursor-pointer"
                          >
                            {archivingId === dup.id ? "Archiving..." : "Archive to Trash"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 3: Controlled Schema Migration */}
      <div className="bg-slate-50 dark:bg-slate-850/50 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-purple-500" />
            <h4 className="font-mono text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Explicit Controlled Schema Migration
            </h4>
          </div>
          <p className="text-slate-500 text-[10px] font-sans mt-0.5">
            Synchronizes cadetId/memberId references and backfills missing metadata while strictly preserving all legacy fields.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <label className="flex items-center space-x-2 cursor-pointer text-[11px] font-mono">
            <input
              type="checkbox"
              checked={isDryRun}
              onChange={(e) => setIsDryRun(e.target.checked)}
              className="rounded text-amber-500 focus:ring-amber-500"
            />
            <span className="text-slate-700 dark:text-slate-300 font-bold">
              Dry Run Simulation Only (Read-Only)
            </span>
          </label>

          <button
            onClick={handleExecuteMigration}
            disabled={runningMigration}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-mono text-[10px] font-bold uppercase text-white cursor-pointer ${
              isDryRun
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <RefreshCw className={`h-3 w-3 ${runningMigration ? "animate-spin" : ""}`} />
            <span>
              {runningMigration
                ? "Running..."
                : isDryRun
                ? "Run Migration Dry-Run"
                : "Apply Non-Destructive Migration"}
            </span>
          </button>
        </div>

        {migrationReport && (
          <div className="mt-3 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2 font-mono text-[11px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Migration Execution Result: {migrationReport.dryRun ? "[SIMULATION DRY-RUN]" : "[COMMITTED]"}
              </span>
              <span className="text-slate-400 text-[10px]">{migrationReport.timestamp}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] pt-1">
              <div>Total Scanned: <strong>{migrationReport.totalScanned}</strong></div>
              <div>Migrated: <strong className="text-emerald-600">{migrationReport.recordsMigrated}</strong></div>
              <div>Skipped (Healthy): <strong>{migrationReport.recordsSkipped}</strong></div>
              <div>Target Version: <strong>{migrationReport.targetVersion}</strong></div>
            </div>
            {migrationReport.details.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-2.5 rounded text-[10px] text-slate-600 dark:text-slate-400 space-y-1">
                {migrationReport.details.map((msg, idx) => (
                  <div key={idx} className="flex items-start space-x-1.5">
                    <ArrowRight className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <span>{msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
