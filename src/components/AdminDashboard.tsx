import React from "react";
import {
  Compass,
  Users,
  ClipboardList,
  ShieldAlert,
  Calendar,
  Bell,
  Award,
  Image as ImageIcon,
  FileText,
  History,
  Settings,
  Trash2,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Tent,
} from "lucide-react";
import { User, Member, PlatoonEvent, PlatoonApplication, BNCCRank } from "../types";

// Import primary overview panel directly for instant tab render
import DashboardOverview from "./admin/DashboardOverview";

// Code-split specialized administrative sub-panels on demand
const MembersManager = React.lazy(() => import("./admin/MembersManager"));
const AdmissionsInbox = React.lazy(() => import("./admin/AdmissionsInbox"));
const LeadershipReferences = React.lazy(() => import("./admin/LeadershipReferences"));
const OperationsScheduler = React.lazy(() => import("./admin/OperationsScheduler"));
const NoticeBoardCMS = React.lazy(() => import("./admin/NoticeBoardCMS"));
const AchievementsCMS = React.lazy(() => import("./admin/AchievementsCMS"));
const GalleryCMS = React.lazy(() => import("./admin/GalleryCMS"));
const DocumentVaultCMS = React.lazy(() => import("./admin/DocumentVaultCMS"));
const AuditLogsTrail = React.lazy(() => import("./admin/AuditLogsTrail"));
const CmsSettingsPanel = React.lazy(() => import("./admin/CmsSettingsPanel"));
const RecycleBinCMS = React.lazy(() => import("./admin/RecycleBinCMS"));
const CampsCMS = React.lazy(() => import("./admin/CampsCMS"));

function AdminPanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse p-4">
      <div className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
      <div className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"></div>
      <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"></div>
    </div>
  );
}
import { generateId, createDocument, updateDocument, softDeleteRecord } from "../firebaseService";

import { AdminFeedbackProvider, useAdminFeedback } from "./admin/AdminUIFeedback";
import SEO from "./SEO";

interface AdminDashboardProps {
  stats: {
    totalMembers: number;
    activeCadets: number;
    alumni: number;
    events: number;
    camps: number;
    pendingApprovals: number;
    totalAwards: number;
  };
  members: Member[];
  events: PlatoonEvent[];
  applications: PlatoonApplication[];
  onRefresh: () => void;
  onLogout: () => void;
  onViewPublicSite: () => void;
  currentUser: User | null;
}

type TabType =
  | "overview"
  | "members"
  | "admissions"
  | "leadership"
  | "events"
  | "camps"
  | "notices"
  | "achievements"
  | "gallery"
  | "documents"
  | "audit"
  | "settings"
  | "trash";

