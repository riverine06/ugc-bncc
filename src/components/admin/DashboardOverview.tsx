import React from "react";
import { Users, UserCheck, Calendar, ClipboardList, ShieldAlert } from "lucide-react";

interface DashboardOverviewProps {
  stats: {
    totalMembers: number;
    activeCadets: number;
    alumni: number;
    events: number;
    camps: number;
    pendingApprovals: number;
    totalAwards: number;
  };
  onNavigate: (tab: any) => void;
}

export default function DashboardOverview({ stats, onNavigate }: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/45 p-3 rounded-lg text-emerald-800 dark:text-emerald-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Profiles</span>
            <strong className="text-xl font-display font-black text-slate-900 dark:text-white block mt-0.5">
              {stats.totalMembers}
            </strong>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="bg-amber-50 dark:bg-amber-950/45 p-3 rounded-lg text-amber-600 dark:text-amber-400">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Platoon</span>
            <strong className="text-xl font-display font-black text-slate-900 dark:text-white block mt-0.5">
              {stats.activeCadets}
            </strong>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="bg-blue-50 dark:bg-blue-950/45 p-3 rounded-lg text-blue-600 dark:text-blue-400">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">Scheduled Drills</span>
            <strong className="text-xl font-display font-black text-slate-900 dark:text-white block mt-0.5">
              {stats.events}
            </strong>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center space-x-4">
          <div className="bg-red-50 dark:bg-red-950/45 p-3 rounded-lg text-red-600 dark:text-red-400">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pending Review</span>
            <strong className="text-xl font-display font-black text-slate-900 dark:text-white block mt-0.5">
              {stats.pendingApprovals}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Command Logistics notices */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-display font-bold text-xs text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 uppercase tracking-widest">
            🛡️ COMMAND LOGISTICS NOTICES
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans font-light">
            Welcome to the official UGC BNCC digital control room. Review admissions, manual cadet files, and scheduling directly. Keep records updated to generate chronological timelines cleanly.
          </p>
          <div className="bg-slate-100 dark:bg-slate-850 border-l-4 border-amber-500 p-4 rounded text-[10px] text-slate-700 dark:text-slate-300 font-mono flex flex-wrap gap-4">
            <span>System Status: <strong className="text-emerald-600 dark:text-emerald-400">ONLINE</strong></span>
            <span>Core Database: <strong className="text-emerald-600 dark:text-emerald-400">SECURE</strong></span>
            <span>Operational Regiment Code: <strong className="text-amber-500">3-RAMNA-UGC</strong></span>
          </div>
        </div>

        <div className="bg-[#081e13] text-white p-6 rounded-xl border border-amber-500/20 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-display font-bold text-amber-400 text-xs uppercase tracking-widest mb-3">
              // QUICK COMMAND LINKS
            </h3>
            <p className="text-[11px] text-army-200 font-sans font-light leading-relaxed">
              Toggle manual profile additions, schedule drills for Victory Day, or approve veteran alumni profiles with one click.
            </p>
          </div>
          <button
            onClick={() => onNavigate("members")}
            className="mt-6 w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono font-black text-[10px] py-2.5 rounded uppercase shadow transition-all duration-200 cursor-pointer text-center"
          >
            Insert Manual Profile
          </button>
        </div>
      </div>
    </div>
  );
}
