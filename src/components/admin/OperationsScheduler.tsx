import React from "react";
import { Plus, Edit, Trash2, Calendar, ClipboardList, CheckCircle, Clock, Loader2 } from "lucide-react";
import { Member, PlatoonEvent, EventType, AttendanceStatus } from "../../types";
import { subscribeToCollection, createDocument } from "../../firebaseService";
import { useAdminFeedback } from "./AdminUIFeedback";
import { InstitutionalEmptyState } from "./AdminStateFeedback";

interface OperationsSchedulerProps {
  events: PlatoonEvent[];
  members: Member[];
  onRefresh: () => void;
  onDeleteEvent: (id: string, name: string) => void;
  onStartEdit: (evt: PlatoonEvent) => void;
  form: any;
  setForm: (form: any) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function OperationsScheduler({
  events,
  members,
  onRefresh,
  onDeleteEvent,
  onStartEdit,
  form,
  setForm,
  editingId,
  setEditingId,
  onSubmit,
}: OperationsSchedulerProps) {
  const { showToast, isBusy } = useAdminFeedback();
  const [activeAttendanceEvent, setActiveAttendanceEvent] = React.useState<PlatoonEvent | null>(null);
  const [attendanceList, setAttendanceList] = React.useState<any[]>([]);
  const [savingAttendance, setSavingAttendance] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!activeAttendanceEvent) {
      setAttendanceList([]);
      return;
    }

    const unsub = subscribeToCollection<any>("eventAttendance", (data) => {
      const filtered = data.filter((item) => item.eventId === activeAttendanceEvent.id);
      setAttendanceList(filtered);
    });