function AdminDashboardContent({
  stats,
  members,
  events,
  applications,
  onRefresh,
  onLogout,
  onViewPublicSite,
  currentUser,
}: AdminDashboardProps) {
  const { showToast, confirmAction, isBusy, setIsBusy } = useAdminFeedback();
  const [activeTab, setActiveTab] = React.useState<TabType>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = React.useState(false);

  // Events Form State (shared)
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
  const [eventForm, setEventForm] = React.useState({
    name: "",
    description: "",
    eventType: "Training",
    date: "",
    time: "",
    venue: "",
    registrationDeadline: "",
    maxParticipants: "50",
    registrationFee: "0",
    eligibilityRequirements: "Active Cadets Only",
  });

  const handleStartEditEvent = (evt: PlatoonEvent) => {
    setEditingEventId(evt.id);
    setEventForm({
      name: evt.name,
      description: evt.description,
      eventType: evt.eventType,
      date: evt.date,
      time: evt.time,
      venue: evt.venue,
      registrationDeadline: evt.registrationDeadline || "",
      maxParticipants: String(evt.maxParticipants || 50),
      registrationFee: String(evt.registrationFee || 0),
      eligibilityRequirements: evt.eligibilityRequirements || "Active Cadets Only",
    });
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingEvent || isBusy) return;
    setIsSubmittingEvent(true);
    setIsBusy(true);

    try {
      const eventPayload = {
        ...eventForm,
        maxParticipants: Number(eventForm.maxParticipants),
        registrationFee: Number(eventForm.registrationFee),
      };

      if (editingEventId) {
        await updateDocument("events", editingEventId, eventPayload);
        showToast(
          `Operation "${eventForm.name}" details updated successfully.`,
          "success",
          "OPERATION SYNCHRONIZED"
        );
      } else {
        const id = generateId("evt");
        await createDocument("events", { id, ...eventPayload }, id);
        showToast(
          `Operation "${eventForm.name}" has been registered in the schedule.`,
          "success",
          "OPERATION SCHEDULED"
        );
      }

      setEditingEventId(null);
      setEventForm({
        name: "",
        description: "",
        eventType: "Training",
        date: "",
        time: "",
        venue: "",
        registrationDeadline: "",
        maxParticipants: "50",
        registrationFee: "0",
        eligibilityRequirements: "Active Cadets Only",
      });
      onRefresh();
    } catch (err: any) {
      showToast(err.message || "Failed to save operation details.", "error", "OPERATION FAILED");
    } finally {
      setIsSubmittingEvent(false);
      setIsBusy(false);
    }
  };

  const handleDeleteEvent = (id: string, name: string) => {
    confirmAction({
      title: "TRASH TACTICAL OPERATION",
      message: `Are you sure you want to move operation "${name}" to the Recycle Bin? All event rosters and participant records will be retained in audit history.`,
      confirmLabel: "Move to Trash",
      isDestructive: true,
      onConfirm: async () => {
        const itemToDel = events.find((e) => e.id === id);
        if (itemToDel) {
          await softDeleteRecord(
            "events",
            id,
            name,
            itemToDel,
            currentUser?.email || "admin@ugcbncc.org",
            currentUser?.id || "admin"
          );
          showToast(`Operation "${name}" moved to Recycle Bin.`, "success", "OPERATION ARCHIVED");
          onRefresh();
        }
      },
    });
  };

  const handleDeleteMember = (id: string, name: string) => {
    confirmAction({
      title: "ARCHIVE CADET TO TRASH",
      message: `Move Cadet "${name}" to the Recycle Bin? Associated achievements and participation honors will be safely archived without permanent data loss.`,
      confirmLabel: "Archive Cadet",
      isDestructive: true,
      onConfirm: async () => {
        const itemToDel = members.find((m) => m.id === id);
        if (itemToDel) {
          await softDeleteRecord(
            "cadets",
            id,
            name,
            itemToDel,
            currentUser?.email || "admin@ugcbncc.org",
            currentUser?.id || "admin"
          );
          showToast(`Cadet "${name}" archived into Recycle Bin.`, "success", "CADET ARCHIVED");
          onRefresh();
        }
      },
    });
  };

  // Nav Links List
  const navLinks = [
    { id: "overview", label: "Dashboard", icon: Compass },
    { id: "members", label: "Members", icon: Users },
    { id: "admissions", label: "Applications", icon: ClipboardList },
    { id: "leadership", label: "Leadership", icon: ShieldAlert },
    { id: "events", label: "Events", icon: Calendar },
    { id: "camps", label: "Camp Registry", icon: Tent },
    { id: "notices", label: "Announcements", icon: Bell },
    { id: "achievements", label: "Achievements", icon: Award },
    { id: "gallery", label: "Gallery", icon: ImageIcon },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "audit", label: "Audit Logs", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "trash", label: "Recycle Bin", icon: Trash2 },
  ] as const;

  const renderActivePanel = () => {
    switch (activeTab) {
      case "overview":
        return <DashboardOverview stats={stats} onNavigate={(tab) => setActiveTab(tab)} />;
      case "members":
        return <MembersManager members={members} onRefresh={onRefresh} onDeleteMember={handleDeleteMember} />;
      case "admissions":
        return <AdmissionsInbox applications={applications} onRefresh={onRefresh} />;
      case "leadership":
        return <LeadershipReferences members={members} onRefresh={onRefresh} />;
      case "events":
        return (
          <OperationsScheduler
            events={events}
            members={members}
            onRefresh={onRefresh}
            onDeleteEvent={handleDeleteEvent}
            onStartEdit={handleStartEditEvent}
            form={eventForm}
            setForm={setEventForm}
            editingId={editingEventId}
            setEditingId={setEditingEventId}
            onSubmit={handleSaveEvent}
          />
        );
      case "camps":
        return <CampsCMS onRefresh={onRefresh} />;
      case "notices":
        return <NoticeBoardCMS onRefresh={onRefresh} />;
      case "achievements":
        return <AchievementsCMS members={members} onRefresh={onRefresh} />;
      case "gallery":
        return <GalleryCMS onRefresh={onRefresh} />;
      case "documents":
        return <DocumentVaultCMS onRefresh={onRefresh} />;
      case "audit":
        return <AuditLogsTrail />;
      case "settings":
        return <CmsSettingsPanel onRefresh={onRefresh} currentUser={currentUser} />;
      case "trash":
        return <RecycleBinCMS onRefresh={onRefresh} />;
      default:
        return <div className="text-center py-10 font-mono text-xs">MODULE UNDER REVIEW</div>;
    }
  };

  const getActiveTabTitle = () => {
    const found = navLinks.find((n) => n.id === activeTab);
    return found ? found.label : "HQ Command Panel";
  };

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-800 dark:text-slate-100">
      <SEO
        title="HQ Command Administration | Restricted Access"
        description="Restricted administrative control system for authorized UGC BNCC Platoon leadership only."
        noIndex={true}
      />
      {/* 1. SIDEBAR (Desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#081e13] border-r border-[#0d2a1d] flex-col justify-between text-[#a3b899] font-sans h-full">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Header */}
          <div className="h-16 px-6 border-b border-[#0d2a1d] flex items-center justify-between shrink-0">
            <span className="font-display font-black text-amber-500 uppercase tracking-wider flex items-center space-x-2 text-xs">
              <ShieldAlert className="h-4.5 w-4.5 text-amber-500" />
              <span>BNCC COMMAND</span>
            </span>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 py-4 overflow-y-auto space-y-0.5 px-3">
            {navLinks.map((link) => {
              const LinkIcon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-2 text-xs font-semibold uppercase tracking-wider font-mono rounded transition-all text-left cursor-pointer ${
                    isActive
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-[#a3b899] hover:bg-[#0c2e1d] hover:text-white"
                  }`}
                >
                  <LinkIcon className="h-4 w-4 shrink-0" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile and Logout info footer */}
        <div className="p-4 border-t border-[#0d2a1d] bg-[#06170e] shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold font-mono text-xs uppercase shrink-0">
              {currentUser?.email ? currentUser.email.charAt(0) : "A"}
            </div>
            <div className="overflow-hidden">
              <span className="block text-[10px] text-white font-bold truncate">
                {currentUser?.email || "Admin User"}
              </span>
              <span className="block text-[9px] text-[#718868] font-mono uppercase tracking-widest font-black">
                {currentUser?.role || "SYSTEM_ADMIN"}
              </span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-[#0c2e1d] rounded transition-all cursor-pointer"
            title="Log Out of HQ Session"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* 2. MOBILE HEADER & MOBILE MENU */}
      <div className="md:hidden flex flex-col w-full h-full">
        <header className="relative z-50 h-16 bg-[#081e13] border-b border-[#0d2a1d] px-4 flex items-center justify-between text-[#a3b899] shrink-0">
          <span className="font-display font-black text-amber-500 uppercase tracking-wider flex items-center space-x-2 text-xs">
            <ShieldAlert className="h-4.5 w-4.5 text-amber-500" />
            <span>BNCC COMMAND</span>
          </span>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1 text-white bg-transparent border-0 outline-none z-50 relative"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </header>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-[#081e13] pt-16 flex flex-col justify-between">
            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
              {navLinks.map((link) => {
                const LinkIcon = link.icon;
                const isActive = activeTab === link.id;
                return (
                  <button
                    key={link.id}
                    onClick={() => {
                      setActiveTab(link.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider font-mono rounded transition-all text-left ${
                      isActive
                        ? "bg-amber-500 text-slate-950"
                        : "text-[#a3b899] hover:bg-[#0c2e1d]"
                    }`}
                  >
                    <LinkIcon className="h-4 w-4 shrink-0" />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#0d2a1d] bg-[#06170e] flex items-center justify-between">
              <span className="text-[10px] text-white font-bold truncate">{currentUser?.email}</span>
              <button onClick={onLogout} className="text-red-400 font-bold text-xs flex items-center space-x-1.5 font-mono">
                <LogOut className="h-4 w-4" />
                <span>LOGOUT</span>
              </button>
            </div>
          </div>
        )}

        {/* Content pane for mobile */}
        {!mobileMenuOpen && (
          <main className="flex-1 flex flex-col overflow-hidden">
            <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex justify-between items-center shrink-0 gap-2">
              <h2 className="font-display font-black text-slate-900 dark:text-white uppercase text-xs truncate min-w-0">
                {getActiveTabTitle()}
              </h2>
              <button
                onClick={onViewPublicSite}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded text-[9px] font-bold font-mono uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer shrink-0"
              >
                <span>Live Site</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
              <React.Suspense fallback={<AdminPanelSkeleton />}>
                {renderActivePanel()}
              </React.Suspense>
            </div>
          </main>
        )}
      </div>

      {/* 3. DESKTOP RIGHT VIEW AREA */}
      <div className="hidden md:flex flex-col flex-1 h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex justify-between items-center shrink-0">
          <h2 className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">
            {getActiveTabTitle()}
          </h2>
          <button
            onClick={onViewPublicSite}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <span>VIEW PUBLIC PORTAL</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </header>

        {/* Scroll Content panel */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50 dark:bg-slate-950">
          <React.Suspense fallback={<AdminPanelSkeleton />}>
            {renderActivePanel()}
          </React.Suspense>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard(props: AdminDashboardProps) {
  return (
    <AdminFeedbackProvider>
      <AdminDashboardContent {...props} />
    </AdminFeedbackProvider>
  );
}
