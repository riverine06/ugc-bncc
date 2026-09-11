import React from "react";
import { motion } from "motion/react";
import { Trophy, Award, Search, Sparkles, Filter, Shield, Medal, Download, Users, Star, Plus, Check, Trash2 } from "lucide-react";
import { User, UserRole } from "../types";
import { subscribeToCollection, createDocument, generateId, softDeleteRecord } from "../firebaseService";

interface AchievementsProps {
  currentUser: User | null;
}

interface PlatoonAward {
  id: string;
  title: string;
  category: "Competition" | "Drill" | "Shooting" | "Community Service" | "Leadership" | "Camp Honor" | "Past Honor" | string;
  recipient: string;
  recipientId?: string;
  date: string;
  description: string;
  medalType?: string;
  issuedBy: string;
}

const DEFAULT_ACHIEVEMENTS: PlatoonAward[] = [
  {
    id: "ach-1",
    title: "Best Regiment Cadet Award 2025",
    category: "Leadership",
    recipient: "CUO Sheikh Sadi",
    recipientId: "UGC-2018-001",
    date: "2025-12-16",
    description: "Awarded top honor across Ramna Regiment for exceptional parade leadership, tactical skill, and command excellence.",
    medalType: "Gold",
    issuedBy: "3 Ramna Battalion Command"
  },
  {
    id: "ach-2",
    title: "Inter-Platoon Squad Shooting Championship",
    category: "Shooting",
    recipient: "Sgt. Riad Hasan Khan",
    recipientId: "UGC-2018-001",
    date: "2025-08-20",
    description: "Secured 1st position in 25-meter rifle firing precision during the Annual firing classification camp.",
    medalType: "Gold",
    issuedBy: "BNCC Headquarters"
  },
  {
    id: "ach-3",
    title: "Central Camp Drill Competition Champion",
    category: "Drill",
    recipient: "UGC Platoon Contingent",
    recipientId: "UGC-2018-001",
    date: "2025-02-14",
    description: "Awarded Best Squad Trophy in synchronized military march drill among 18 college platoons.",
    medalType: "Gold",
    issuedBy: "Ramna Regiment HQ"
  },
  {
    id: "ach-4",
    title: "National Emergency Rescue Commendation",
    category: "Community Service",
    recipient: "Cpl. Tanvir Ahmed & Team",
    recipientId: "UGC-2018-001",
    date: "2024-09-05",
    description: "Recognized for outstanding civilian flood relief logistics and medical rescue deployment in eastern districts.",
    medalType: "Honor",
    issuedBy: "Ministry of Disaster Management"
  }
];