    return () => unsub();
  }, [activeAttendanceEvent]);

  const handleMarkAttendance = async (memberId: string, status: AttendanceStatus) => {
    if (!activeAttendanceEvent || savingAttendance || isBusy) return;
    setSavingAttendance(memberId);
    try {
      const id = `att_${activeAttendanceEvent.id}_${memberId}`;
      await createDocument("eventAttendance", {
        id,
        eventId: activeAttendanceEvent.id,
        memberId,
        status,
        markedAt: new Date().toISOString(),
      }, id);
      showToast(`Roster attendance recorded as ${status}.`, "success", "ROSTER UPDATED");
    } catch (err: any) {
      showToast(err.message || "Failed to record attendance.", "error", "ROSTER FAILED");
    } finally {
      setSavingAttendance(null);
    }
  };

  const getAttendanceStatus = (memberId: string) => {
    const record = attendanceList.find((a) => a.memberId === memberId);
    return record ? record.status : "Unmarked";
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
          TACTICAL OPERATIONS & ROSTERS
        </h3>
        <p className="text-slate-400 text-[10px] mt-0.5">
          Schedule weekend drill parades, disaster rescue camps, or coordinate attendance rosters with high audit integrity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Events lists and attendance toggles */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active events card list */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <h4 className="font-display font-bold text-slate-900 dark:text-white text-xs uppercase border-b border-slate-100 dark:border-slate-800 pb-2">
              SCHEDULED PLATOON EVENTS
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-slate-50 dark:bg-slate-850 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="inline-block bg-amber-500/10 text-amber-500 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">
                      {evt.eventType}
                    </span>
                    <h5 className="font-display font-bold text-slate-900 dark:text-white text-xs leading-tight">
                      {evt.name}
                    </h5>
                    <p className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{evt.date} | {evt.time}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-3 text-[10px]">
                    <button
                      onClick={() => onStartEdit(evt)}
                      className="bg-white dark:bg-slate-800 hover:bg-slate-100 p-1.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded flex-1 min-w-[65px] flex items-center justify-center space-x-1 cursor-pointer font-bold"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>EDIT</span>
                    </button>

                    <button
                      onClick={() => setActiveAttendanceEvent(evt)}
                      className="bg-amber-500 hover:bg-amber-600 p-1.5 text-slate-950 font-bold rounded flex-1 min-w-[75px] flex items-center justify-center space-x-1 cursor-pointer font-mono text-[9px] tracking-wide"
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span>ROSTER</span>
                    </button>

                    <button
                      onClick={() => onDeleteEvent(evt.id, evt.name)}
                      className="text-slate-400 hover:text-red-500 p-1.5 border border-slate-200 dark:border-slate-700 rounded cursor-pointer shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {events.length === 0 && (
                <div className="col-span-full">
                  <InstitutionalEmptyState
                    title="NO OPERATIONS SCHEDULED"
                    message="There are currently no military exercises, parades, or training operations in the schedule."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Attendance roster sheet */}
          {activeAttendanceEvent && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <div>
                  <h4 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase">
                    LOG ATTENDANCE: {activeAttendanceEvent.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Operations Date: {activeAttendanceEvent.date}
                  </p>
                </div>
                <button
                  onClick={() => setActiveAttendanceEvent(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Close
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto pr-1">
                {members.filter(m => m.status === "Active Cadet").map((m) => (
                  <div key={m.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate">{m.fullName}</div>
                      <div className="text-[9px] text-slate-400 font-mono">ID: {m.id} | {m.rank}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono font-bold">
                      <button
                        onClick={() => handleMarkAttendance(m.id, AttendanceStatus.PRESENT)}
                        className={`px-2 py-1 rounded cursor-pointer border ${
                          getAttendanceStatus(m.id) === "Present"
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-400"
                        }`}
                      >
                        PRESENT
                      </button>
                      <button
                        onClick={() => handleMarkAttendance(m.id, AttendanceStatus.ABSENT)}
                        className={`px-2 py-1 rounded cursor-pointer border ${
                          getAttendanceStatus(m.id) === "Absent"
                            ? "bg-red-500 border-red-500 text-white"
                            : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-400"
                        }`}
                      >
                        ABSENT
                      </button>
                      <button
                        onClick={() => handleMarkAttendance(m.id, AttendanceStatus.EXCUSED)}
                        className={`px-2 py-1 rounded cursor-pointer border ${
                          getAttendanceStatus(m.id) === "Excused"
                            ? "bg-amber-500 border-amber-500 text-slate-950"
                            : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-400"
                        }`}
                      >
                        EXCUSED
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Schedule/Edit Form */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 h-fit">
          <h4 className="font-display font-black text-slate-900 dark:text-white text-xs border-b border-slate-100 dark:border-slate-800 pb-2 uppercase tracking-wider">
            {editingId ? "EDIT OPERATION DETAILS" : "SCHEDULE NEW OPERATION"}
          </h4>
          <form onSubmit={onSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase text-[9px]">Event Name</label>
              <input
                type="text"
                required
                placeholder="e.g., Weekly Parade Drill #10"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase text-[9px]">Event Type</label>
              <select
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="Parade">Weekly Parade Drill</option>
                <option value="Training">Tactical Training</option>
                <option value="Camp">Regiment Camp</option>
                <option value="Blood Donation">Blood Donation Campaign</option>
                <option value="Iftar Mahfil">Iftar Mahfil & Reunion</option>
                <option value="Community Service">Civil assistance</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Date</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Time</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., 07:00 AM"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase text-[9px]">Venue Location</label>
              <input
                type="text"
                required
                placeholder="e.g., College Parade Grounds"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Reg. Deadline</label>
                <input
                  type="date"
                  required
                  value={form.registrationDeadline}
                  onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Max Cadets</label>
                <input
                  type="number"
                  required
                  value={form.maxParticipants}
                  onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase text-[9px]">Operational Briefing</label>
              <textarea
                required
                placeholder="Explain instructions, guidelines, or uniform checklist..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-16 resize-none"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-black uppercase py-2 rounded text-[10px] tracking-wider transition-all cursor-pointer"
              >
                {editingId ? "SAVE UPDATES" : "SCHEDULE"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
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
                  }}
                  className="px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-700 rounded text-[10px] uppercase font-mono"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
