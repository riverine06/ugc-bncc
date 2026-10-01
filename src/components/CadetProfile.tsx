/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Shield,
  Award,
  Compass,
  Calendar,
  Briefcase,
  MapPin,
  Clock,
  Phone,
  Mail,
  FileText,
  UserCheck,
  Zap,
  Plus,
  Activity,
  User,
  Edit,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Building2,
  ZoomIn,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { Member, BNCCRank, MemberStatus, User as SystemUser, UserRole, Camp, PlatoonApplication } from "../types";
import { hasEditorPrivileges } from "../services/auth";
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  getSingleDocument,
  softDeleteRecord,
  generateId
} from "../firebaseService";
import SEO from "./SEO";

interface CadetProfileProps {
  memberId: string;
  onBack: () => void;
  currentUser?: SystemUser | null;
}

interface ProfileDossier {
  member: Member;
  promotions: any[];
  leadership: any[];
  achievements: any[];
  certificates: any[];
  activities: any[];
  camps: any[];
  events: any[];
  timeline: any[];
}

interface EditCadetDossierProps {
  memberId: string;
  currentRank: BNCCRank;
  promotions: any[];
  achievements: any[];
  camps: any[];
  activities: any[];
  allCamps: Camp[];
  onRefresh: () => void;
  isAdmin: boolean;
  onCampCreated: () => void;
  memberFullName?: string;
  isPUOOrStaff?: boolean;
}

