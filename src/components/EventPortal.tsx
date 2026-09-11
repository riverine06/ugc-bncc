/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import {
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Users,
  CheckCircle,
  AlertTriangle,
  Gift,
  Coffee,
  Truck,
  BookOpen,
  ArrowRight,
  PlusCircle,
  Award,
  X,
} from "lucide-react";
import { PlatoonEvent, EventType, User, UserRole } from "../types";
import { generateId, createDocument } from "../firebaseService";

interface EventPortalProps {
  events: PlatoonEvent[];
  user: User | null;
  onRefresh: () => void;
}

export default function EventPortal({ events, user, onRefresh }: EventPortalProps) {
  const [activeTab, setActiveTab] = React.useState<"active" | "iftar">("active");
  const [selectedEvent, setSelectedEvent] = React.useState<PlatoonEvent | null>(null);
  const [iftarYear, setIftarYear] = React.useState<string>("");

  // Registration Form State
  const [regForm, setRegForm] = React.useState({
    memberName: "",
    memberIdStr: "",
    phoneNumber: "",
    notes: "",
    guestCount: 0,
    dietaryRequirements: "None",
    transportationRequirements: "Self",
  });
  const [regSuccess, setRegSuccess] = React.useState<string | null>(null);
  const [regError, setRegError] = React.useState<string | null>(null);
  const [regLoading, setRegLoading] = React.useState(false);

  // Auto fill name if user logged in
  React.useEffect(() => {
    if (user && user.memberId) {
      setRegForm((prev) => ({
        ...prev,
        memberName: user.email.split("@")[0].toUpperCase(),
        memberIdStr: user.memberId || "",
      }));
    }
  }, [user]);

  // Support pressing Escape to close the active registration modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedEvent) {
        setSelectedEvent(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEvent]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    setRegLoading(true);
    setRegError(null);
    try {
      const regId = generateId("reg");
      const registrationData = {
        id: regId,
        eventId: selectedEvent.id,
        memberId: user ? user.id : null,
        memberName: regForm.memberName,
        memberIdStr: regForm.memberIdStr || "Guest",
        phoneNumber: regForm.phoneNumber,
        notes: regForm.notes,
        guestCount: Number(regForm.guestCount || 0),
        dietaryRequirements: regForm.dietaryRequirements,
        transportationRequirements: regForm.transportationRequirements,
        status: user && (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN)
          ? "Approved"
          : "Pending",
        registeredAt: new Date().toISOString(),
      };

      await createDocument("eventRegistrations", registrationData, regId);

      setRegSuccess("Your registration request was sent successfully! Pending Admin Clearance.");
      setRegLoading(false);
      setTimeout(() => {
        setSelectedEvent(null);
        setRegSuccess(null);
        setRegError(null);
        onRefresh();
      }, 3000);
    } catch (err: any) {
      setRegError(err.message || "Event registration failed.");
      setRegLoading(false);
    }
  };

  // Filter events of type Iftar Mahfil dynamically
  const iftarEvents = events.filter((e) => e.eventType === EventType.IFTAR_MAHFIL);

  // Filter regular events to exclude Iftar Mahfil when browsing standard events tab
  const currentEvents = events.filter((e) => e.eventType !== EventType.IFTAR_MAHFIL);
  const upcoming = currentEvents.filter((e) => new Date(e.date) >= new Date());
  const completed = currentEvents.filter((e) => new Date(e.date) < new Date());

  // Group Iftar events by year
  const iftarYears = Array.from(new Set(iftarEvents.map(e => {
    try {
      return new Date(e.date).getFullYear().toString();
    } catch {
      return "";
    }
  }).filter(Boolean))).sort((a, b) => b.localeCompare(a));

  // Auto-select first year if current selected year is empty
  React.useEffect(() => {
    if (iftarYears.length > 0 && (!iftarYear || !iftarYears.includes(iftarYear))) {
      setIftarYear(iftarYears[0]);
    }
  }, [events, iftarYear]);

  // Find the selected dynamic Iftar event
  const selectedIftarEvent = iftarEvents.find(e => {
    try {
      return new Date(e.date).getFullYear().toString() === iftarYear;
    } catch {
      return false;
    }
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">
      {/* 1. Header with custom tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-army-950 dark:text-amber-400 uppercase tracking-tight">
            EVENTS & DRILLS CENTER
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Browse upcoming tactical training, parade drills, blood donation drives, and Annual Iftar Mahfil ledgers.
          </p>
        </div>

        {/* Portal Category Tabs */}
        <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 flex self-start font-mono text-xs font-bold uppercase">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-md transition-all ${
              activeTab === "active" ? "bg-white dark:bg-amber-500 text-army-900 dark:text-slate-950 shadow-sm font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Platoon Drills & Events
          </button>
          <button
            onClick={() => setActiveTab("iftar")}
            className={`px-4 py-2 rounded-md transition-all ${
              activeTab === "iftar" ? "bg-white dark:bg-amber-500 text-army-900 dark:text-slate-950 shadow-sm font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            Annual Iftar Mahfil System
          </button>
        </div>
      </div>

      {/* 2. PLATOON EVENTS VIEW */}
      {activeTab === "active" && (
        <div className="space-y-12">
          {/* Upcoming Events Grid */}
          <div className="space-y-6">
            <h3 className="text-lg font-display font-bold text-army-900 dark:text-white uppercase border-b border-slate-200 dark:border-slate-800 pb-2">
              UPCOMING COMMAND SCHEDULING
            </h3>

            {upcoming.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                No upcoming events or drills scheduled at this time. Check back later!
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {upcoming.map((event) => (
                  <div
                    key={event.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <img
                      src={event.imageUrl}
                      alt={event.name}
                      className="h-44 w-full object-cover border-b border-slate-100 dark:border-slate-800"
                    />
                    <div className="p-5 flex-grow flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 font-bold px-2 py-0.5 rounded font-mono uppercase">
                            {event.eventType}
                          </span>
                          <span className="text-xs text-army-700 dark:text-amber-400 font-bold font-mono">
                            Fee: {event.registrationFee === 0 ? "FREE" : `${event.registrationFee} BDT`}
                          </span>
                        </div>
                        <h4 className="font-display font-bold text-slate-900 dark:text-white text-base leading-tight">
                          {event.name}
                        </h4>
                        <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed line-clamp-3">
                          {event.description}
                        </p>

                        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded text-xs text-slate-600 dark:text-slate-300 font-mono space-y-1 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>DATE: {event.date} at {event.time}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">VENUE: {event.venue}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            <span>DEADLINE: {event.registrationDeadline}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Limit: {event.maxParticipants} cadets max
                        </span>
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="bg-army-900 hover:bg-army-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white font-display font-bold text-xs uppercase px-4 py-2 rounded shadow-sm transition-colors"
                        >
                          REGISTER FOR EVENT
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Events Ledger */}
          <div className="space-y-6">
            <h3 className="text-base font-display font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-800 pb-2">
              COMPLETED EVENTS ARCHIVE
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {completed.map((event) => (
                <div key={event.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                      {event.eventType}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block mt-1.5">{event.date}</span>
                    <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm mt-1">{event.name}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed line-clamp-2 mt-1.5">
                      {event.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 font-mono flex justify-between">
                    <span>Venue: {event.venue.substring(0, 20)}...</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase">✓ Completed</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. ANNUAL IFTAR MAHFIL SYSTEM VIEW */}
      {activeTab === "iftar" && (
        <div className="space-y-8 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-800 dark:text-slate-100">
          {iftarYears.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <Coffee className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 uppercase text-sm">No Annual Iftar Archives</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                The demo static Iftar archives have been removed. Platoon Administrators can schedule and record real Iftar Mahfil events via the 
                <strong className="text-slate-700 dark:text-slate-300"> Operations Scheduler </strong> in the Admin Dashboard.
              </p>
            </div>
          ) : (
            <>
              {/* Iftar Year Picker */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5 gap-3">
                <div>
                  <h3 className="font-display font-extrabold text-army-950 dark:text-white text-lg uppercase">
                    ANNUAL IFTAR LEDGER VAULT
                  </h3>
                  <p className="text-slate-500 text-xs">Browse budgets, reports, organizers and rosters across past sessions.</p>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded font-mono text-xs font-bold border border-slate-200 dark:border-slate-850">
                  {iftarYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => setIftarYear(year)}
                      className={`px-3 py-1.5 rounded ${
                        iftarYear === year ? "bg-army-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              {selectedIftarEvent ? (
                /* Iftar archival reports dashboard */
                <div className="grid md:grid-cols-3 gap-8">
                  {/* Left Column: Meal counts & budgets panel */}
                  <div className="space-y-6">
                    <div className="bg-army-50 dark:bg-slate-950/60 p-5 rounded-lg border border-army-100 dark:border-slate-850 space-y-4">
                      <h4 className="font-display font-black text-xs text-army-900 dark:text-amber-500 tracking-wider uppercase border-b border-army-200 dark:border-slate-800 pb-2 flex items-center space-x-1">
                        <Coffee className="h-4 w-4" />
                        <span>Meal Count & Tracker</span>
                      </h4>
                      <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300 font-mono">
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                          <span>TARGET CAPACITY:</span>
                          <strong className="text-slate-900 dark:text-white">{selectedIftarEvent.maxParticipants}</strong>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                          <span>REGISTRATION FEE:</span>
                          <strong className="text-slate-900 dark:text-white">
                            {selectedIftarEvent.registrationFee === 0 ? "FREE" : `${selectedIftarEvent.registrationFee} BDT`}
                          </strong>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                          <span>ELIGIBILITY:</span>
                          <strong className="text-slate-900 dark:text-white text-right truncate max-w-[120px]" title={selectedIftarEvent.eligibilityRequirements}>
                            {selectedIftarEvent.eligibilityRequirements || "Open To All"}
                          </strong>
                        </div>
                        <div className="flex justify-between pb-1.5">
                          <span>DEADLINE:</span>
                          <strong className="text-amber-600 dark:text-amber-400">{selectedIftarEvent.registrationDeadline}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Roster list */}
                    <div className="bg-white dark:bg-slate-950 p-5 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                      <h4 className="font-display font-bold text-xs text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center space-x-1.5">
                        <Users className="h-4 w-4 text-slate-500" />
                        <span className="uppercase">PLATOON LOGISTICS</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="pb-2">
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">SUPERVISING BODY</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-sans">UGC Platoon Commanded Officers</strong>
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] text-slate-400 font-mono block uppercase">COORDINATION</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-sans">Student Executive Cadets</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Executive Report & Download panel */}
                  <div className="md:col-span-2 space-y-6">
                    <div className="space-y-3">
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 px-2.5 py-0.5 rounded font-mono font-bold uppercase">
                        Annual Iftar {iftarYear} Program
                      </span>
                      <h4 className="text-xl font-display font-extrabold text-slate-900 dark:text-white uppercase leading-tight">
                        {selectedIftarEvent.name}
                      </h4>
                      <p className="text-slate-500 text-xs font-mono">Date of Assemblage: {selectedIftarEvent.date} at {selectedIftarEvent.time} | Venue: {selectedIftarEvent.venue}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-lg border border-slate-200 dark:border-slate-800 relative">
                      <h5 className="font-mono text-[10px] font-bold text-slate-400 uppercase mb-3">
                        DESCRIPTION & EXECUTION PLAN
                      </h5>
                      <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-sans font-light whitespace-pre-line">
                        {selectedIftarEvent.description}
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 pt-4 flex-wrap gap-y-2">
                      <button
                        onClick={() => setSelectedEvent(selectedIftarEvent)}
                        className="bg-army-900 hover:bg-army-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono text-xs font-bold px-4 py-2.5 rounded transition-all shadow uppercase cursor-pointer"
                      >
                        Register / Join Iftar Mahfil
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-500 font-mono">Select a year from the tabs to view the scheduled Iftar Mahfil program.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 4. EVENT REGISTRATION OVERLAY DIALOG */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
          onClick={() => setSelectedEvent(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-xl border-4 border-army-900 dark:border-amber-500 shadow-2xl overflow-hidden max-w-lg w-full cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-army-900 text-white px-6 py-4 flex justify-between items-center border-b dark:border-army-800">
              <div className="min-w-0 flex-1 pr-4">
                <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest block">
                  // SECURE COMMAND PORTAL
                </span>
                <h4 className="font-display font-extrabold text-sm uppercase leading-tight truncate">
                  {selectedEvent.name}
                </h4>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white font-mono font-bold text-xs uppercase flex items-center space-x-1 border border-slate-700 hover:border-slate-500 px-2.5 py-1 rounded transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4 text-xs">
              {regError && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded-md flex items-start space-x-2 shadow-sm font-sans">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-mono text-[9px] text-red-600 dark:text-red-400 uppercase font-bold block tracking-wider">
                      REGISTRATION FAILURE
                    </span>
                    <p className="text-[11px]">{regError}</p>
                  </div>
                </div>
              )}

              {regSuccess ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-5 rounded-lg text-center space-y-2">
                  <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
                  <p className="font-display font-bold uppercase">REGISTRATION PROCESSED</p>
                  <p className="text-xs">{regSuccess}</p>
                </div>
              ) : (
                <>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 text-amber-900 dark:text-amber-300 p-3 rounded">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-tight font-sans">
                        Provide accurate identifiers. Current active cadets must match their registered UGC Member ID code to update timelines.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Registrant Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., SHEIKH SADI"
                        value={regForm.memberName}
                        onChange={(e) => setRegForm({ ...regForm, memberName: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-army-500 dark:focus:border-amber-500 uppercase font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Member ID (Or 'Guest')</label>
                      <input
                        type="text"
                        placeholder="e.g., UGC-2022-001"
                        value={regForm.memberIdStr}
                        onChange={(e) => setRegForm({ ...regForm, memberIdStr: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-army-500 dark:focus:border-amber-500 uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Contact Phone Number</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., +8801700000000"
                        value={regForm.phoneNumber}
                        onChange={(e) => setRegForm({ ...regForm, phoneNumber: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Additional Guests count</label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={regForm.guestCount}
                        onChange={(e) => setRegForm({ ...regForm, guestCount: Number(e.target.value) })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Dietary Preferences</label>
                      <select
                        value={regForm.dietaryRequirements}
                        onChange={(e) => setRegForm({ ...regForm, dietaryRequirements: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
                      >
                        <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="None">None (Standard Meal)</option>
                        <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="Vegetarian">Vegetarian</option>
                        <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="Diabetic">Diabetic Friendly</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Transportation Needs</label>
                      <select
                        value={regForm.transportationRequirements}
                        onChange={(e) => setRegForm({ ...regForm, transportationRequirements: e.target.value })}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
                      >
                        <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="Self">Self Management</option>
                        <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="Platoon Transport">Platoon Transport (Bus)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block">Assigned Organizer Role / Remarks</label>
                    <textarea
                      placeholder="e.g., Assisting with Iftar meal distribution logistics..."
                      value={regForm.notes}
                      onChange={(e) => setRegForm({ ...regForm, notes: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full h-16 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={regLoading}
                    className="w-full bg-army-900 hover:bg-army-850 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-army-950 text-white font-display font-bold py-3 rounded uppercase tracking-wider transition-colors mt-4 shadow"
                  >
                    {regLoading ? "PROCESSING COMMAND ENROLLMENT..." : "SUBMIT ENROLLMENT REQUEST"}
                  </button>
                </>
              )}
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
