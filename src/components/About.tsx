/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { History, Shield, Milestone, Flame, Edit, Plus, Trash, Check, X, Loader2 } from "lucide-react";
import { User, UserRole } from "../types";
import { getSingleDocument, setSingleDocument } from "../firebaseService";
import SEO from "./SEO";

interface AboutProps {
  currentUser: User | null;
}

interface MilestoneItem {
  year: string;
  title: string;
  details: string;
}

interface AboutData {
  history: string[];
  milestones: MilestoneItem[];
  objectives: string[];
  oath: string;
}

const DEFAULT_ABOUT: AboutData = {
  history: [
    "The Uttara Government College BNCC Platoon was officially established in 2018 to foster discipline, leadership, and voluntary community service among the college student body. Falling under the jurisdiction of the esteemed 3 Ramna Battalion, Ramna Regiment of the Bangladesh National Cadet Corps (BNCC), the platoon has built a pristine legacy of producing exemplary cadets.",
    "From its humble beginnings with 15 recruits, the platoon has consistently maintained high standards in weekly military drill parades, national camp participations, and civilian aid projects. Guided by our founding Platoon Commander, PUO Dr. Md. Aminul Islam, the platoon serves as a training ground for cadets preparing to serve the nation in defense forces and civil services.",
    "Our permanent database includes cadets who have received commissions in the Bangladesh Army, excelled in BCS Administrative Cadres, and established themselves in elite software and corporate organizations. Every cadet who joins the platoon receives a permanent digital profile that remains preserved in our official archive forever."
  ],
  milestones: [
    {
      year: "2018",
      title: "Platoon Establishment",
      details: "Uttara Government College BNCC Platoon was officially raised under Ramna Regiment (3 Ramna Battalion). PUO Dr. Md. Aminul Islam was appointed as Platoon Commander. Enlisted 15 founding cadet recruits."
    },
    {
      year: "2019",
      title: "First Central Camp & Promotion",
      details: "Cadets participated in the Central Camp in Savar training facility. First Cadet Under Officer (CUO) promotion was awarded to Riad Hasan Khan."
    },
    {
      year: "2020",
      title: "Covid-19 Volunteerism",
      details: "During the pandemic, cadets volunteered alongside local administrations for social-distancing maintenance, mask distributions, and food-relief logistics in the Uttara sector."
    },
    {
      year: "2022",
      title: "Expansion to 21 Active Cadets",
      details: "Post-pandemic force expansion. Established structured training pipelines in parade drill, basic firearms mapping, and medical disaster mitigation."
    },
    {
      year: "2024",
      title: "Victory Day Parade Command",
      details: "UGC BNCC Platoon represented Ramna Regiment at the National Victory Day display. CUO Sheikh Sadi awarded Best Regiment Commander."
    },
    {
      year: "2026",
      title: "Digital Service Portal Rollout",
      details: "The Platoon pioneered digital military service record systems for cadets, establishing a permanent searchable archive of alumni and cadets since 2018."
    }
  ],
  objectives: [
    "Develop high moral standards, civic responsibility, and self-discipline among college students.",
    "Train cadets in military drills, tactical navigation, physical endurance, and emergency rescue operations.",
    "Render immediate humanitarian logistics and volunteer support to the national administration during emergencies, floods, and natural disasters.",
    "Provide prerequisite coaching and drill guidance for candidates aspiring to apply for the ISSB and join the Armed Forces of Bangladesh."
  ],
  oath: "We shall uphold the honor of Uttara Government College and the Bangladesh National Cadet Corps. With discipline, patriotism, and selfless service, we stand ready to serve our nation whenever duty calls."
};

