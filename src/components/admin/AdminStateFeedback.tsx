import React from "react";
import { Loader2, ShieldAlert, FolderOpen, RefreshCw, XCircle } from "lucide-react";

interface LoadingProps {
  title?: string;
  message?: string;
  className?: string;
}

export function InstitutionalLoadingState({
  title = "SYNCHRONIZING PLATOON DATA",
  message = "Connecting to Firebase Firestore registry...",
  className = ""
}: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`p-12 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-600 dark:border-t-emerald-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">
          {title}
        </h4>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
          {message}
        </p>
      </div>
    </div>
  );
}

interface EmptyProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function InstitutionalEmptyState({
  title = "NO RECORDS CATALOGED",
  message = "There are currently no items matching the active filters or search criteria.",
  icon,
  actionLabel,
  onAction,
  className = ""
}: EmptyProps) {
  return (
    <div
      className={`p-12 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
        {icon || <FolderOpen className="w-8 h-8 stroke-[1.5]" />}
      </div>
      <div className="space-y-1 max-w-md">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {title}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {message}
        </p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-sm min-h-[44px]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function InstitutionalErrorState({
  title = "REGISTRY TRANSMISSION ERROR",
  message = "Failed to establish a reliable stream with the institutional database.",
  onRetry,
  className = ""
}: ErrorProps) {
  return (
    <div
      role="alert"
      className={`p-8 text-center rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col items-center justify-center space-y-3 ${className}`}
    >
      <div className="p-3 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <div className="space-y-1 max-w-md">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
          {title}
        </h4>
        <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 px-4 py-2 rounded-lg text-xs font-mono font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm flex items-center space-x-1.5 min-h-[44px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>RETRY OPERATION</span>
        </button>
      )}
    </div>
  );
}