export default function Achievements({ currentUser }: AchievementsProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All");

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  const [awards, setAwards] = React.useState<PlatoonAward[]>(DEFAULT_ACHIEVEMENTS);
  const [cadets, setCadets] = React.useState<any[]>([]);
  const [selectedCadetId, setSelectedCadetId] = React.useState<string>("");

  React.useEffect(() => {
    const unsub = subscribeToCollection<PlatoonAward>("achievements", (data) => {
      setAwards(data && data.length > 0 ? data : DEFAULT_ACHIEVEMENTS);
    });
    const unsubCadets = subscribeToCollection<any>("cadets", (data) => {
      setCadets(data || []);
    });
    return () => {
      unsub();
      unsubCadets();
    };
  }, []);

  // Form states for adding achievements
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newAward, setNewAward] = React.useState<Omit<PlatoonAward, "id">>({
    title: "",
    category: "Competition",
    recipient: "",
    date: new Date().toISOString().split("T")[0],
    description: "",
    issuedBy: "UGC Platoon Command",
  });

  const handleAddAward = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = generateId("ach");
      let finalRecipient = newAward.recipient;
      if (selectedCadetId) {
        const match = cadets.find((c) => c.id === selectedCadetId);
        if (match) {
          finalRecipient = `${match.rank} ${match.fullName}`;
        }
      }

      const achievementData = {
        id,
        ...newAward,
        recipient: finalRecipient,
        recipientId: selectedCadetId || "",
        cadetId: selectedCadetId || "",
        memberId: selectedCadetId || "",
      };
      await createDocument("achievements", achievementData, id);
      setShowAddForm(false);
      setSelectedCadetId("");
      setNewAward({
        title: "",
        category: "Competition",
        recipient: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
        issuedBy: "UGC Platoon Command",
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteAward = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this achievement record?")) return;
    try {
      const itemToDel = awards.find((a) => a.id === id);
      if (itemToDel) {
        await softDeleteRecord("achievements", id, itemToDel.title, itemToDel, currentUser?.email || "admin@ugcbncc.org", currentUser?.id || "admin");
        setAwards((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getRecipientName = (award: PlatoonAward) => {
    const mId = award.recipientId || (award as any).memberId || (award as any).cadetId;
    if (mId) {
      const match = cadets.find((c) => c.id === mId || (c.cadetId && c.cadetId === mId));
      if (match) {
        return `${match.rank || 'Cadet'} ${match.fullName}`.trim();
      }
    }
    if (award.recipient && award.recipient.trim() && award.recipient !== "★") {
      return award.recipient;
    }
    return "Cadet Personnel";
  };

  const getIssuerName = (award: PlatoonAward) => {
    if (award.issuedBy && award.issuedBy.trim()) {
      return award.issuedBy;
    }
    if ((award as any).campName && (award as any).campName.trim()) {
      return (award as any).campName;
    }
    if (award.category === "Camp Honor") {
      return "3 Ramna Battalion Command";
    }
    return "UGC Platoon Command";
  };

  const filteredAwards = awards.filter((award) => {
    const recipient = getRecipientName(award);
    const matchesSearch =
      award.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      award.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || award.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="relative overflow-hidden bg-army-950 border-2 border-amber-500 text-white p-8 rounded-xl shadow-2xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-army-900 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest">
              <Trophy className="h-3 w-3 animate-pulse" />
              <span>Platoon Achievements Register</span>
            </div>
            <h2 className="text-3xl font-display font-extrabold tracking-tight uppercase">
              MILITARY HONORS & <span className="text-amber-400">ACHIEVEMENTS</span>
            </h2>
            <p className="text-xs text-army-200 font-sans max-w-2xl font-light">
              This ledger serves as the official registry of achievements, decorations, badges, championship trophies, and letters of commendation earned by UGC Platoon and its cadets.
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-amber-500 hover:bg-amber-600 text-army-950 font-mono text-xs font-bold py-2.5 px-4 rounded shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center space-x-1 uppercase"
            >
              <Plus className="h-4 w-4" />
              <span>Log Achievement</span>
            </button>
          )}
        </div>
      </div>

      {/* Add Award Modal / Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-lg space-y-4"
        >
          <div className="border-b pb-3 flex justify-between items-center">
            <h3 className="font-display font-bold text-slate-900 dark:text-white uppercase flex items-center space-x-2">
              <Award className="h-5 w-5 text-amber-500" />
              <span>Add New Achievement Record</span>
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs uppercase font-mono"
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleAddAward} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase block">Achievement Title</label>
              <input
                type="text"
                required
                value={newAward.title}
                onChange={(e) => setNewAward({ ...newAward, title: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 w-full text-slate-900 dark:text-slate-100"
                placeholder="e.g., Best Shooter Award"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase block">Recipient Cadet (Linked)</label>
              <select
                value={selectedCadetId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCadetId(val);
                  const match = cadets.find((c) => c.id === val);
                  if (match) {
                    setNewAward({ ...newAward, recipient: `${match.rank} ${match.fullName}` });
                  } else {
                    setNewAward({ ...newAward, recipient: "" });
                  }
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="">-- Manual entry / External --</option>
                {cadets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.rank} {c.fullName} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase block">Recipient Cadet Name</label>
              <input
                type="text"
                required
                value={newAward.recipient}
                onChange={(e) => setNewAward({ ...newAward, recipient: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 w-full text-slate-900 dark:text-slate-100"
                placeholder="e.g., Sergeant Alamin Hossain"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase block">Category</label>
              <select
                value={newAward.category}
                onChange={(e) => setNewAward({ ...newAward, category: e.target.value as any })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="Competition">Competition</option>
                <option value="Drill">Drill</option>
                <option value="Shooting">Shooting</option>
                <option value="Community Service">Community Service</option>
                <option value="Leadership">Leadership</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase block">Issued By</label>
              <input
                type="text"
                value={newAward.issuedBy}
                onChange={(e) => setNewAward({ ...newAward, issuedBy: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 w-full text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-slate-500 uppercase block">Date Awarded</label>
              <input
                type="date"
                value={newAward.date}
                onChange={(e) => setNewAward({ ...newAward, date: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 w-full text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-3 space-y-1">
              <label className="font-mono text-slate-500 uppercase block">Award Description</label>
              <textarea
                required
                rows={3}
                value={newAward.description}
                onChange={(e) => setNewAward({ ...newAward, description: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 w-full text-slate-900 dark:text-slate-100"
                placeholder="Detail regarding the achievement..."
              />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-3 pt-2 text-right">
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-mono uppercase font-bold py-2 px-6 rounded transition-all shadow"
              >
                Insert Achievement Entry
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Filters & Search */}
      <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between text-xs">
        <div className="flex flex-wrap gap-2">
          {["All", "Competition", "Drill", "Shooting", "Community Service", "Leadership"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full font-display font-medium tracking-wide border transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-army-900 text-white border-army-900 dark:bg-amber-500 dark:text-army-950 dark:border-amber-500"
                  : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-army-500"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search achievements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500"
          />
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Grid Layout of Achievements */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAwards.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-mono">
            No achievements match this query.
          </div>
        ) : (
          filteredAwards.map((award, index) => (
            <motion.div
              key={award.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm relative group hover:border-amber-500/50"
            >
              {/* Badge Visual Header */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-850 flex items-center justify-between">
                <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300/70 dark:border-amber-500/40 font-bold px-2 py-0.5 rounded uppercase">
                  {award.category}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-slate-400 font-mono">{award.date}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteAward(award.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Delete achievement"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Award Content */}
              <div className="p-5 flex-1 space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-slate-900 dark:text-white text-sm line-clamp-2 group-hover:text-army-800 dark:group-hover:text-amber-400">
                      {award.title}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">ISSUED BY: {getIssuerName(award)}</p>
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-400 text-xs font-sans leading-relaxed line-clamp-3 font-light">
                  {award.description}
                </p>

                {/* Recipient Ribbon Card */}
                <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded border border-slate-100 dark:border-slate-800">
                  <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                    DECORATED CADET
                  </div>
                  <div className="text-xs font-display font-bold text-slate-800 dark:text-slate-200 uppercase truncate mt-0.5">
                    ★ {getRecipientName(award)}
                  </div>
                </div>
              </div>

              {/* Footer info */}
              <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 uppercase">OFFICIAL REGISTRY RECORD</span>
                <span className="text-[10px] font-mono text-amber-500 font-bold uppercase">VERIFIED</span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Ribbon Banner Checklist */}
      <section className="bg-army-900 dark:bg-slate-900 text-white p-6 rounded-xl border border-amber-500/30 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <Shield className="h-8 w-8 text-amber-500" />
          <h4 className="font-display font-extrabold text-sm uppercase">RAMNA REGIMENT STANDARDS</h4>
          <p className="text-[11px] text-army-200 leading-relaxed font-light">
            Our platoon trains strictly according to standard military guidelines under the prestigious Ramna Regiment, which grants exclusive recognition for firing, physical fitness, and leadership.
          </p>
        </div>
        <div className="col-span-2 space-y-3 text-xs">
          <h4 className="font-display font-bold text-amber-400 uppercase tracking-wider">
            RECOGNITIONS AVAILABLE FOR CADETS
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 bg-army-950/50 p-2 rounded border border-army-800">
              <div className="h-2 w-2 rounded-full bg-amber-500"></div>
              <span><strong>National Drill Award:</strong> Top squads representing regiment.</span>
            </div>
            <div className="flex items-center space-x-2 bg-army-950/50 p-2 rounded border border-army-800">
              <div className="h-2 w-2 rounded-full bg-red-500"></div>
              <span><strong>Firing Marksmanship:</strong> Scoring {">"}40 on tactical target.</span>
            </div>
            <div className="flex items-center space-x-2 bg-army-950/50 p-2 rounded border border-army-800">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span><strong>Disaster Command:</strong> Floods & crisis relief action.</span>
            </div>
            <div className="flex items-center space-x-2 bg-army-950/50 p-2 rounded border border-army-800">
              <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
              <span><strong>Regiment Adjutant Honor:</strong> Absolute peer-discipline badge.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