function EditCadetDossier({
  memberId,
  currentRank,
  promotions = [],
  achievements,
  camps,
  activities,
  allCamps,
  onRefresh,
  isAdmin,
  onCampCreated,
  memberFullName,
  isPUOOrStaff = false,
}: EditCadetDossierProps) {
  const showRankTab = isAdmin && !isPUOOrStaff;
  const [activeTab, setActiveTab] = React.useState<"rank" | "camps" | "achievements" | "activities">(showRankTab ? "rank" : "camps");
  const [submitting, setSubmitting] = React.useState(false);

  // In-Drawer Feedback and Confirmation
  const [notifyState, setNotifyState] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmModal, setConfirmModal] = React.useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const notify = (message: string, type: "success" | "error" = "success") => {
    setNotifyState({ message, type });
    setTimeout(() => setNotifyState(null), 4000);
  };

  // States for Rank
  const [rankForm, setRankForm] = React.useState({
    newRank: currentRank,
    description: "",
    date: new Date().toISOString().split("T")[0],
    promotedBy: "UGC Platoon Command",
  });
  const [editingPromotionId, setEditingPromotionId] = React.useState<string | null>(null);

  // States for Camps Checkboxes & Inline Edits
  const [inlineEditingCpId, setInlineEditingCpId] = React.useState<string | null>(null);
  const [inlineRole, setInlineRole] = React.useState("Participant");
  const [inlineAwards, setInlineAwards] = React.useState("");

  // States for Achievements
  const [achievementForm, setAchievementForm] = React.useState({
    title: "",
    description: "",
    issuedBy: "UGC Platoon Command",
    category: "Leadership",
    date: new Date().toISOString().split("T")[0],
  });
  const [editingAchievementId, setEditingAchievementId] = React.useState<string | null>(null);

  // States for Activities
  const [activityForm, setActivityForm] = React.useState({
    activityName: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [editingActivityId, setEditingActivityId] = React.useState<string | null>(null);

  // Sync activeTab when showRankTab changes
  React.useEffect(() => {
    setActiveTab(showRankTab ? "rank" : "camps");
  }, [showRankTab]);

  // Sync rankForm.newRank with currentRank when it changes (if not editing an existing promotion record)
  React.useEffect(() => {
    if (!editingPromotionId) {
      setRankForm((prev) => ({ ...prev, newRank: currentRank }));
    }
  }, [currentRank, editingPromotionId]);

  // Handle Rank update (Promote Rank)
  const handlePromoteRank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (editingPromotionId) {
        // Update existing promotion record
        await updateDocument("promotions", editingPromotionId, {
          newRank: rankForm.newRank,
          description: rankForm.description,
          date: rankForm.date,
          promotedBy: rankForm.promotedBy,
        });

        // Sync current cadet rank
        await updateDocument("cadets", memberId, { rank: rankForm.newRank });

        notify("Promotion record updated successfully!", "success");
        setEditingPromotionId(null);
      } else {
        // Create new promotion record
        const oldRank = currentRank;
        await updateDocument("cadets", memberId, { rank: rankForm.newRank });

        const pId = generateId("p");
        await createDocument("promotions", {
          id: pId,
          memberId: memberId,
          oldRank,
          newRank: rankForm.newRank,
          date: rankForm.date || new Date().toISOString().split("T")[0],
          promotedBy: rankForm.promotedBy || "UGC Platoon Command",
          description: rankForm.description,
        }, pId);

        notify(`Successfully promoted cadet rank to ${rankForm.newRank}!`, "success");
      }

      setRankForm({
        newRank: rankForm.newRank,
        description: "",
        date: new Date().toISOString().split("T")[0],
        promotedBy: "UGC Platoon Command",
      });
      onRefresh();
    } catch (err: any) {
      notify(err.message || "Failed to update promotion.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPromotion = (p: any) => {
    setEditingPromotionId(p.id);
    setRankForm({
      newRank: p.newRank || currentRank,
      description: p.description || "",
      date: p.date || new Date().toISOString().split("T")[0],
      promotedBy: p.promotedBy || "UGC Platoon Command",
    });
  };

  const handleDeletePromotion = (pId: string) => {
    setConfirmModal({
      title: "DELETE PROMOTION RECORD",
      message: "Are you sure you want to delete this promotion entry from service records?",
      onConfirm: async () => {
        try {
          await deleteDocument("promotions", pId);
          notify("Promotion record deleted!", "success");
          onRefresh();
        } catch (err: any) {
          notify(err.message || "Delete failed", "error");
        }
      },
    });
  };

  // Handle Camp actions (Toggle Attendance Checkbox and Inline Updates)
  const handleToggleCamp = async (campId: string) => {
    if (submitting) return;
    const existingCp = camps.find((cp) => cp.campId === campId);
    setSubmitting(true);

    try {
      if (existingCp) {
        // Unchecked: Delete participation record
        await deleteDocument("campParticipants", existingCp.id);
        notify("Camp attendance removed!", "success");
      } else {
        // Checked: Add participation record
        const cpId = generateId("cp");
        await createDocument("campParticipants", {
          id: cpId,
          memberId: memberId,
          campId,
          role: "Participant",
          awards: "",
        }, cpId);
        notify("Camp attendance registered!", "success");
      }
      onRefresh();
    } catch (err: any) {
      notify(err.message || "Camp action failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInlineSave = async (cpId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateDocument("campParticipants", cpId, {
        role: inlineRole,
        awards: inlineAwards,
      });
      notify("Camp details updated successfully!", "success");
      setInlineEditingCpId(null);
      onRefresh();
    } catch (err: any) {
      notify(err.message || "Failed to update camp details", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Achievement actions (Add / Update / Delete)
  const handleAchievementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const recipientName = memberFullName ? `${currentRank || ''} ${memberFullName}`.trim() : "Cadet Personnel";
      if (editingAchievementId) {
        await updateDocument("achievements", editingAchievementId, {
          ...achievementForm,
          recipient: recipientName,
          recipientId: memberId,
          memberId: memberId,
          cadetId: memberId,
        });
        notify("Achievement updated successfully!", "success");
      } else {
        const id = generateId("ach");
        await createDocument("achievements", {
          id,
          memberId,
          recipient: recipientName,
          recipientId: memberId,
          cadetId: memberId,
          medalType: "Gold",
          ...achievementForm,
        }, id);
        notify("Achievement added successfully!", "success");
      }
      setAchievementForm({
        title: "",
        description: "",
        issuedBy: "UGC Platoon Command",
        category: "Leadership",
        date: new Date().toISOString().split("T")[0],
      });
      setEditingAchievementId(null);
      onRefresh();
    } catch (err: any) {
      notify(err.message || "Failed to save achievement", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditAchievement = (ach: any) => {
    setEditingAchievementId(ach.id);
    setAchievementForm({
      title: ach.title || "",
      description: ach.description || "",
      issuedBy: ach.issuedBy || ach.campName || "UGC Platoon Command",
      category: ach.category || "Leadership",
      date: ach.date || new Date().toISOString().split("T")[0],
    });
  };

  const handleDeleteAchievement = (achId: string) => {
    setConfirmModal({
      title: "DELETE ACHIEVEMENT RECORD",
      message: "Are you sure you want to remove this achievement from cadet records?",
      onConfirm: async () => {
        try {
          await deleteDocument("achievements", achId);
          notify("Achievement record deleted!", "success");
          onRefresh();
        } catch (err: any) {
          notify(err.message || "Failed to delete achievement", "error");
        }
      },
    });
  };

  // Handle Activity actions (Add / Update / Delete)
  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (editingActivityId) {
        await updateDocument("activities", editingActivityId, activityForm);
        notify("Activity updated successfully!", "success");
      } else {
        const id = generateId("act");
        await createDocument("activities", {
          id,
          memberId,
          ...activityForm,
        }, id);
        notify("Activity added successfully!", "success");
      }
      setActivityForm({
        activityName: "",
        description: "",
        date: new Date().toISOString().split("T")[0],
      });
      setEditingActivityId(null);
      onRefresh();
    } catch (err: any) {
      notify(err.message || "Failed to save activity", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditActivity = (act: any) => {
    setEditingActivityId(act.id);
    setActivityForm({
      activityName: act.activityName,
      description: act.description,
      date: act.date,
    });
  };

  const handleDeleteActivity = (actId: string) => {
    setConfirmModal({
      title: "DELETE ACTIVITY RECORD",
      message: "Are you sure you want to delete this activity entry?",
      onConfirm: async () => {
        try {
          await deleteDocument("activities", actId);
          notify("Activity record deleted!", "success");
          onRefresh();
        } catch (err: any) {
          notify(err.message || "Failed to delete activity", "error");
        }
      },
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 dark:border-slate-800 rounded-lg p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Shield className="h-4 w-4 text-amber-500" />
          <div>
            <h4 className="font-display font-bold text-[10px] tracking-wider text-amber-500 uppercase">
              {isAdmin ? "ADMINISTRATIVE CONTROL" : "CADET SELF SERVICE"}
            </h4>
            <h3 className="font-display font-bold text-xs text-slate-100 uppercase">
              {isAdmin ? "EDIT CADET PROFILE" : "UPDATE DOSSIER DETAILS"}
            </h3>
          </div>
        </div>
        <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase">
          {isAdmin ? "ADMIN" : "CADET"}
        </span>
      </div>

      {/* In-Drawer Feedback Notification */}
      {notifyState && (
        <div
          role={notifyState.type === "error" ? "alert" : "status"}
          className={`p-3 rounded-lg text-xs font-mono flex items-center justify-between space-x-2 border transition-all ${
            notifyState.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/50 text-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notifyState.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span className="leading-snug">{notifyState.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotifyState(null)}
            className="text-slate-400 hover:text-white p-0.5"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* In-Drawer Confirmation Dialog */}
      {confirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
        >
          <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl">
            <div className="flex items-center space-x-2.5 text-rose-400">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider">{confirmModal.title}</h4>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 rounded text-xs font-mono text-slate-300 hover:bg-slate-800 border border-slate-700 min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await confirmModal.onConfirm();
                  } finally {
                    setConfirmModal(null);
                  }
                }}
                className="px-3.5 py-1.5 rounded text-xs font-mono font-bold bg-rose-600 hover:bg-rose-700 text-white min-h-[36px]"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs list */}
      <div className={`grid ${showRankTab ? "grid-cols-4" : "grid-cols-3"} gap-1 border-b border-slate-800 pb-2`}>
        {(showRankTab ? (["rank", "camps", "achievements", "activities"] as const) : (["camps", "achievements", "activities"] as const)).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`font-mono text-[9px] py-1.5 px-1 rounded uppercase font-bold text-center transition-all cursor-pointer ${
              activeTab === tab
                ? "bg-amber-500 text-slate-950 font-black shadow"
                : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {tab === "rank" ? "RANK" : tab === "camps" ? "CAMPS" : tab === "achievements" ? "MEDALS" : "ACTS"}
          </button>
        ))}
      </div>

      {/* Dynamic Content */}
      <div className="text-xs text-slate-300">
        {showRankTab && activeTab === "rank" && (
          <div className="space-y-4">
            <form onSubmit={handlePromoteRank} className="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] font-mono font-bold text-amber-500 uppercase block">
                {editingPromotionId ? "// UPDATE PROMOTION RECORD" : "// RE-ASSIGN OR PROMOTE CADET RANK"}
              </span>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                  Select Rank Assignment
                </label>
                <select
                  value={rankForm.newRank}
                  onChange={(e) => setRankForm({ ...rankForm, newRank: e.target.value as BNCCRank })}
                  className="bg-slate-900 border border-slate-800 rounded py-1.5 px-2 w-full text-slate-200 focus:outline-none focus:border-amber-500/50 font-mono text-xs"
                >
                  <option value={BNCCRank.RECRUIT}>Recruit</option>
                  <option value={BNCCRank.CADET}>Cadet</option>
                  <option value={BNCCRank.LANCE_CORPORAL}>Lance Corporal</option>
                  <option value={BNCCRank.CORPORAL}>Corporal</option>
                  <option value={BNCCRank.SERGEANT}>Sergeant</option>
                  <option value={BNCCRank.CADET_UNDER_OFFICER}>Cadet Under Officer (CUO)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                  Promotion Description / Order Reason
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Promoted for exemplary drill leadership and passing B-certificate examination..."
                  value={rankForm.description}
                  onChange={(e) => setRankForm({ ...rankForm, description: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded py-1.5 px-2 w-full text-slate-200 focus:outline-none focus:border-amber-500/50 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                    Promotion Date
                  </label>
                  <input
                    type="date"
                    required
                    value={rankForm.date}
                    onChange={(e) => setRankForm({ ...rankForm, date: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                    Promoted By / Authority
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UGC Platoon Command"
                    value={rankForm.promotedBy}
                    onChange={(e) => setRankForm({ ...rankForm, promotedBy: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono text-[10px] py-2 rounded uppercase font-bold cursor-pointer disabled:opacity-50 transition-all shadow"
                >
                  {submitting ? "PROCESSING..." : editingPromotionId ? "UPDATE PROMOTION RECORD" : "COMMIT RANK TRANSITION"}
                </button>
                {editingPromotionId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPromotionId(null);
                      setRankForm({
                        newRank: currentRank,
                        description: "",
                        date: new Date().toISOString().split("T")[0],
                        promotedBy: "UGC Platoon Command",
                      });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] px-3 py-2 rounded uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* List of promotion history records with manage/edit/delete options */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">
                // MANAGE PROMOTION RECORDS HISTORY
              </span>
              {!promotions || promotions.length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">Enlisted with rank {currentRank}. No promotion records logged.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {promotions.map((p) => (
                    <div key={p.id} className="bg-slate-950 p-2.5 rounded border border-slate-800 flex justify-between items-start gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[9px] text-amber-400 font-mono font-bold uppercase">{p.date}</span>
                          <span className="text-[8px] bg-slate-800 text-slate-300 font-mono px-1 py-0.2 rounded">Ex {p.oldRank}</span>
                        </div>
                        <strong className="text-slate-100 block font-display mt-0.5 text-xs">
                          {p.oldRank} ➔ <span className="text-amber-400">{p.newRank}</span>
                        </strong>
                        {p.description && (
                          <p className="text-slate-400 text-[10px] leading-relaxed mt-1 bg-slate-900/80 p-1.5 rounded border border-slate-850">
                            {p.description}
                          </p>
                        )}
                        <span className="text-[8px] text-slate-500 font-mono block mt-1">
                          By: {p.promotedBy || "UGC Platoon Command"}
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditPromotion(p)}
                          title="Edit promotion"
                          className="text-slate-400 hover:text-amber-400 p-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePromotion(p.id)}
                          title="Delete promotion"
                          className="text-slate-400 hover:text-red-400 p-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}        {activeTab === "camps" && (
          <div className="space-y-4 text-left">
            <div className="space-y-1.5 bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] font-mono font-bold text-amber-500 uppercase block tracking-wider">
                // CAMP PARTICIPATION REGISTRY
              </span>
              <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                Camp participation is managed centrally via the <strong>Admin Operations Hub &rarr; Camp Registry</strong>. Any camp assigned to this cadet in the Camp Registry will automatically synchronize to this profile dossier.
              </p>
            </div>

            {camps.length === 0 ? (
              <div className="bg-slate-950 p-4 rounded border border-slate-800 text-center text-xs font-mono text-slate-500 italic">
                NO CAMPS ASSIGNED TO THIS CADET IN THE CENTRAL REGISTRY.
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {camps.map((cp) => (
                  <div 
                    key={cp.id} 
                    className="p-3 rounded border bg-slate-950 border-amber-500/30 space-y-1"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <strong className="text-xs text-slate-200 font-display font-bold">
                        {cp.campName}
                      </strong>
                      <span className="text-[9px] font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded uppercase shrink-0">
                        {cp.role || "Participant"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 text-[9px] text-slate-400 font-mono">
                      <span>{cp.location || "Venue Unspecified"}</span>
                      <span>•</span>
                      <span>
                        {cp.startDate && cp.endDate
                          ? `${cp.startDate} to ${cp.endDate}`
                          : cp.startDate
                          ? `Commenced: ${cp.startDate}`
                          : cp.endDate
                          ? `Completed: ${cp.endDate}`
                          : "Dates Unspecified"}
                      </span>
                    </div>

                    {cp.awards && (
                      <div className="pt-1">
                        <span className="text-[9px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded inline-block font-bold uppercase">
                          ★ Award: {cp.awards}
                        </span>
                      </div>
                    )}

                    {cp.remarks && (
                      <p className="text-[10px] text-slate-400 italic pt-0.5">
                        Note: {cp.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="space-y-4">
            <form onSubmit={handleAchievementSubmit} className="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] font-mono font-bold text-amber-500 uppercase block">
                {editingAchievementId ? "// UPDATE ACHIEVEMENT RECORD" : "// RECORD NEW ACHIEVEMENT"}
              </span>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                  Achievement Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Best Air Rifles Shooter"
                  value={achievementForm.title}
                  onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                  Description
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Received recognition during National Day Parade..."
                  value={achievementForm.description}
                  onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">Issued By / Camp</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UGC Platoon Command"
                    value={achievementForm.issuedBy}
                    onChange={(e) => setAchievementForm({ ...achievementForm, issuedBy: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">Category</label>
                  <select
                    value={achievementForm.category}
                    onChange={(e) => setAchievementForm({ ...achievementForm, category: e.target.value })}
                    className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none font-mono text-xs"
                  >
                    <option value="Competition">Competition</option>
                    <option value="Drill">Drill</option>
                    <option value="Shooting">Shooting</option>
                    <option value="Community Service">Community Service</option>
                    <option value="Leadership">Leadership</option>
                    <option value="Camp Honor">Camp Honor</option>
                    <option value="Past Honor">Past Honor</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">Date</label>
                <input
                  type="date"
                  required
                  value={achievementForm.date}
                  onChange={(e) => setAchievementForm({ ...achievementForm, date: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none text-xs"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono text-[10px] py-1.5 rounded uppercase font-bold cursor-pointer disabled:opacity-50 transition-all"
                >
                  {submitting ? "SAVING..." : editingAchievementId ? "UPDATE RECORD" : "COMMIT ACHIEVEMENT"}
                </button>
                {editingAchievementId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAchievementId(null);
                      setAchievementForm({
                        title: "",
                        description: "",
                        date: new Date().toISOString().split("T")[0],
                      });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] px-3 py-1.5 rounded uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* List of achievements with management controls */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">
                // MANAGE INDIVIDUAL ACHIEVEMENTS
              </span>
              {achievements.length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">No individual achievements recorded.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {achievements.map((ach) => (
                    <div key={ach.id} className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-start gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] text-slate-400 font-mono block">{ach.date}</span>
                        <strong className="text-slate-200 block truncate font-display">{ach.title}</strong>
                        <p className="text-slate-500 text-[10px] leading-relaxed line-clamp-2 mt-0.5">
                          {ach.description}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditAchievement(ach)}
                          title="Edit"
                          className="text-slate-400 hover:text-amber-400 p-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAchievement(ach.id)}
                          title="Delete"
                          className="text-slate-400 hover:text-red-400 p-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "activities" && (
          <div className="space-y-4">
            <form onSubmit={handleActivitySubmit} className="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-[10px] font-mono font-bold text-amber-500 uppercase block">
                {editingActivityId ? "// UPDATE ACTIVITY RECORD" : "// RECORD NEW PLATOON ACTIVITY"}
              </span>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                  Activity Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Drill Parade at College Ground"
                  value={activityForm.activityName}
                  onChange={(e) => setActivityForm({ ...activityForm, activityName: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">
                  Description
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Led physical fitness routines and marching alignments..."
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 uppercase block font-semibold">Date</label>
                <input
                  type="date"
                  required
                  value={activityForm.date}
                  onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                  className="bg-slate-900 border border-slate-800 rounded py-1 px-2 w-full text-slate-200 focus:outline-none text-xs"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono text-[10px] py-1.5 rounded uppercase font-bold cursor-pointer disabled:opacity-50 transition-all"
                >
                  {submitting ? "RECORDING..." : editingActivityId ? "UPDATE RECORD" : "COMMIT ACTIVITY"}
                </button>
                {editingActivityId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingActivityId(null);
                      setActivityForm({
                        activityName: "",
                        description: "",
                        date: new Date().toISOString().split("T")[0],
                      });
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[10px] px-3 py-1.5 rounded uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* List of activities with management controls */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">
                // MANAGE PLATOON ACTIVITIES
              </span>
              {!activities || activities.length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">No individual platoon activities recorded.</p>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {activities.map((act) => (
                    <div key={act.id} className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-start gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] text-slate-400 font-mono block">{act.date}</span>
                        <strong className="text-slate-200 block truncate font-display">{act.activityName}</strong>
                        <p className="text-slate-500 text-[10px] leading-relaxed line-clamp-2 mt-0.5">
                          {act.description}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditActivity(act)}
                          title="Edit"
                          className="text-slate-400 hover:text-amber-400 p-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(act.id)}
                          title="Delete"
                          className="text-slate-400 hover:text-red-400 p-1 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CadetProfileProps {
  memberId: string;
  onBack: () => void;
  currentUser?: SystemUser | null;
}

interface ProfileDossier {
  member: Member;
  promotions: any[];
  leadership: any[];
  achievements: any[];
  certificates: any[];
  activities: any[];
  camps: any[];
  events: any[];
  timeline: any[];
}

export default function CadetProfile({ memberId, onBack, currentUser }: CadetProfileProps) {
  const [dossier, setDossier] = React.useState<ProfileDossier | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Authorization checks
  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
  const isSelf = currentUser?.memberId === memberId;
  const isAuthorized = isAdmin || isSelf;

  const [allCamps, setAllCamps] = React.useState<Camp[]>([]);

  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [profileNotification, setProfileNotification] = React.useState<{ message: string; type: "success" | "error" } | null>(null);
  const [deleteProfileDialog, setDeleteProfileDialog] = React.useState(false);
  const [deletingProfile, setDeletingProfile] = React.useState(false);
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsPhotoLightboxOpen(false);
      }
    };
    if (isPhotoLightboxOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPhotoLightboxOpen]);

  const showProfileNotice = (message: string, type: "success" | "error" = "success") => {
    setProfileNotification({ message, type });
    setTimeout(() => setProfileNotification(null), 4000);
  };

  const handleChangePhoto = async (newPhotoUrl: string) => {
    if (photoUploading) return;
    setPhotoUploading(true);
    try {
      await updateDocument("cadets", memberId, { photoUrl: newPhotoUrl });
      showProfileNotice("Profile photo successfully updated!", "success");
    } catch (err: any) {
      showProfileNotice(err.message || "Failed to update profile photo", "error");
    } finally {
      setPhotoUploading(false);
    }
  };

  const fetchDossier = () => {
    // Dossier is synced automatically in real-time via Firestore subscriptions
  };

  React.useEffect(() => {
    setLoading(true);
    let currentMember: Member | null = null;
    let rawPromotions: any[] = [];
    let rawLeadership: any[] = [];
    let rawAchievements: any[] = [];
    let rawCertificates: any[] = [];
    let rawActivities: any[] = [];
    let rawCampParticipants: any[] = [];
    let rawCamps: Camp[] = [];
    let rawEvents: any[] = [];
    let rawEventRegistrations: any[] = [];
    let rawApplications: PlatoonApplication[] = [];

    const processDossier = () => {
      if (!currentMember) {
        return;
      }

      const promotions = rawPromotions.filter((p) => p.memberId === memberId);
      const leadership = rawLeadership.filter((l) => l.memberId === memberId);
      const achievements = rawAchievements.filter((a) => a.memberId === memberId || a.recipientId === memberId || a.cadetId === memberId);
      const certificates = rawCertificates.filter((c) => c.memberId === memberId);
      const activities = rawActivities.filter((a) => a.memberId === memberId);

      // Camps - Deduplicate by campId or campName
      const participantRecords = rawCampParticipants.filter((cp) => cp.memberId === memberId);
      const campsWithRoles: any[] = [];
      const seenCampKeys = new Set<string>();

      participantRecords.forEach((pr) => {
        const campInfo = rawCamps.find((c) => c.id === pr.campId);
        const campName = campInfo?.name || pr.campName || "Battalion Camp";
        const key = `${pr.campId || ""}_${campName.toLowerCase().trim()}`;
        if (!seenCampKeys.has(key)) {
          seenCampKeys.add(key);
          campsWithRoles.push({
            ...pr,
            campName,
            location: campInfo?.location || pr.location || "Battalion Venue",
            startDate: campInfo?.startDate || pr.startDate || "",
            endDate: campInfo?.endDate || pr.endDate || "",
          });
        }
      });

      // CHECK FOR SUBMITTED APPLICATION CAMPS & ACHIEVEMENTS
      const matchingApp = rawApplications.find(
        (a) =>
          (a.cadetId && a.cadetId.trim().toUpperCase() === memberId.toUpperCase()) ||
          (a.email && currentMember?.email && a.email.trim().toLowerCase() === currentMember.email.trim().toLowerCase()) ||
          (a.phone && currentMember?.phone && a.phone.trim() === currentMember.phone.trim())
      );

      if (matchingApp) {
        // 1. Merge camp participations from application if missing
        if (matchingApp.campsParticipation && Array.isArray(matchingApp.campsParticipation)) {
          matchingApp.campsParticipation.forEach((appCamp) => {
            const campInfo = rawCamps.find((c) => c.id === appCamp.campId);
            const campName = campInfo?.name || appCamp.campName || "Battalion Camp";
            const key = `${appCamp.campId || ""}_${campName.toLowerCase().trim()}`;
            if (!seenCampKeys.has(key)) {
              seenCampKeys.add(key);
              campsWithRoles.push({
                id: `app_cp_${appCamp.campId}_${memberId}`,
                campId: appCamp.campId,
                memberId: memberId,
                role: appCamp.role || "Participant",
                awards: appCamp.achievements || "",
                remarks: "Submitted during application",
                campName,
                location: campInfo?.location || "Battalion Venue",
                startDate: campInfo?.startDate || "",
                endDate: campInfo?.endDate || "",
              });
            }
          });
        }

        // 2. Merge past achievements from application if missing
        if (matchingApp.pastAchievements && matchingApp.pastAchievements.trim()) {
          const pastAchTitle = matchingApp.pastAchievements.trim();
          const alreadyInAch = achievements.some(
            (a) => a.title?.toLowerCase().trim() === pastAchTitle.toLowerCase()
          );
          if (!alreadyInAch) {
            achievements.push({
              id: `app_ach_${memberId}`,
              memberId,
              title: pastAchTitle,
              description: "Historical achievement submitted during platoon application.",
              date: currentMember.joiningYear ? `${currentMember.joiningYear}-01-15` : new Date().toISOString().split("T")[0],
              category: "Past Honor"
            });
          }
        }
      }

      // Sort camps newest first
      campsWithRoles.sort((a, b) => {
        const dateA = a.startDate || a.endDate || "";
        const dateB = b.startDate || b.endDate || "";
        return dateB.localeCompare(dateA);
      });

      // Combine & Deduplicate Achievements (raw achievements + camp awards)
      const uniqueAchievementsMap = new Map<string, any>();

      // 1. Add raw achievements
      achievements.forEach((ach) => {
        const titleKey = (ach.title || "").toLowerCase().trim();
        if (titleKey && !uniqueAchievementsMap.has(titleKey)) {
          uniqueAchievementsMap.set(titleKey, ach);
        }
      });

      // 2. Add camp awards as achievements if not already present
      campsWithRoles.forEach((cp) => {
        if (cp.awards && cp.awards.trim() !== "") {
          const awardTitle = cp.awards.trim();
          const titleKey = awardTitle.toLowerCase();
          if (!uniqueAchievementsMap.has(titleKey)) {
            uniqueAchievementsMap.set(titleKey, {
              id: `camp_award_${cp.id}`,
              memberId,
              title: awardTitle,
              description: `Awarded "${awardTitle}" during ${cp.campName}${cp.location ? ` (${cp.location})` : ""} as ${cp.role || "Participant"}.`,
              date: cp.startDate || cp.endDate || new Date().toISOString().split("T")[0],
              isCampAward: true,
              campName: cp.campName,
            });
          }
        }
      });

      const combinedAchievements = Array.from(uniqueAchievementsMap.values());

      // Events
      const registrations = rawEventRegistrations.filter(
        (er) => er.memberIdStr === memberId && er.status === "Approved"
      );
      const events = registrations.map((r) => {
        const eventInfo = rawEvents.find((e) => e.id === r.eventId);
        return {
          eventId: r.eventId,
          eventName: eventInfo?.name || "Unknown Event",
          eventType: eventInfo?.eventType,
          date: eventInfo?.date || "",
          role: r.notes || "Participant",
        };
      });

      // GENERATE CHRONOLOGICAL TIMELINE (Deduplicated)
      interface TimelineItem {
        date: string;
        type: string;
        title: string;
        details: string;
        icon: string;
      }

      const timelineMap = new Map<string, TimelineItem>();
      const addTimelineItem = (item: TimelineItem) => {
        const key = `${item.date}_${item.type}_${item.title.toLowerCase().trim()}`;
        if (!timelineMap.has(key)) {
          timelineMap.set(key, item);
        }
      };

      // 1. Platoon Joining
      addTimelineItem({
        date: currentMember.joiningYear ? `${currentMember.joiningYear}-01-15` : new Date().toISOString().split("T")[0],
        type: "Joining",
        title: "Enlisted in UGC BNCC Platoon",
        details: `Joined as a recruit during the ${currentMember.session || "Platoon"} session in the ${currentMember.department || "General"} group.`,
        icon: "ShieldAlert",
      });

      // 2. Promotions
      if (promotions.length > 0) {
        promotions.forEach((p) => {
          addTimelineItem({
            date: p.date || new Date().toISOString().split("T")[0],
            type: "Promotion",
            title: `Promoted to ${p.newRank}`,
            details: `Officially promoted from ${p.oldRank || "Recruit"} to ${p.newRank} by authority of ${p.promotedBy || "UGC Platoon Command"}.${p.description ? ` Order/Reason: ${p.description}` : ""}`,
            icon: "Award",
          });
        });
      } else if (currentMember.rank) {
        addTimelineItem({
          date: currentMember.joiningYear ? `${currentMember.joiningYear}-01-15` : new Date().toISOString().split("T")[0],
          type: "Promotion",
          title: `Initial Rank Assignment: ${currentMember.rank}`,
          details: `Enlisted with current rank of ${currentMember.rank} in UGC BNCC Platoon.`,
          icon: "Award",
        });
      }

      // 3. Leadership Roles
      leadership.forEach((l) => {
        addTimelineItem({
          date: l.startDate || l.appointmentDate || `${currentMember.joiningYear || 2024}-06-01`,
          type: "Leadership",
          title: `Assumed Role: ${l.position || l.title}`,
          details: `Appointed as Platoon leadership. ${l.current || l.status === "Active" ? "Currently serving in this role." : `Completed tenure on ${l.endDate || "record"}.`}`,
          icon: "UserCheck",
        });
      });

      // 4. Camps
      campsWithRoles.forEach((cp) => {
        addTimelineItem({
          date: cp.startDate || `${currentMember.joiningYear || 2024}-08-01`,
          type: "Camp",
          title: `Attended ${cp.campName}`,
          details: `Participated at ${cp.location} as ${cp.role || "Participant"}.${cp.awards ? ` Received award: ${cp.awards}.` : ""}`,
          icon: "Compass",
        });
      });

      // 5. Achievements (including camp awards!)
      combinedAchievements.forEach((ach) => {
        addTimelineItem({
          date: ach.date || `${currentMember.joiningYear || 2024}-09-01`,
          type: "Achievement",
          title: `Awarded: ${ach.title}`,
          details: ach.description,
          icon: "Medal",
        });
      });

      // 6. Activities
      activities.forEach((act) => {
        addTimelineItem({
          date: act.date || `${currentMember.joiningYear || 2024}-10-01`,
          type: "Activity",
          title: act.activityName,
          details: act.description,
          icon: "Activity",
        });
      });

      // 7. Event Participations
      events.forEach((evt) => {
        addTimelineItem({
          date: evt.date || `${currentMember.joiningYear || 2024}-11-01`,
          type: "Event",
          title: `Participated in ${evt.eventName}`,
          details: `Attended as ${evt.role}. Event category: ${evt.eventType || "Platoon Event"}.`,
          icon: "CalendarCheck",
        });
      });

      const timeline = Array.from(timelineMap.values());

      // Sort timeline chronologically (latest first)
      timeline.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        if (isNaN(timeA)) return 1;
        if (isNaN(timeB)) return -1;
        return timeB - timeA;
      });

      setDossier({
        member: currentMember!,
        promotions,
        leadership,
        achievements: combinedAchievements,
        certificates,
        activities,
        camps: campsWithRoles,
        events,
        timeline,
      });
      setError(null);
      setLoading(false);
    };

    const unsubCadets = subscribeToCollection<Member>("cadets", (cadetsList) => {
      const found = cadetsList.find((c) => c.id === memberId);
      if (found) {
        currentMember = found;
        processDossier();
      } else {
        setError("Cadet profile not found.");
        setLoading(false);
      }
    });

    const unsubPromotions = subscribeToCollection<any>("promotions", (list) => {
      rawPromotions = list;
      processDossier();
    });

    const unsubLeadership = subscribeToCollection<any>("leadership", (list) => {
      rawLeadership = list;
      processDossier();
    });

    const unsubAchievements = subscribeToCollection<any>("achievements", (list) => {
      rawAchievements = list;
      processDossier();
    });

    const unsubCertificates = subscribeToCollection<any>("certificates", (list) => {
      rawCertificates = list;
      processDossier();
    });

    const unsubActivities = subscribeToCollection<any>("activities", (list) => {
      rawActivities = list;
      processDossier();
    });

    const unsubCampParticipants = subscribeToCollection<any>("campParticipants", (list) => {
      rawCampParticipants = list;
      processDossier();
    });

    const unsubCamps = subscribeToCollection<Camp>("camps", (list) => {
      rawCamps = list;
      setAllCamps(list);
      processDossier();
    });

    const unsubEvents = subscribeToCollection<any>("events", (list) => {
      rawEvents = list;
      processDossier();
    });

    let unsubEventRegs = () => {};
    let unsubApplications = () => {};

    if (currentUser && hasEditorPrivileges(currentUser.role)) {
      unsubEventRegs = subscribeToCollection<any>("eventRegistrations", (list) => {
        rawEventRegistrations = list;
        processDossier();
      });

      unsubApplications = subscribeToCollection<PlatoonApplication>("applications", (list) => {
        rawApplications = list;
        processDossier();
      });
    }

    return () => {
      unsubCadets();
      unsubPromotions();
      unsubLeadership();
      unsubAchievements();
      unsubCertificates();
      unsubActivities();
      unsubCampParticipants();
      unsubCamps();
      unsubEvents();
      unsubEventRegs();
      unsubApplications();
    };
  }, [memberId, currentUser]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10 animate-pulse">
        {/* Back button skeleton */}
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-850 rounded"></div>

        {/* Header/ID Card skeleton */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-slate-100 dark:bg-slate-800/50 h-16 w-full flex items-center px-6">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
          <div className="p-6 md:p-8 grid md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-40 h-40 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
            </div>
            <div className="md:col-span-3 space-y-4 pt-2">
              <div className="h-7 w-2/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4">
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content columns skeleton */}
        <div className="grid lg:grid-cols-3 gap-8 pt-4">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-4"></div>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0"></div>
                <div className="space-y-2 w-full">
                  <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-3 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 flex-shrink-0"></div>
                <div className="space-y-2 w-full">
                  <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"></div>
            <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-400 p-6 rounded-lg max-w-md mx-auto">
          <p className="font-display font-bold uppercase">LEDGER ACCESS EXCEPTION</p>
          <p className="text-xs mt-2">{error || "Failed to parse records."}</p>
        </div>
        <button
          onClick={onBack}
          className="mt-6 inline-flex items-center space-x-1 text-xs text-army-700 dark:text-amber-400 font-mono font-bold hover:underline uppercase cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Cadet Directory</span>
        </button>
      </div>
    );
  }

  const { member, promotions, leadership, achievements, camps, events, timeline, activities } = dossier;



  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10 relative">
      {/* Profile-level toast notification */}
      {profileNotification && (
        <div
          role={profileNotification.type === "error" ? "alert" : "status"}
          className={`fixed top-5 right-5 z-[100] max-w-md p-4 rounded-xl shadow-xl flex items-center justify-between space-x-3 border font-mono text-xs ${
            profileNotification.type === "success"
              ? "bg-slate-900 border-emerald-500/50 text-emerald-200"
              : "bg-slate-900 border-rose-500/50 text-rose-200"
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {profileNotification.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
            )}
            <span className="font-sans leading-snug">{profileNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setProfileNotification(null)}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Profile-level delete confirmation modal */}
      {deleteProfileDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
        >
          <div className="bg-slate-900 border border-rose-600/50 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-sm font-mono font-bold uppercase tracking-wider">
                CONFIRM CADET PROFILE DELETION
              </h3>
            </div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              CRITICAL SECTOR ALERT: You are about to move this cadet's official BNCC service record,
              including promotion logs, achievements, and camp participation to the institutional Recycle Bin.
            </p>
            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                disabled={deletingProfile}
                onClick={() => setDeleteProfileDialog(false)}
                className="px-4 py-2 rounded-lg text-xs font-mono text-slate-300 hover:bg-slate-800 border border-slate-700 min-h-[40px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingProfile}
                onClick={async () => {
                  setDeletingProfile(true);
                  try {
                    await softDeleteRecord(
                      "cadets",
                      member.id,
                      `${member.rank} ${member.fullName}`,
                      member,
                      currentUser?.email || "admin@ugcbncc.org",
                      currentUser?.id || "admin"
                    );
                    showProfileNotice("Profile successfully moved to Recycle Bin.", "success");
                    setDeleteProfileDialog(false);
                    setTimeout(() => onBack(), 1200);
                  } catch (err: any) {
                    showProfileNotice(err.message || "Failed to delete profile", "error");
                    setDeletingProfile(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-rose-600 hover:bg-rose-700 text-white min-h-[40px] flex items-center space-x-1.5 disabled:opacity-50"
              >
                {deletingProfile ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Archiving...</span>
                  </>
                ) : (
                  <span>Confirm Delete</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <SEO
        title={`${member.rank} ${member.fullName} | UGC BNCC Service Record`}
        description={`Verified military service record, promotions, training camps, and commendations of ${member.rank} ${member.fullName} at Uttara Government College BNCC Platoon.`}
        canonicalPath={`/cadets/${member.id}`}
        ogType="profile"
        ogImage={member.photoUrl}
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Cadet Directory", url: "/directory" },
          { name: member.fullName, url: `/cadets/${member.id}` }
        ]}
      />

      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-army-800 dark:text-slate-400 dark:hover:text-amber-400 font-mono font-bold uppercase transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Cadet Directory</span>
      </button>

      {/* 1. Official Military ID Card Header */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border-2 border-army-800 dark:border-slate-700 shadow-md overflow-hidden relative">
        <div className="bg-army-900 dark:bg-slate-950 text-white px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b-2 border-amber-500">
          <div>
            <span className="text-[9px] font-mono tracking-widest text-amber-400 uppercase block">
              OFFICIAL SERVICE PROFILE
            </span>
            <h1 className="text-xl font-display font-extrabold tracking-wider uppercase text-white">
              {member.fullName}
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setDeleteProfileDialog(true)}
                className="bg-red-600/90 hover:bg-red-700 text-white font-mono text-xs font-bold px-3 py-1.5 rounded flex items-center space-x-1 transition-all cursor-pointer shadow min-h-[36px]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>DELETE PROFILE</span>
              </button>
            )}
            {!(member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER || member.status === MemberStatus.FORMER_PUO) ? (
              <div className="bg-army-950 dark:bg-slate-900 px-3 py-1.5 rounded border border-army-700 dark:border-slate-800 font-mono text-xs text-amber-400">
                CADET ID: {member.id}
              </div>
            ) : (
              <div className="bg-amber-500/20 px-3 py-1.5 rounded border border-amber-500/50 font-mono text-xs text-amber-300 font-bold uppercase">
                {member.status === MemberStatus.FORMER_PUO ? "FORMER PLATOON COMMANDER" : "FACULTY PLATOON COMMANDER"}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 md:p-8 grid md:grid-cols-4 gap-8">
          {/* Profile Photo Column */}
          <div className="flex flex-col items-center space-y-3">
            <div 
              className="relative group cursor-pointer"
              onClick={() => setIsPhotoLightboxOpen(true)}
              title="Click to view enlarged portrait photograph"
            >
              <img
                src={member.photoUrl}
                alt={`Official Service Portrait - Cadet ${member.rank} ${member.fullName}`}
                className="w-40 h-40 rounded-lg object-cover border-4 border-slate-100 dark:border-slate-800 shadow-md group-hover:border-amber-500 transition-all duration-200 group-hover:scale-[1.02]"
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center space-y-1 text-white font-mono text-[10px] font-bold pointer-events-none">
                <ZoomIn className="h-5 w-5 text-amber-400 animate-pulse" />
                <span className="text-amber-300 tracking-wider">ENLARGE</span>
              </div>
              {member.verified && (
                <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1 rounded-full border-2 border-white dark:border-slate-800 shadow shadow-emerald-800/50 z-10" title="Admin Verified Profile">
                  <UserCheck className="h-4 w-4" />
                </div>
              )}
            </div>

            {isAuthorized && (
              <div className="w-full text-center">
                <label className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 font-mono text-[10px] font-bold px-3 py-1.5 rounded cursor-pointer transition-all border border-slate-300 dark:border-slate-700">
                  <span>{photoUploading ? "UPDATING..." : "CHANGE PHOTO"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={photoUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          handleChangePhoto(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <div className="text-center w-full space-y-1">
              <span className={`text-xs font-bold px-3 py-1.5 rounded-md font-mono uppercase block tracking-wider shadow-sm border ${
                member.status === MemberStatus.FORMER_PUO
                  ? "bg-slate-800 text-amber-300 border-amber-500/40"
                  : member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER
                  ? "bg-amber-500 text-slate-950 border-amber-400 font-black"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-500/50"
              }`}>
                {member.status === MemberStatus.FORMER_PUO ? "Former PUO" : member.rank}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase block">
                STATUS: {member.isArmyStaff 
                  ? "Assigned Army Staff" 
                  : member.status === MemberStatus.FORMER_PUO
                  ? "Former Platoon Commander (Tenure Concluded)"
                  : member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER
                  ? "Active Platoon Commander (Faculty PUO)" 
                  : member.status}
              </span>
              <div className="pt-2">
                <span className="inline-flex items-center text-[9px] font-mono bg-emerald-500/10 border border-emerald-500 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded uppercase font-bold">
                  {member.isArmyStaff 
                    ? "✓ Active Duty Staff" 
                    : member.status === MemberStatus.FORMER_PUO
                    ? "✓ Service Concluded (Former PUO)"
                    : member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER
                    ? "✓ Active Platoon Commander (PUO)" 
                    : "✓ Combat Fit"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats & Contact Details */}
          <div className="md:col-span-3 space-y-6">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 text-xs border-b border-slate-100 dark:border-slate-800 pb-5">
              <div>
                <span className="text-[9px] font-mono text-slate-400 block uppercase">
                  {member.isArmyStaff 
                    ? "Military Appointment" 
                    : member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER || member.status === MemberStatus.FORMER_PUO
                    ? "Faculty Designation & Dept" 
                    : "HSC Group"}
                </span>
                <strong className="text-slate-900 dark:text-slate-100 font-display text-sm uppercase">{member.department}</strong>
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-400 block uppercase">
                  {member.isArmyStaff || member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER || member.status === MemberStatus.FORMER_PUO 
                    ? "Service / Posting Session" 
                    : "Academic Session"}
                </span>
                <strong className="text-slate-900 dark:text-slate-100 font-display text-sm">{member.session}</strong>
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-400 block uppercase">Blood Group</span>
                <strong className="text-red-700 dark:text-red-400 font-display text-sm uppercase">{member.bloodGroup}</strong>
              </div>
              <div>
                <span className="text-[9px] font-mono text-slate-400 block uppercase">
                  {member.isArmyStaff 
                    ? "Posting Year" 
                    : member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER || member.status === MemberStatus.FORMER_PUO
                    ? "Appointment Year" 
                    : "Enlisted Year"}
                </span>
                <strong className="text-slate-900 dark:text-slate-100 font-display text-sm">{member.joiningYear}</strong>
              </div>
              {(member.servicePeriod || member.status === MemberStatus.FORMER_PUO || member.status === MemberStatus.PLATOON_OFFICER) && (
                <div>
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">Service Period / Tenure</span>
                  <strong className="text-amber-600 dark:text-amber-400 font-mono text-xs">{member.servicePeriod || `${member.joiningYear} - Present`}</strong>
                </div>
              )}
              {member.graduationYear && (
                <div>
                  <span className="text-[9px] font-mono text-slate-400 block uppercase">Graduation Year</span>
                  <strong className="text-amber-700 dark:text-amber-400 font-display text-sm">{member.graduationYear}</strong>
                </div>
              )}
            </div>

            {/* CURRENT SERVICE & PROFESSIONAL DETAILS */}
            {(() => {
              const hasDesignation = Boolean(member.currentProfession && member.currentProfession.trim());
              const hasOrganization = Boolean(member.currentOrganization && member.currentOrganization.trim());
              const hasCity = Boolean(member.currentCity && member.currentCity.trim());
              
              const shouldShowSection = hasDesignation || hasOrganization || hasCity;
              if (!shouldShowSection) return null;

              const cardCount = [hasDesignation, hasOrganization, hasCity].filter(Boolean).length;

              return (
                <div className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4 space-y-2.5 shadow-xs">
                  {/* Section Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-2">
                    <div className="flex items-center space-x-2">
                      <div className="p-1.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30 rounded-md shrink-0">
                        <Briefcase className="h-3.5 w-3.5" />
                      </div>
                      <h4 className="font-display font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                        CURRENT SERVICE & PROFESSIONAL DETAILS
                      </h4>
                    </div>
                    <span className="self-start sm:self-auto text-[9px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      OFFICIAL DOSSIER RECORD
                    </span>
                  </div>

                  {/* Professional Detail Cards */}
                  <div className={`grid grid-cols-1 ${cardCount === 1 ? "sm:grid-cols-1" : cardCount === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 md:grid-cols-3"} gap-2.5`}>
                    {/* 1. CURRENT DESIGNATION / ROLE */}
                    {hasDesignation && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 flex items-start space-x-2.5 transition-colors hover:border-amber-500/40">
                        <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
                          <Briefcase className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block truncate">
                            CURRENT DESIGNATION / ROLE
                          </span>
                          <strong className="text-xs sm:text-sm font-sans font-bold text-slate-900 dark:text-slate-100 block break-words leading-tight mt-0.5">
                            {member.currentProfession}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* 2. COMPANY / ORGANIZATION */}
                    {hasOrganization && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 flex items-start space-x-2.5 transition-colors hover:border-amber-500/40">
                        <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block truncate">
                            COMPANY / ORGANIZATION
                          </span>
                          <strong className="text-xs sm:text-sm font-sans font-bold text-amber-600 dark:text-amber-400 block break-words leading-tight mt-0.5">
                            {member.currentOrganization}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* 3. DUTY STATION / CITY */}
                    {hasCity && (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 sm:p-3 flex items-start space-x-2.5 transition-colors hover:border-amber-500/40">
                        <div className="p-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-mono font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase block truncate">
                            DUTY STATION / CITY
                          </span>
                          <strong className="text-xs sm:text-sm font-sans font-bold text-slate-900 dark:text-slate-100 block break-words leading-tight mt-0.5">
                            {member.currentCity}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Biography */}
            <div>
              <span className="text-[9px] font-mono text-slate-400 block uppercase mb-1">
                Platoon Biography
              </span>
              <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-sans font-light bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-100 dark:border-slate-800 italic">
                "{member.biography}"
              </p>
            </div>

            {/* Contact Details */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400 pt-1 border-b border-slate-100 dark:border-slate-800 pb-4">
              {member.hideContactInfo ? (
                <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 italic font-mono text-[10px]">
                  <Shield className="h-4 w-4 text-amber-500" />
                  <span>CONTACT INFO RESTRICTED BY ADMINISTRATOR</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center space-x-1.5">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{member.phone}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{member.email}</span>
                  </div>
                </>
              )}
              {member.status === MemberStatus.ALUMNI && member.currentCity && (
                <div className="flex items-center space-x-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>Located in {member.currentCity}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* NEW SECTION: VISUAL RANK PROGRESSION SLIDER */}
      {!(
        member.isArmyStaff || 
        member.rank === BNCCRank.PLATOON_UNDER_OFFICER || 
        member.rank === "Platoon Under Officer (PUO)" ||
        member.status === MemberStatus.PLATOON_OFFICER ||
        member.status === MemberStatus.FORMER_PUO
      ) && (() => {
        const getRankLevel = (rankStr: string): number => {
          if (!rankStr) return 1;
          const r = rankStr.toLowerCase();
          if (r.includes("cuo") || r.includes("under officer")) return 5;
          if (r.includes("sergeant") || r.includes("sgt")) return 4;
          if (r.includes("lance") || r.includes("l/cpl") || r.includes("l/c")) return 2;
          if (r.includes("corporal") || r.includes("cpl")) return 3;
          if (r.includes("cadet") || r.includes("recruit")) return 1;
          return 1;
        };

        const currentRankLevel = getRankLevel(member.rank);
        const progressWidth = `${((Math.max(1, Math.min(5, currentRankLevel)) - 1) / 4) * 100}%`;

        const rankSteps = [
          { level: 1, name: "Cadet", shortName: "Cadet", sub: "Enlistment" },
          { level: 2, name: "Lance Corporal", shortName: "L/Cpl", sub: "Level I Promo" },
          { level: 3, name: "Corporal", shortName: "Cpl", sub: "Level II Promo" },
          { level: 4, name: "Sergeant", shortName: "Sgt", sub: "Level III Promo" },
          { level: 5, name: "CUO", shortName: "CUO", sub: "Under Officer" },
        ];

        return (
          <section className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="font-display font-extrabold text-xs sm:text-sm text-army-950 dark:text-amber-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800 text-center">
              CADET RANK PROGRESSION PATHWAY
            </h4>
            <div className="relative pt-2 sm:pt-4 pb-2">
              {/* Progress Connector Track */}
              <div className="absolute top-6 sm:top-8 left-4 sm:left-6 right-4 sm:right-6 h-1 bg-slate-100 dark:bg-slate-800 rounded-full pointer-events-none">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-300" 
                  style={{ width: progressWidth }}
                ></div>
              </div>

              <div className="grid grid-cols-5 text-center relative z-10 text-[10px] sm:text-xs font-mono">
                {rankSteps.map((step) => {
                  const isAchieved = step.level <= currentRankLevel;
                  const isCurrent = step.level === currentRankLevel;

                  return (
                    <div key={step.level} className="space-y-1 sm:space-y-2">
                      <div
                        className={`mx-auto h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm border-2 transition-all ${
                          isCurrent
                            ? "bg-amber-500 text-army-950 border-amber-600 scale-105 sm:scale-110 shadow-md ring-2 sm:ring-4 ring-amber-500/20"
                            : isAchieved
                            ? "bg-amber-500 text-army-950 border-amber-600 shadow-sm"
                            : "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-400"
                        }`}
                      >
                        {step.level}
                      </div>
                      <span
                        className={`font-bold block leading-tight text-[10px] sm:text-xs ${
                          isAchieved
                            ? "text-slate-900 dark:text-amber-300"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        <span className="sm:hidden">{step.shortName}</span>
                        <span className="hidden sm:inline">{step.name}</span>
                      </span>
                      <span
                        className={`text-[9px] hidden sm:block ${
                          isAchieved
                            ? "text-amber-600 dark:text-amber-400/80 font-semibold"
                            : "text-slate-400 dark:text-slate-600"
                        }`}
                      >
                        {step.sub}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* NEW SECTION: VISUAL TACTICAL MEDALS CHEST */}
      <section className="bg-gradient-to-r from-army-950 to-slate-950 p-6 rounded-xl border border-army-800 shadow-xl text-white space-y-4">
        <div className="text-center space-y-1">
          <span className="text-[9px] font-mono tracking-widest text-amber-400 uppercase block">
            ★ REGIMENTAL RECOGNITION REGISTRY ★
          </span>
          <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider">
            CADET REGULATION AWARDS & DECORATIONS
          </h4>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {achievements.length === 0 ? (
            <div className="col-span-full text-center text-xs text-slate-400 italic py-4">
              Profile contains no custom-earned specialized decoration awards yet.
            </div>
          ) : (
            achievements.map((ach: any, idx: number) => (
              <div key={idx} className="bg-army-900/60 p-4 rounded-lg border border-amber-500/30 text-center space-y-2 flex flex-col items-center hover:border-amber-500/60 transition-colors shadow-sm">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-1">
                  <Award className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-mono text-amber-400 uppercase block font-bold">
                    {ach.isCampAward ? "★ Camp Award" : "Earned Decoration"}
                  </span>
                  <strong className="text-xs block font-display line-clamp-1 text-white font-bold">{ach.title}</strong>
                  <p className="text-[9px] text-slate-300 leading-tight line-clamp-2">{ach.description}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 2. Dossier Content Grid: Timeline vs Military Awards/Camps */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Automated Chronological Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center space-x-2 border-b-2 border-army-700 dark:border-slate-800 pb-2">
            <Clock className="h-5 w-5 text-army-700 dark:text-amber-400" />
            <h3 className="text-base font-display font-bold text-army-950 dark:text-slate-100 uppercase">
              AUTOMATED SERVICE TIMELINE
            </h3>
          </div>

          <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6">
            {timeline.length === 0 ? (
              <p className="text-slate-500 italic text-xs">No service records registered in chronological timeline.</p>
            ) : (
              timeline.map((item, index) => (
                <div key={index} className="relative">
                  {/* Circle dot */}
                  <div className="absolute -left-[31px] top-1.5 bg-white dark:bg-slate-950 border-2 border-army-600 dark:border-amber-500 rounded-full h-3.5 w-3.5 flex items-center justify-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono block">{item.date}</span>
                  <h4 className="font-display font-bold text-slate-900 dark:text-slate-100 text-sm mt-0.5">{item.title}</h4>
                  <p className="text-slate-600 dark:text-slate-400 text-xs mt-1 leading-relaxed">{item.details}</p>
                </div>
              ))
            )}
          </div>
        </div>        {/* RIGHT COLUMN: Certifications, Promotions history, camps */}
        <div className="space-y-8">
          
          {/* ADMINISTRATIVE CONTROL DOSSIER SUB-COMPONENT */}
          {isAuthorized && (
            <EditCadetDossier
              memberId={memberId}
              currentRank={member.rank}
              promotions={promotions}
              achievements={achievements}
              camps={camps}
              activities={activities}
              allCamps={allCamps}
              onRefresh={fetchDossier}
              isAdmin={isAdmin}
              onCampCreated={() => {}}
              memberFullName={member.fullName}
              isPUOOrStaff={
                member.rank === BNCCRank.PLATOON_UNDER_OFFICER || 
                member.status === MemberStatus.PLATOON_OFFICER || 
                member.status === MemberStatus.FORMER_PUO || 
                member.isArmyStaff
              }
            />
          )}

          {/* Rank Promotion Log (Admins Only to Modify, Visible to all) */}
          {!(
            member.rank === BNCCRank.PLATOON_UNDER_OFFICER || 
            member.status === MemberStatus.PLATOON_OFFICER || 
            member.status === MemberStatus.FORMER_PUO || 
            member.isArmyStaff
          ) && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="font-display font-bold text-sm text-army-950 dark:text-amber-400 flex items-center space-x-1.5">
                  <Award className="h-4 w-4 text-amber-500" />
                  <span className="uppercase">RANK PROMOTIONS LOG</span>
                </h4>
              </div>

              <div className="space-y-3 text-xs pt-2">
                {promotions.length === 0 ? (
                  <p className="text-slate-500 italic text-[11px]">Enlisted with rank {member.rank}. No promotion history.</p>
                ) : (
                  promotions.map((p) => (
                    <div key={p.id} className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0 font-mono space-y-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] text-slate-400 block">{p.date}</span>
                          <p className="text-slate-900 dark:text-slate-100 font-bold uppercase text-xs">
                            {p.oldRank} ➔ <span className="text-amber-600 dark:text-amber-400">{p.newRank}</span>
                          </p>
                        </div>
                        <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300/70 dark:border-amber-500/40 px-1.5 py-0.5 rounded font-bold shrink-0">
                          Ex {p.oldRank}
                        </span>
                      </div>
                      {p.description && (
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] font-sans leading-relaxed bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800/60">
                          {p.description}
                        </p>
                      )}
                      <span className="text-[9px] text-slate-500 font-mono block">
                        Authority: {p.promotedBy || "UGC Platoon Command"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Camp participations */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-display font-bold text-sm text-army-950 dark:text-amber-400 flex items-center space-x-1.5">
                <Compass className="h-4 w-4 text-army-700 dark:text-amber-400" />
                <span className="uppercase">CAMP PARTICIPATIONS</span>
              </h4>
            </div>

            <div className="space-y-3.5 text-xs pt-2">
              {camps.length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">No camps registered.</p>
              ) : (
                camps.map((cp) => (
                  <div key={cp.id} className="border-b border-slate-50 dark:border-slate-950 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono block uppercase font-bold">{cp.role || "Participant"}</span>
                      {cp.startDate && (
                        <span className="text-[9px] text-slate-400 font-mono">
                          {cp.startDate} {cp.endDate ? `to ${cp.endDate}` : ""}
                        </span>
                      )}
                    </div>
                    <strong className="text-slate-900 dark:text-slate-100 block font-display mt-0.5">{cp.campName}</strong>
                    <p className="text-slate-500 text-[11px] mt-0.5 flex items-center space-x-1">
                      <MapPin className="h-3 w-3 flex-shrink-0 text-slate-400" />
                      <span>{cp.location}</span>
                    </p>
                    {cp.awards && (
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded w-fit mt-1.5 uppercase border border-emerald-200 dark:border-emerald-900/40 font-bold">
                        ★ Award: {cp.awards}
                      </p>
                    )}
                    {cp.remarks && (
                      <p className="text-[10px] text-slate-500 font-mono mt-1 italic">
                        Remarks: {cp.remarks}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Achievements & Medals */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex justify-between items-center">
              <h4 className="font-display font-bold text-sm text-army-950 dark:text-amber-400 flex items-center space-x-1.5">
                <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="uppercase">ACHIEVEMENTS & MEDALS</span>
              </h4>
              {achievements.length > 0 && (
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-mono px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-900/50">
                  {achievements.length} Earned
                </span>
              )}
            </div>

            <div className="space-y-3 text-xs pt-2">
              {achievements.length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">No individual achievements recorded.</p>
              ) : (
                achievements.map((ach: any) => (
                  <div key={ach.id} className="border-b border-slate-50 dark:border-slate-950 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 font-mono block">{ach.date}</span>
                      {ach.isCampAward && (
                        <span className="text-[9px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-mono px-1.5 py-0.2 rounded font-bold border border-emerald-200 dark:border-emerald-900 uppercase">
                          ★ Camp Award
                        </span>
                      )}
                    </div>
                    <strong className="text-slate-900 dark:text-slate-100 block font-display mt-0.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                      ★ {ach.title}
                    </strong>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed mt-0.5">{ach.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Platoon Activities (Admins or Self can Add) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-display font-bold text-sm text-army-950 dark:text-amber-400 flex items-center space-x-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="uppercase">PLATOON ACTIVITIES</span>
              </h4>
            </div>

            <div className="space-y-3 text-xs pt-2">
              {!activities || activities.length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">No individual platoon activities recorded.</p>
              ) : (
                activities.map((act: any) => (
                  <div key={act.id} className="border-b border-slate-50 dark:border-slate-950 pb-2 last:border-0 last:pb-0">
                    <span className="text-[10px] text-slate-400 font-mono block">{act.date}</span>
                    <strong className="text-slate-900 dark:text-slate-100 block font-display mt-0.5">{act.activityName}</strong>
                    <p className="text-slate-500 text-[11px] leading-relaxed mt-0.5">{act.description}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Platoon Events (Display of Approved Events) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h4 className="font-display font-bold text-sm text-army-950 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center space-x-1.5">
              <Calendar className="h-4 w-4 text-amber-500" />
              <span className="uppercase">REGISTERED PLATOON EVENTS</span>
            </h4>
            <div className="space-y-3.5 text-xs">
              {events.length === 0 ? (
                <p className="text-slate-500 italic text-[11px]">No registered drills or platoon events.</p>
              ) : (
                events.map((evt: any, idx: number) => (
                  <div key={idx} className="border-b border-slate-50 dark:border-slate-950 pb-2 last:border-0 last:pb-0">
                    <span className="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono uppercase font-bold">
                      {evt.eventType || "Event"}
                    </span>
                    <strong className="text-slate-900 dark:text-slate-100 block font-display mt-1">{evt.eventName}</strong>
                    <div className="text-slate-500 text-[11px] mt-0.5 flex flex-col gap-0.5 font-mono">
                      <div>DATE: {evt.date}</div>
                      <div>ROLE: {evt.role}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Full Portrait Lightbox Modal */}
      {isPhotoLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsPhotoLightboxOpen(false)}
        >
          <div 
            className="relative max-w-2xl w-full max-h-[92vh] flex flex-col items-center bg-slate-900 border border-amber-500/40 rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="w-full bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider truncate">
                  {member.rank} • {member.fullName}
                </span>
                {!(member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER || member.status === MemberStatus.FORMER_PUO) && (
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    (ID: {member.id})
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={member.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-amber-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
                  title="Open Original Image in New Tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setIsPhotoLightboxOpen(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Image Body */}
            <div className="w-full flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-950/60">
              <img
                src={member.photoUrl}
                alt={`Official Portrait - ${member.fullName}`}
                className="max-h-[68vh] w-auto max-w-full rounded-lg object-contain border-2 border-slate-800 shadow-2xl"
              />
            </div>

            {/* Modal Footer */}
            <div className="w-full bg-slate-950/90 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <span>{member.department}</span>
                <span>•</span>
                <span>Session {member.session}</span>
              </div>
              <span className="text-amber-400 font-bold uppercase tracking-wide">{member.status}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