export default function About({ currentUser }: AboutProps) {
  const [data, setData] = React.useState<AboutData | null>(DEFAULT_ABOUT);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedTimelineYear, setSelectedTimelineYear] = React.useState<string>("All");

  // Form states
  const [historyText, setHistoryText] = React.useState<string>("");
  const [milestones, setMilestones] = React.useState<MilestoneItem[]>([]);
  const [objectives, setObjectives] = React.useState<string[]>([]);
  const [oath, setOath] = React.useState<string>("");

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  React.useEffect(() => {
    fetchAbout();
  }, []);

  const fetchAbout = async () => {
    setLoading(true);
    try {
      let resData = await getSingleDocument("settings", "about") as any;
      if (!resData) {
        // Fallback to default config and write it
        resData = {
          history: [
            "The Uttara Government College BNCC Platoon was officially established in 2018 to foster discipline, leadership, and voluntary community service among the college student body. Falling under the jurisdiction of the esteemed 3 Ramna Battalion, Ramna Regiment of the Bangladesh National Cadet Corps (BNCC), the platoon has built a pristine legacy of producing exemplary cadets.",
            "From its humble beginnings with 15 recruits, the platoon has consistently maintained high standards in weekly military drill parades, national camp participations, and civilian aid projects. Guided by our founding Platoon Commander, PUO Dr. Md. Aminul Islam, the platoon serves as a training ground for cadets preparing to serve the nation in defense forces and civil services.",
            "Our permanent database includes cadets who have received commissions in the Bangladesh Army, excelled in BCS Administrative Cadres, and established themselves in elite software and corporate organizations. Every cadet who joins the platoon receives a permanent digital profile that remains preserved in our official archive forever."
          ],
          milestones: [
            {
              year: "2018",
              title: "Platoon Establishment",
              details: "Uttara Government College BNCC Platoon was officially raised under Ramna Regiment (3 Ramna Battalion). PUO Dr. Md. Aminul Islam was appointed as Platoon Commander. Enlisted 15 founding cadet recruits."
            },
            {
              year: "2019",
              title: "First Central Camp & Promotion",
              details: "Cadets participated in the Central Camp in Savar training facility. First Cadet Under Officer (CUO) promotion was awarded to Riad Hasan Khan."
            },
            {
              year: "2020",
              title: "Covid-19 Volunteerism",
              details: "During the pandemic, cadets volunteered alongside local administrations for social-distancing maintenance, mask distributions, and food-relief logistics in the Uttara sector."
            },
            {
              year: "2022",
              title: "Expansion to 21 Active Cadets",
              details: "Post-pandemic force expansion. Established structured training pipelines in parade drill, basic firearms mapping, and medical disaster mitigation."
            },
            {
              year: "2024",
              title: "Victory Day Parade Command",
              details: "UGC BNCC Platoon represented Ramna Regiment at the National Victory Day display. CUO Sheikh Sadi awarded Best Regiment Commander."
            },
            {
              year: "2026",
              title: "Digital Service Portal Rollout",
              details: "The Platoon pioneered digital military service record systems for cadets, establishing a permanent searchable archive of alumni and cadets since 2018."
            }
          ],
          objectives: [
            "Develop high moral standards, civic responsibility, and self-discipline among college students.",
            "Train cadets in military drills, tactical navigation, physical endurance, and emergency rescue operations.",
            "Render immediate humanitarian logistics and volunteer support to the national administration during emergencies, floods, and natural disasters.",
            "Provide prerequisite coaching and drill guidance for candidates aspiring to apply for the ISSB and join the Armed Forces of Bangladesh."
          ],
          oath: "We shall uphold the honor of Uttara Government College and the Bangladesh National Cadet Corps. With discipline, patriotism, and selfless service, we stand ready to serve our nation whenever duty calls."
        };
        try {
          await setSingleDocument("settings", "about", resData);
        } catch (writeErr) {
          console.warn("Failed to auto-save default about document:", writeErr);
        }
      }
      setData(resData);
      setHistoryText(resData.history?.join("\n\n") || "");
      setMilestones(resData.milestones || []);
      setObjectives(resData.objectives || []);
      setOath(resData.oath || "");
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    if (!data) return;
    setHistoryText(data.history?.join("\n\n") || "");
    setMilestones([...(data.milestones || [])]);
    setObjectives([...(data.objectives || [])]);
    setOath(data.oath || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleAddMilestone = () => {
    setMilestones([...milestones, { year: new Date().getFullYear().toString(), title: "New Event", details: "" }]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (index: number, field: keyof MilestoneItem, value: string) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const handleAddObjective = () => {
    setObjectives([...objectives, "New Platoon Objective"]);
  };

  const handleRemoveObjective = (index: number) => {
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const handleObjectiveChange = (index: number, value: string) => {
    const updated = [...objectives];
    updated[index] = value;
    setObjectives(updated);
  };

  const handleSave = async () => {
    setSaving(true);

    const payload: AboutData = {
      history: historyText.split("\n\n").filter(p => p.trim() !== ""),
      milestones: milestones.filter(m => m.year && m.title),
      objectives: objectives.filter(o => o.trim() !== ""),
      oath: oath.trim()
    };

    try {
      await setSingleDocument("settings", "about", payload);
      setData(payload);
      setIsEditing(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-12 animate-pulse">
        {/* Main Card Skeleton */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex items-center space-x-3">
            <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800"></div>
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-4 w-4/5 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
        </div>

        {/* Timeline Section Skeleton */}
        <div className="space-y-6 pt-4">
          <div className="flex flex-col items-center space-y-2">
            <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800"></div>
            <div className="h-6 w-64 bg-slate-200 dark:bg-slate-800 rounded"></div>
            <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
          </div>
          <div className="flex justify-center gap-2 max-w-xl mx-auto">
            <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
            <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"></div>
            <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"></div>
            <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-md mx-auto py-12 text-center border border-red-200 bg-red-50 text-red-700 font-mono text-xs rounded p-6">
        CRITICAL ARCHIVE ERROR: {error}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
      <SEO
        title="About Platoon History & Milestones | UGC BNCC"
        description="Discover the history, objectives, cadet oath, and chronological milestones of Uttara Government College BNCC Platoon under 3 Ramna Battalion, established in 2018."
        canonicalPath="/about"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "About", url: "/about" }
        ]}
      />

      {/* Admin Quick Action Panel */}
      {isAdmin && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300/50 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 uppercase">
              Administrative Control Mode Active
            </span>
          </div>
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-army-950 font-mono text-xs font-bold px-4 py-1.5 rounded transition-all shadow-sm"
            >
              <Edit className="h-3 w-3" />
              <span>Edit About Page</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center space-x-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-mono text-xs font-bold px-3 py-1.5 rounded transition-all"
              >
                <X className="h-3 w-3" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center space-x-1 bg-army-800 hover:bg-army-950 text-white font-mono text-xs font-bold px-4 py-1.5 rounded transition-all shadow-md"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                <span>Save Legacy</span>
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 font-mono text-xs rounded p-4">
          ACTION FAILED: {error}
        </div>
      )}

      {!isEditing ? (
        // --- DISPLAY MODE ---
        <div className="space-y-16">
          {/* 1. History Panel */}
          <section className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all">
            <div className="absolute top-0 left-0 h-2 w-full bg-army-700"></div>
            <div className="flex items-center space-x-3 mb-6">
              <History className="h-6 w-6 text-army-800 dark:text-amber-500" />
              <h1 className="text-xl sm:text-2xl font-display font-extrabold text-army-950 dark:text-white uppercase tracking-tight">
                PLATOON HISTORY & LEGACY
              </h1>
            </div>

            <div className="prose dark:prose-invert text-slate-700 dark:text-slate-300 leading-relaxed space-y-4 max-w-none text-sm font-light">
              {data?.history?.map((para, idx) => (
                <p key={idx}>{para}</p>
              ))}
            </div>
          </section>

          {/* 2. Chronological Timeline */}
          <section className="space-y-8">
            <div className="text-center space-y-1">
              <Milestone className="h-6 w-6 text-army-800 dark:text-amber-500 mx-auto" />
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-army-950 dark:text-white uppercase">INTERACTIVE PLATOON CHRONOLOGY</h2>
              <p className="text-slate-500 text-xs">Explore major UGC BNCC Platoon milestones from our establishment to the current cycle</p>
            </div>

            {/* Year Selector Ribbon */}
            <div className="flex justify-start md:justify-center items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-xl mx-auto text-xs font-mono px-4 md:px-0">
              <button
                onClick={() => setSelectedTimelineYear("All")}
                className={`px-3 py-1.5 rounded-full border transition-all cursor-pointer font-bold shrink-0 whitespace-nowrap ${
                  selectedTimelineYear === "All"
                    ? "bg-amber-500 border-amber-500 text-army-950 shadow-md shadow-amber-500/10"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500/40"
                }`}
              >
                SHOW ALL ERA
              </button>
              {Array.from(new Set(data?.milestones?.map((m) => m.year) || [])).sort().map((yr) => (
                <button
                  key={yr}
                  onClick={() => setSelectedTimelineYear(yr)}
                  className={`px-4 py-1.5 rounded-full border transition-all cursor-pointer font-bold shrink-0 whitespace-nowrap ${
                    selectedTimelineYear === yr
                      ? "bg-army-900 dark:bg-amber-500 border-army-900 dark:border-amber-500 text-white dark:text-army-950 shadow-md"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-500/40"
                  }`}
                >
                  {yr === "2018" ? "ESTD 2018" : yr}
                </button>
              ))}
            </div>

            <div className="relative border-l-2 border-amber-500/30 dark:border-slate-800 ml-4 md:ml-32 space-y-8">
              {(data?.milestones || [])
                .filter((m) => selectedTimelineYear === "All" || m.year === selectedTimelineYear)
                .map((milestone, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.3 }}
                    className="relative pl-6 md:pl-8"
                  >
                    {/* Glowing timeline node */}
                    <div className="absolute -left-[9px] top-2 h-4 w-4 rounded-full bg-amber-500 border-2 border-white dark:border-slate-950 shadow-md flex items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-army-950 animate-ping"></span>
                    </div>

                    <div className="hidden md:block absolute -left-28 top-1 w-20 text-right text-base font-display font-black text-army-800 dark:text-amber-400 font-mono tracking-wider">
                      {milestone.year}
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 hover:border-amber-500/50 transition-all">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
                        <div>
                          <span className="md:hidden inline-block text-xs font-mono font-black text-amber-600 dark:text-amber-400 mb-0.5 uppercase tracking-widest">
                            {milestone.year === "2018" ? "★ ESTABLISHED 2018" : `Year ${milestone.year}`}
                          </span>
                          <h4 className="font-display font-extrabold text-slate-900 dark:text-white text-base uppercase">
                            {milestone.title}
                          </h4>
                        </div>
                        <span className="text-[9px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300/70 dark:border-amber-500/40 font-bold px-2 py-0.5 rounded uppercase">
                          Milestone Record
                        </span>
                      </div>

                      <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-sans font-light">
                        {milestone.details}
                      </p>


                    </div>
                  </motion.div>
                ))}
            </div>
          </section>

          {/* 3. Objectives & Oath */}
          <section className="grid md:grid-cols-2 gap-8 bg-army-900 dark:bg-slate-900 text-white p-8 rounded-xl border border-amber-500/30">
            <div>
              <div className="flex items-center space-x-2 mb-4 text-amber-400">
                <Flame className="h-5 w-5" />
                <h2 className="text-lg font-display font-bold uppercase tracking-wider">PRIMARY PLATOON OBJECTIVES</h2>
              </div>
              <ul className="space-y-3.5 text-xs text-army-100 dark:text-slate-300 leading-relaxed font-sans font-light list-disc list-inside">
                {data?.objectives?.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col justify-center items-center bg-army-950/50 p-6 rounded border border-army-750 text-center">
              <Shield className="h-12 w-12 text-amber-500 mb-3" />
              <h4 className="font-display font-bold text-amber-400 text-sm tracking-widest uppercase">// THE REGIMENT oath</h4>
              <blockquote className="mt-2 text-xs text-army-200 dark:text-slate-300 italic font-sans font-light leading-relaxed max-w-sm">
                "{data?.oath}"
              </blockquote>
            </div>
          </section>
        </div>
      ) : (
        // --- EDIT MODE ---
        <div className="space-y-8 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md">
          <h3 className="text-lg font-display font-extrabold text-army-950 dark:text-white uppercase tracking-wider border-b pb-2">
            Platoon Information Editor
          </h3>

          {/* History */}
          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold uppercase text-slate-500">
              Platoon History & Legacy (Separate paragraphs with double Enter)
            </label>
            <textarea
              value={historyText}
              onChange={(e) => setHistoryText(e.target.value)}
              rows={8}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3 text-xs font-light font-sans text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="Provide history paragraphs..."
            />
          </div>

          {/* Milestones */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t pt-4">
              <label className="block text-xs font-mono font-bold uppercase text-slate-500">
                Chronological Milestones
              </label>
              <button
                type="button"
                onClick={handleAddMilestone}
                className="inline-flex items-center space-x-1 bg-army-850 hover:bg-army-950 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded"
              >
                <Plus className="h-3 w-3" />
                <span>Add Year</span>
              </button>
            </div>

            <div className="space-y-3">
              {milestones.map((m, index) => (
                <div key={index} className="flex gap-3 items-start bg-slate-50 dark:bg-slate-950 p-3 rounded border border-slate-100 dark:border-slate-800 relative group">
                  <div className="w-20">
                    <input
                      type="text"
                      value={m.year}
                      onChange={(e) => handleMilestoneChange(index, "year", e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-mono text-center font-bold"
                      placeholder="Year"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => handleMilestoneChange(index, "title", e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-bold"
                      placeholder="Milestone Title"
                    />
                    <textarea
                      value={m.details}
                      onChange={(e) => handleMilestoneChange(index, "details", e.target.value)}
                      rows={2}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs font-light"
                      placeholder="Milestone Details..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveMilestone(index)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Objectives */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t pt-4">
              <label className="block text-xs font-mono font-bold uppercase text-slate-500">
                Primary Platoon Objectives
              </label>
              <button
                type="button"
                onClick={handleAddObjective}
                className="inline-flex items-center space-x-1 bg-army-850 hover:bg-army-950 text-white font-mono text-[10px] font-bold px-2.5 py-1 rounded"
              >
                <Plus className="h-3 w-3" />
                <span>Add Objective</span>
              </button>
            </div>

            <div className="space-y-2">
              {objectives.map((obj, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-xs font-mono text-slate-400">#{index + 1}</span>
                  <input
                    type="text"
                    value={obj}
                    onChange={(e) => handleObjectiveChange(index, e.target.value)}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs"
                    placeholder="Enter objective..."
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveObjective(index)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Oath */}
          <div className="space-y-2 border-t pt-4">
            <label className="block text-xs font-mono font-bold uppercase text-slate-500">
              The Platoon Regiment Oath
            </label>
            <textarea
              value={oath}
              onChange={(e) => setOath(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-3 text-xs italic font-sans"
              placeholder="Uphold the honor of the regiment..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
