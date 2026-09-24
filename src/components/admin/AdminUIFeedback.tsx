import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, Loader2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  duration?: number;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

interface AdminFeedbackContextType {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  confirmAction: (options: ConfirmOptions) => void;
  isBusy: boolean;
  setIsBusy: (busy: boolean) => void;
}

const AdminFeedbackContext = createContext<AdminFeedbackContextType | null>(null);

export function useAdminFeedback() {
  const context = useContext(AdminFeedbackContext);
  if (!context) {
    throw new Error("useAdminFeedback must be used within an AdminFeedbackProvider");
  }
  return context;
}

export function AdminFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    options: null,
    isLoading: false
  });
  const [isBusy, setIsBusy] = useState(false);

  const showToast = useCallback(
    (message: string, type: ToastType = "success", title?: string, duration: number = 4500) => {
      const id = `tst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type, title, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const confirmAction = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      isOpen: true,
      options,
      isLoading: false
    });
  }, []);

  const handleConfirm = async () => {
    if (!confirmState.options) return;
    setConfirmState((prev) => ({ ...prev, isLoading: true }));
    setIsBusy(true);
    try {
      await confirmState.options.onConfirm();
      setConfirmState({ isOpen: false, options: null, isLoading: false });
    } catch (err: any) {
      console.error("[InstitutionalConfirmModal] Action failed:", err);
      showToast(err?.message || "Operation failed", "error");
      setConfirmState((prev) => ({ ...prev, isLoading: false }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = () => {
    if (confirmState.isLoading) return;
    if (confirmState.options?.onCancel) {
      confirmState.options.onCancel();
    }
    setConfirmState({ isOpen: false, options: null, isLoading: false });
  };

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && confirmState.isOpen && !confirmState.isLoading) {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmState.isOpen, confirmState.isLoading]);

  return (
    <AdminFeedbackContext.Provider value={{ showToast, confirmAction, isBusy, setIsBusy }}>
      {children}

      {/* Floating Tactical Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              role={toast.type === "error" ? "alert" : "status"}
              className={`pointer-events-auto rounded-xl border p-4 shadow-xl backdrop-blur-md flex items-start space-x-3 text-left ${
                toast.type === "success"
                  ? "bg-slate-900/95 border-emerald-500/40 text-emerald-100 dark:bg-slate-950 dark:border-emerald-500/50"
                  : toast.type === "error"
                  ? "bg-slate-900/95 border-rose-500/50 text-rose-100 dark:bg-slate-950 dark:border-rose-500/60"
                  : toast.type === "warning"
                  ? "bg-slate-900/95 border-amber-500/40 text-amber-100 dark:bg-slate-950 dark:border-amber-500/50"
                  : "bg-slate-900/95 border-sky-500/40 text-sky-100 dark:bg-slate-950 dark:border-sky-500/50"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {toast.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                {toast.type === "error" && <AlertCircle className="h-5 w-5 text-rose-400" />}
                {toast.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-400" />}
                {toast.type === "info" && <Info className="h-5 w-5 text-sky-400" />}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-white mb-0.5">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs font-medium leading-relaxed break-words text-slate-200">
                  {toast.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                aria-label="Dismiss notification"
                className="shrink-0 text-slate-400 hover:text-white transition-colors p-1 rounded-md -mr-1 -mt-1"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Institutional Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmState.isOpen && confirmState.options && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden bg-white dark:bg-slate-900 ${
                confirmState.options.isDestructive
                  ? "border-rose-500/40 dark:border-rose-500/40"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              {/* Header */}
              <div
                className={`p-5 flex items-start space-x-3.5 border-b ${
                  confirmState.options.isDestructive
                    ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40"
                    : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    confirmState.options.isDestructive
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                  }`}
                >
                  {confirmState.options.isDestructive ? (
                    <ShieldAlert className="h-6 w-6" />
                  ) : (
                    <AlertTriangle className="h-6 w-6" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                        confirmState.options.isDestructive
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300"
                          : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {confirmState.options.isDestructive ? "DESTRUCTIVE ACTION" : "CONFIRMATION REQUIRED"}
                    </span>
                  </div>
                  <h3
                    id="confirm-dialog-title"
                    className="text-base font-display font-black text-slate-900 dark:text-white mt-1"
                  >
                    {confirmState.options.title}
                  </h3>
                </div>

                <button
                  type="button"
                  disabled={confirmState.isLoading}
                  onClick={handleCancel}
                  aria-label="Cancel and close dialog"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                <p
                  id="confirm-dialog-desc"
                  className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-sans"
                >
                  {confirmState.options.message}
                </p>

                {confirmState.options.isDestructive && (
                  <div className="mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                    <span>
                      This action will be permanently logged in the audit trail.
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  disabled={confirmState.isLoading}
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {confirmState.options.cancelLabel || "Cancel"}
                </button>

                <button
                  type="button"
                  disabled={confirmState.isLoading}
                  onClick={handleConfirm}
                  className={`px-5 py-2.5 rounded-lg text-xs font-mono font-bold shadow-md transition-all flex items-center space-x-2 min-h-[44px] ${
                    confirmState.options.isDestructive
                      ? "bg-rose-600 hover:bg-rose-700 text-white focus:ring-4 focus:ring-rose-500/30"
                      : "bg-emerald-800 hover:bg-emerald-900 text-white focus:ring-4 focus:ring-emerald-500/30"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {confirmState.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>
                    {confirmState.isLoading
                      ? "Processing..."
                      : confirmState.options.confirmLabel || "Confirm Action"}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminFeedbackContext.Provider>
  );
}
