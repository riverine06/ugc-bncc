/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Shield, Award, Users, Star, BookOpen, Crown, Edit, Check, X, Plus, Trash, Loader2, Search, ArrowUpDown, RefreshCw } from "lucide-react";
import { User, UserRole, Member, LeadershipReference, FormerPUO } from "../types";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument, generateId } from "../firebaseService";

const DEFAULT_FORMER_PUOS: FormerPUO[] = [
  {
    id: "fpuo-1",
    name: "PUO Dr. Md. Aminul Islam",
    photo: "",
    session: "2018–2022",
    department: "Department of Bangla",
    servicePeriod: "2018 – 2022",
    startYear: 2018,
    endYear: 2022,
  },
  {
    id: "fpuo-2",
    name: "PUO Md. Monir Hossain",
    photo: "",
    session: "2014–2018",
    department: "Department of English",
    servicePeriod: "2014 – 2018",
    startYear: 2014,
    endYear: 2018,
  },
];

interface LeadershipProps {
  currentUser: User | null;
}

interface PrimaryLeader {
  id: string;
  memberId: string;
  title: string;
  name: string;
  rank: string;
  department: string;
  bio: string;
  photo: string;
  ribbons: string[];
  roleType: string;
  displayOrder: number;
}

interface SecondaryLeader {
  id: string;
  memberId: string;
  rank: string;
  name: string;
  role: string;
  photo: string;
  displayOrder: number;
}

interface EnrichedLeadershipReference extends LeadershipReference {
  name: string;
  rank: string;
  department: string;
  bio: string;
  photo: string;
}

interface LeadershipData {
  primaryRoles: PrimaryLeader[];
  secondaryLeaders: SecondaryLeader[];
  references: EnrichedLeadershipReference[];
}

const DEFAULT_LEADERSHIP: LeadershipData = {
  primaryRoles: [
    {
      id: "primary-1",
      memberId: "m1",
      title: "Platoon Commander",
      name: "PUO Dr. Md. Aminul Islam",
      rank: "PUO",
      department: "Department of Bangla",
      bio: "Founding Platoon Commander leading Uttara Government College BNCC Platoon since 2018 under Ramna Regiment.",
      photo: "",
      ribbons: ["Long Service Medal", "Command Service"],
      roleType: "platoon_commander",
      displayOrder: 1
    },
    {
      id: "primary-2",
      memberId: "m2",
      title: "Cadet Under Officer (CUO)",
      name: "CUO Sheikh Sadi",
      rank: "CUO",
      department: "HSC Science (2024-2025)",
      bio: "Senior cadet leader managing parade drill operations, tactical camps, and platoon discipline.",
      photo: "",
      ribbons: ["Best Cadet 2024", "National Parade"],
      roleType: "platoon_in_charge",
      displayOrder: 2
    }
  ],
  secondaryLeaders: [
    {
      id: "sec-1",
      memberId: "m3",
      rank: "Sergeant",
      name: "Sgt. Riad Hasan Khan",
      role: "Platoon Sergeant",
      photo: "",
      displayOrder: 1
    },
    {
      id: "sec-2",
      memberId: "m4",
      rank: "Corporal",
      name: "Cpl. Tanvir Ahmed",
      role: "Section 1 Leader",
      photo: "",
      displayOrder: 2
    }
  ],
  references: []
};

export default function Leadership({ currentUser }: LeadershipProps) {
  const [data, setData] = React.useState<LeadershipData | null>(DEFAULT_LEADERSHIP);
  const [formerPUOs, setFormerPUOs] = React.useState<FormerPUO[]>(DEFAULT_FORMER_PUOS);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Cadets database list for select dropdown
  const [cadets, setCadets] = React.useState<Member[]>([]);
  const [cadetSearch, setCadetSearch] = React.useState<string>("");
  const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // New position form state
  const [newMemberId, setNewMemberId] = React.useState<string>("");
  const [newPosition, setNewPosition] = React.useState<string>("");
  const [newDisplayOrder, setNewDisplayOrder] = React.useState<number>(10);
  const [newRoleType, setNewRoleType] = React.useState<string>("platoon_commander");

  // Former PUO form & edit state
  const [editingFormerPUOId, setEditingFormerPUOId] = React.useState<string | null>(null);
  const [fPuoName, setFPuoName] = React.useState<string>("");
  const [fPuoPhoto, setFPuoPhoto] = React.useState<string>("");
  const [fPuoSession, setFPuoSession] = React.useState<string>("");
  const [fPuoDept, setFPuoDept] = React.useState<string>("");
  const [fPuoServicePeriod, setFPuoServicePeriod] = React.useState<string>("");

  // Confirmation Modal state
  const [confirmDialog, setConfirmDialog] = React.useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  const rankReference = [
    {
      name: "PUO",
      desc: "Platoon Under Officer. Commissioned faculty member commanding the platoon unit.",
      badge: "border-amber-500 bg-amber-500/10 text-amber-500",
    },
    {
      name: "CUO",
      desc: "Cadet Under Officer. Highest rank achievable by a student cadet, assisting the PUO in command.",
      badge: "border-red-500 bg-red-500/10 text-red-500",
    },
    {
      name: "Sergeant",
      desc: "Senior non-commissioned officer commanding drills, squad discipline, and parade protocols.",
      badge: "border-blue-500 bg-blue-500/10 text-blue-500",
    },
    {
      name: "Corporal",
      desc: "Section leader commanding individual cadet squads during camps and civil deployments.",
      badge: "border-emerald-500 bg-emerald-500/10 text-emerald-500",
    },
  ];

  React.useEffect(() => {
    setLoading(true);
    let rawCadets: Member[] = [];
    let rawLeadership: LeadershipReference[] = [];

    const processData = () => {
      setCadets(rawCadets.filter((c) => c.verified));

      const enrichedRefs = rawLeadership.map((ref) => {
        const member = rawCadets.find((m) => m.id === ref.memberId);
        let roleType = ref.roleType as any;
        if (roleType === "faculty") roleType = "platoon_commander";
        if (roleType === "cadet") roleType = "platoon_in_charge";
        if (roleType === "secondary") roleType = "section_leader";
        return {
          id: ref.id,
          memberId: ref.memberId,
          position: ref.position,
          displayOrder: ref.displayOrder,
          status: ref.status,
          appointmentDate: ref.appointmentDate,
          endDate: ref.endDate,
          roleType: roleType,
          name: member?.fullName || "Unlisted Cadet",
          rank: member?.rank || "Cadet",
          department: member?.department || "General",
          bio: member?.biography || "",
          photo: member?.photoUrl || "",
        };
      });

      const primaryRoles = enrichedRefs
        .filter((r) => r.roleType === "platoon_commander" || r.roleType === "platoon_in_charge")
        .map((r) => ({
          id: r.id,
          memberId: r.memberId,
          title: r.position,
          name: r.name,
          rank: r.rank,
          department: r.department,
          bio: r.bio,
          photo: r.photo,
          ribbons: [],
          roleType: r.roleType,
          displayOrder: r.displayOrder,
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);

      const secondaryLeaders = enrichedRefs
        .filter((r) => r.roleType === "section_leader" || r.roleType === "section_2ic")
        .map((r) => ({
          id: r.id,
          memberId: r.memberId,
          rank: r.rank,
          name: r.name,
          role: r.position,
          photo: r.photo,
          displayOrder: r.displayOrder,
          roleType: r.roleType,
        }))
        .sort((a, b) => a.displayOrder - b.displayOrder);

      setData({
        primaryRoles,
        secondaryLeaders,
        references: enrichedRefs,
      });
      setLoading(false);
    };

    const unsubCadets = subscribeToCollection<Member>("cadets", (cadetsList) => {
      rawCadets = cadetsList;
      processData();
    });

    const unsubLeadership = subscribeToCollection<LeadershipReference>("leadership", (leadershipList) => {
      rawLeadership = leadershipList;
      processData();
    });

    const unsubFormerPUOs = subscribeToCollection<FormerPUO>("former_puos", async (puoList) => {
      if (puoList && puoList.length > 0) {
        setFormerPUOs(puoList);
      } else {
        const seeded = localStorage.getItem("ugc_former_puos_initialized");
        if (!seeded) {
          localStorage.setItem("ugc_former_puos_initialized", "true");
          // Seed defaults to Firestore so they are real persistent records with valid IDs
          for (const item of DEFAULT_FORMER_PUOS) {
            try {
              await createDocument("former_puos", item, item.id);
            } catch (err) {
              console.warn("Seeding initial former PUO:", err);
            }
          }
          setFormerPUOs(DEFAULT_FORMER_PUOS);
        } else {
          // Genuinely empty because user deleted all records
          setFormerPUOs([]);
        }
      }
    });

    return () => {
      unsubCadets();
      unsubLeadership();
      unsubFormerPUOs();
    };
  }, []);

  const handleSaveFormerPUO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fPuoName || !fPuoServicePeriod) {
      setError("Please enter the Former PUO Name and Service Period.");
      return;
    }
    setSaving(true);
    try {
      const years = fPuoServicePeriod.match(/\d{4}/g) || [];
      const startYr = years[0] ? parseInt(years[0], 10) : undefined;
      const endYr = years[1] ? parseInt(years[1], 10) : startYr;

      const record: FormerPUO = {
        id: editingFormerPUOId || generateId("fpuo"),
        name: fPuoName,
        photo: fPuoPhoto || "",
        session: fPuoSession || (startYr && endYr ? `${startYr}–${endYr}` : "2018–2022"),
        department: fPuoDept || "Department of Bangla",
        servicePeriod: fPuoServicePeriod,
        startYear: startYr,
        endYear: endYr,
      };

      if (editingFormerPUOId) {
        await updateDocument("former_puos", editingFormerPUOId, record);
        setFormerPUOs((prev) => prev.map((p) => (p.id === editingFormerPUOId ? record : p)));
      } else {
        await createDocument("former_puos", record, record.id);
        setFormerPUOs((prev) => [...prev.filter((p) => p.id !== record.id), record]);
      }

      localStorage.setItem("ugc_former_puos_initialized", "true");
      setEditingFormerPUOId(null);
      setFPuoName("");
      setFPuoPhoto("");
      setFPuoSession("");
      setFPuoDept("");
      setFPuoServicePeriod("");
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditFormerPUO = (p: FormerPUO) => {
    setEditingFormerPUOId(p.id);
    setFPuoName(p.name);
    setFPuoPhoto(p.photo || "");
    setFPuoSession(p.session || "");
    setFPuoDept(p.department || "");
    setFPuoServicePeriod(p.servicePeriod || "");
    const formEl = document.getElementById("former-puo-cms-form");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleCancelEditFormerPUO = () => {
    setEditingFormerPUOId(null);
    setFPuoName("");
    setFPuoPhoto("");
    setFPuoSession("");
    setFPuoDept("");
    setFPuoServicePeriod("");
  };

  const handleDeleteFormerPUO = (id: string, name?: string) => {
    setConfirmDialog({
      title: "Delete Former PUO Record",
      message: `Are you sure you want to permanently delete former officer record "${name || "Former PUO"}"? This cannot be undone.`,
      onConfirm: async () => {
        setSaving(true);
        try {
          localStorage.setItem("ugc_former_puos_initialized", "true");
          setFormerPUOs((prev) => prev.filter((p) => p.id !== id));
          await deleteDocument("former_puos", id);
          if (editingFormerPUOId === id) {
            handleCancelEditFormerPUO();
          }
          setError(null);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setSaving(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // Sort Former PUOs chronologically (newest to oldest)
  const sortedFormerPUOs = [...formerPUOs].sort((a, b) => {
    const getEndYear = (p: FormerPUO) => {
      if (p.endYear) return p.endYear;
      const years = p.servicePeriod.match(/\d{4}/g);
      if (years && years.length > 0) {
        return parseInt(years[years.length - 1], 10);
      }
      return 0;
    };
    const getStartYear = (p: FormerPUO) => {
      if (p.startYear) return p.startYear;
      const years = p.servicePeriod.match(/\d{4}/g);
      if (years && years.length > 0) {
        return parseInt(years[0], 10);
      }
      return 0;
    };

    const endDiff = getEndYear(b) - getEndYear(a);
    if (endDiff !== 0) return endDiff;
    return getStartYear(b) - getStartYear(a);
  });

  const handleCreateReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberId || !newPosition) {
      setError("Please select a cadet/officer and enter a command title.");
      return;
    }
    setSaving(true);
    try {
      const id = generateId("lead");
      const refData = {
        id,
        memberId: newMemberId,
        cadetId: newMemberId,
        position: newPosition,
        displayOrder: Number(newDisplayOrder || 10),
        roleType: newRoleType,
        status: "Active",
        appointmentDate: new Date().toISOString().split("T")[0],
      };
      await createDocument("leadership", refData, id);

      // Sync Platoon Commander to Homepage document if applicable
      if (newRoleType === "platoon_commander" || newPosition.toLowerCase().includes("commander")) {
        const member = cadets.find((m) => m.id === newMemberId);
        if (member) {
          try {
            await updateDocument("homepage", "main", {
              commanderName: member.fullName,
              commanderRank: newPosition || member.rank || "Platoon Commander",
              commanderPhoto: member.photoUrl || "",
              ...(member.biography ? { commanderMessage: member.biography } : {})
            });
          } catch (err) {
            console.warn("Homepage document sync notice:", err);
          }
        }
      }

      setNewMemberId("");
      setNewPosition("");
      setNewDisplayOrder(10);
      setNewRoleType("platoon_commander");
      setCadetSearch("");
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReference = async (id: string, updates: Partial<LeadershipReference>) => {
    try {
      await updateDocument("leadership", id, updates);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteReference = (id: string, posName?: string) => {
    setConfirmDialog({
      title: "Revoke Command Assignment",
      message: `Are you sure you want to revoke this command assignment${posName ? ` ("${posName}")` : ""}?`,
      onConfirm: async () => {
        setSaving(true);
        try {
          await deleteDocument("leadership", id);
          setError(null);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setSaving(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  const filteredCadets = cadets.filter((c) =>
    c.fullName.toLowerCase().includes(cadetSearch.toLowerCase()) ||
    c.rank.toLowerCase().includes(cadetSearch.toLowerCase()) ||
    c.id.toLowerCase().includes(cadetSearch.toLowerCase())
  );

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 text-army-800 animate-spin" />
        <span className="text-xs font-mono text-slate-500 uppercase">Synchronizing Command Structure...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12" id="leadership-module">
      {/* Admin Action Panel */}
      {isAdmin && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300/50 p-4 rounded-xl flex items-center justify-between shadow-sm" id="admin-leadership-panel">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 uppercase">
              Command Assignments CMS Mode
            </span>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-army-950 font-mono text-xs font-bold px-4 py-1.5 rounded transition-all shadow-sm"
            id="toggle-leadership-edit"
          >
            {isEditing ? <X className="h-3.5 w-3.5" /> : <Edit className="h-3.5 w-3.5" />}
            <span>{isEditing ? "Exit CMS Admin Panel" : "Manage Command Assignments"}</span>
          </button>
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 font-mono text-xs rounded p-4" id="leadership-error">
          ACTION FAILED: {error}
        </div>
      )}

      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto">
        <Crown className="h-7 w-7 text-amber-500 mx-auto mb-2 animate-pulse" />
        <h2 className="text-3xl font-display font-extrabold text-army-950 dark:text-white uppercase tracking-tight">
          PLATOON COMMAND STRUCTURE
        </h2>
        <p className="text-slate-500 text-xs mt-1">
          Dynamic organogram resolving command assignments directly to cadet profile dossiers.
        </p>
      </div>

      {isEditing ? (
        // --- CMS ADMIN PANEL ---
        <div className="space-y-8" id="leadership-cms-workspace">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-sm font-mono font-black uppercase text-slate-800 dark:text-white tracking-wider border-b pb-2 flex items-center space-x-2">
              <Plus className="h-4 w-4 text-amber-500" />
              <span>Assign New Command Position</span>
            </h3>

            <form onSubmit={handleCreateReference} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="space-y-1 lg:col-span-1" ref={dropdownRef}>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">1. Search & Select Cadet</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search cadet..."
                    value={cadetSearch}
                    onChange={(e) => {
                      setCadetSearch(e.target.value);
                      setShowDropdown(true);
                      if (newMemberId) {
                        setNewMemberId("");
                      }
                    }}
                    onFocus={() => {
                      if (!newMemberId) {
                        setShowDropdown(true);
                      }
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 ${
                      newMemberId ? "pr-8 font-semibold bg-amber-500/5 border-amber-500/30" : ""
                    }`}
                  />
                  {newMemberId ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNewMemberId("");
                        setCadetSearch("");
                        setShowDropdown(false);
                      }}
                      className="absolute right-2 top-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}

                  {!newMemberId && showDropdown && cadetSearch && (
                    <div className="absolute z-20 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded shadow-lg text-xs">
                      {filteredCadets.length === 0 ? (
                        <div className="p-2 text-slate-400">No matching verified cadets</div>
                      ) : (
                        filteredCadets.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setNewMemberId(c.id);
                              setCadetSearch(`${c.rank} ${c.fullName} (${c.id})`);
                              setShowDropdown(false);
                            }}
                            className={`p-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 flex justify-between items-center ${
                              newMemberId === c.id ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600" : ""
                            }`}
                          >
                            <span>{c.rank} {c.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{c.id}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1 lg:col-span-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">2. Command Position/Title</label>
                <input
                  type="text"
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  placeholder="e.g. Section C Commander"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs font-bold"
                />
              </div>

              <div className="space-y-1 lg:col-span-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">3. Display Class</label>
                <select
                  value={newRoleType}
                  onChange={(e) => setNewRoleType(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs"
                >
                  <option value="platoon_commander">Platoon Commander</option>
                  <option value="platoon_in_charge">Platoon In charge</option>
                  <option value="section_leader">Section Leader</option>
                  <option value="section_2ic">2nd in command</option>
                </select>
              </div>

              <div className="space-y-1 lg:col-span-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">4. Order Number</label>
                <input
                  type="number"
                  value={newDisplayOrder}
                  onChange={(e) => setNewDisplayOrder(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5 text-xs text-center font-mono"
                  placeholder="Order"
                />
              </div>

              <div className="lg:col-span-1">
                <button
                  type="submit"
                  disabled={saving || !newMemberId || !newPosition}
                  className="w-full bg-army-800 hover:bg-army-950 text-white font-mono text-xs font-bold py-2 rounded transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span className="truncate">Authorize Assignment</span>
                </button>
              </div>
            </form>
          </div>

          {/* Table/List of Active Platoon Command Assignments */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                Active Command Assignments ({data?.references?.length || 0})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-950/50 text-slate-500 font-mono text-[10px] uppercase border-b border-slate-200 dark:border-slate-850">
                    <th className="p-3">Position / Title</th>
                    <th className="p-3">Cadet ID</th>
                    <th className="p-3">Command Class</th>
                    <th className="p-3 text-center">Display Order</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.references?.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 font-mono">
                        No command roles currently configured. Assign some above.
                      </td>
                    </tr>
                  ) : (
                    data?.references?.map((ref) => (
                      <tr key={ref.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/20">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          <input
                            type="text"
                            value={ref.position}
                            onChange={(e) => handleUpdateReference(ref.id, { position: e.target.value })}
                            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-amber-500 focus:outline-none py-0.5 font-bold text-xs"
                          />
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {ref.memberId}
                        </td>
                        <td className="p-3">
                          <select
                            value={ref.roleType}
                            onChange={(e) => handleUpdateReference(ref.id, { roleType: e.target.value })}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10px]"
                          >
                            <option value="platoon_commander">Platoon Commander</option>
                            <option value="platoon_in_charge">Platoon In charge</option>
                            <option value="section_leader">Section Leader</option>
                            <option value="section_2ic">2nd in command</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            value={ref.displayOrder}
                            onChange={(e) => handleUpdateReference(ref.id, { displayOrder: Number(e.target.value) })}
                            className="w-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded text-center py-0.5 text-[10px] font-mono"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteReference(ref.id)}
                            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 rounded transition-colors"
                            title="Soft delete assignment to trash"
                          >
                            <Trash className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Former PUOs CMS Management Panel */}
          <div id="former-puo-cms-form" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6 mt-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-mono font-black uppercase text-slate-800 dark:text-white tracking-wider flex items-center space-x-2">
                <Award className="h-4 w-4 text-amber-500" />
                <span>{editingFormerPUOId ? "Edit Former Platoon Under Officer (PUO)" : "Add Former Platoon Under Officer (PUO)"}</span>
              </h3>
              {editingFormerPUOId && (
                <button
                  type="button"
                  onClick={handleCancelEditFormerPUO}
                  className="text-xs font-mono text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveFormerPUO} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">1. Officer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. PUO Dr. Md. Aminul Islam"
                  value={fPuoName}
                  onChange={(e) => setFPuoName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">2. Department</label>
                <input
                  type="text"
                  placeholder="e.g. Department of Bangla"
                  value={fPuoDept}
                  onChange={(e) => setFPuoDept(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">3. Service Period (Start–End) *</label>
                <input
                  type="text"
                  placeholder="e.g. 2018 - 2022"
                  value={fPuoServicePeriod}
                  onChange={(e) => setFPuoServicePeriod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">4. Academic Session</label>
                <input
                  type="text"
                  placeholder="e.g. 2018–2022"
                  value={fPuoSession}
                  onChange={(e) => setFPuoSession(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase">5. Photo URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={fPuoPhoto}
                  onChange={(e) => setFPuoPhoto(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-1.5 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !fPuoName || !fPuoServicePeriod}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs font-bold py-2 rounded transition-all flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span>{editingFormerPUOId ? "Update Former PUO Record" : "Add Former PUO Record"}</span>
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase mb-3">
                Managed Former PUO Archive ({formerPUOs.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {formerPUOs.length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono col-span-3 py-3">No former PUO records registered.</p>
                ) : (
                  formerPUOs.map((f) => (
                    <div key={f.id} className="bg-slate-50 dark:bg-slate-950 p-3 rounded border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {f.photo && !f.photo.includes("unsplash") ? (
                          <img src={f.photo} alt={f.name} className="w-9 h-9 rounded-full object-cover shrink-0 border border-amber-500/40" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-army-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/40">
                            {f.name ? f.name.charAt(0) : "P"}
                          </div>
                        )}
                        <div className="truncate text-xs">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{f.servicePeriod}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => handleStartEditFormerPUO(f)}
                          className="text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-850 p-1.5 rounded transition-colors cursor-pointer"
                          title="Edit record"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFormerPUO(f.id, f.name)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 rounded transition-colors cursor-pointer"
                          title="Delete record"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // --- VISUAL DISPLAY MODE ---
        <div className="space-y-16" id="leadership-visual-organogram">
          {/* 1. Visual Chain of Command Chart */}
          <section className="space-y-10 relative">
            <div className="absolute inset-x-0 top-12 bottom-12 w-[2px] bg-gradient-to-b from-amber-500/50 via-army-700/30 to-amber-500/20 left-1/2 -translate-x-1/2 pointer-events-none hidden md:block"></div>

            {/* Level 1: Platoon Commander */}
            <div className="relative z-10 text-center">
              <span className="inline-block text-[9px] font-mono bg-amber-500 text-army-950 font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow mb-4">
                LEVEL I: PLATOON COMMANDER
              </span>
              {data?.references?.filter((r) => r.roleType === "platoon_commander").length === 0 ? (
                <p className="text-xs text-slate-400 font-mono">Platoon Commander position vacant or unassigned</p>
              ) : (
                data?.references?.filter((r) => r.roleType === "platoon_commander").map((role) => (
                  <div key={role.id} className="max-w-xl mx-auto bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl transition-all p-6 text-left relative group">
                    <div className="absolute top-4 right-4 bg-amber-500 text-army-950 font-mono text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                      {role.position}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      {role.photo && !role.photo.includes("unsplash") ? (
                        <img
                          src={role.photo}
                          alt={role.name}
                          className="w-20 h-20 rounded-full border-4 border-amber-400 object-cover shadow-lg shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full border-4 border-amber-400 bg-army-900 text-amber-400 font-display font-black text-xl flex items-center justify-center shadow-lg shrink-0">
                          {role.name ? role.name.charAt(0) : "P"}
                        </div>
                      )}
                      <div className="space-y-1.5 text-center sm:text-left flex-1">
                        <h3 className="font-display font-black text-slate-900 dark:text-white text-base uppercase">
                          ★ {role.name}
                        </h3>
                        <div className="text-xs font-mono space-y-0.5">
                          <p className="text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wide">
                            {role.rank}
                          </p>
                          <p className="text-slate-600 dark:text-slate-300 font-medium uppercase text-[11px] tracking-wide">
                            {role.department}
                          </p>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-light line-clamp-2">
                          {role.bio || "Platoon Commander authorized command log dossier."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Connection Line I */}
            <div className="h-10 flex items-center justify-center pointer-events-none">
              <div className="w-[2px] bg-amber-500 h-full relative">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping"></span>
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-amber-500 border border-white"></span>
              </div>
            </div>

            {/* Level 2: Platoon In charge */}
            <div className="relative z-10 text-center">
              <span className="inline-block text-[9px] font-mono bg-army-900 border border-amber-500/40 text-amber-400 font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow mb-4">
                LEVEL II: PLATOON IN CHARGE
              </span>
              {data?.references?.filter((r) => r.roleType === "platoon_in_charge").length === 0 ? (
                <p className="text-xs text-slate-400 font-mono">Platoon In charge position vacant or unassigned</p>
              ) : (
                data?.references?.filter((r) => r.roleType === "platoon_in_charge").map((role) => (
                  <div key={role.id} className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all p-6 text-left relative group hover:border-amber-500/40">
                    <div className="absolute top-4 right-4 bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300/70 dark:border-amber-500/40 font-mono text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                      {role.position}
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      {role.photo && !role.photo.includes("unsplash") ? (
                        <img
                          src={role.photo}
                          alt={role.name}
                          className="w-20 h-20 rounded-full border-4 border-army-600 object-cover shadow-lg shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full border-4 border-army-600 bg-army-900 text-amber-400 font-display font-black text-xl flex items-center justify-center shadow-lg shrink-0">
                          {role.name ? role.name.charAt(0) : "C"}
                        </div>
                      )}
                      <div className="space-y-1.5 text-center sm:text-left flex-1">
                        <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-base uppercase">
                          {role.name}
                        </h3>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide">
                          {role.rank} • {role.department}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-light line-clamp-2">
                          {role.bio || "Assists the platoon command with overall regimental operations and training."}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Connection Line II */}
            <div className="h-10 flex items-center justify-center pointer-events-none">
              <div className="w-[2px] bg-amber-500 h-full relative">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-amber-500 border border-white"></span>
              </div>
            </div>

            {/* Level 3: Section Leader */}
            <div className="relative z-10 text-center">
              <span className="inline-block text-[9px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-300/70 dark:border-amber-500/40 font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow mb-4">
                LEVEL III: SECTION LEADER
              </span>
              <div className="flex flex-wrap justify-center gap-6 max-w-4xl mx-auto">
                {data?.references?.filter((r) => r.roleType === "section_leader").length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono w-full">Section Leader positions vacant or unassigned</p>
                ) : (
                  data?.references?.filter((r) => r.roleType === "section_leader").map((role) => (
                    <div key={role.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-md p-5 text-left relative group hover:border-amber-500/30 w-full max-w-sm md:w-[360px] shrink-0">
                      <div className="absolute top-3 right-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">
                        {role.position}
                      </div>
                      <div className="flex items-center space-x-4">
                        {role.photo && !role.photo.includes("unsplash") ? (
                          <img
                            src={role.photo}
                            alt={role.name}
                            className="w-14 h-14 rounded-full border-2 border-army-500 object-cover shadow-sm shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full border-2 border-army-500 bg-army-900 text-amber-400 font-bold text-base flex items-center justify-center shadow-sm shrink-0">
                            {role.name ? role.name.charAt(0) : "S"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="font-display font-bold text-sm text-slate-900 dark:text-white uppercase truncate">
                            {role.name}
                          </h4>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">
                            {role.rank}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">{role.department}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Connection Line III */}
            <div className="h-10 flex items-center justify-center pointer-events-none">
              <div className="w-[2px] bg-amber-500 h-full relative">
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-amber-500 border border-white"></span>
              </div>
            </div>

            {/* Level 4: 2nd in command */}
            <div className="relative z-10 text-center">
              <span className="inline-block text-[9px] font-mono bg-slate-100 dark:bg-slate-850 text-slate-700 dark:text-amber-400 font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow mb-4 border border-slate-200 dark:border-slate-800">
                LEVEL IV: 2ND IN COMMAND (2IC)
              </span>

              <div className="flex flex-wrap justify-center gap-5 max-w-4xl mx-auto">
                {data?.references?.filter((r) => r.roleType === "section_2ic").length === 0 ? (
                  <p className="text-xs text-slate-400 font-mono w-full">2nd in command positions vacant or unassigned</p>
                ) : (
                  data?.references?.filter((r) => r.roleType === "section_2ic").map((sec) => (
                    <div
                      key={sec.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm p-4 text-left relative group hover:border-amber-500/30 transition-all w-full max-w-sm md:w-[340px] shrink-0"
                    >
                      <div className="absolute top-2.5 right-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 rounded">
                        {sec.position || "Section 2IC"}
                      </div>
                      <div className="flex items-center space-x-3.5">
                        {sec.photo && !sec.photo.includes("unsplash") ? (
                          <img
                            src={sec.photo}
                            alt={sec.name}
                            className="w-12 h-12 rounded-full border-2 border-army-600/80 object-cover shadow-sm shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full border-2 border-army-600/80 bg-army-900 text-amber-400 font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                            {sec.name ? sec.name.charAt(0) : "S"}
                          </div>
                        )}
                        <div className="min-w-0 pr-12">
                          <h4 className="font-display font-bold text-xs md:text-sm text-slate-900 dark:text-white uppercase truncate">
                            {sec.name}
                          </h4>
                          <p className="text-[9px] font-mono text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wide">
                            {sec.rank}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{sec.department}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Former PUOs Subsection */}
          <section className="space-y-8 pt-10 border-t border-slate-200 dark:border-slate-800" id="former-puos-subsection">
            <div className="text-center max-w-xl mx-auto space-y-1.5">
              <span className="inline-block text-[9px] font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-amber-500/30">
                HERITAGE & ROLL OF HONOR
              </span>
              <h3 className="text-2xl font-display font-extrabold text-army-950 dark:text-white uppercase tracking-tight flex items-center justify-center space-x-2">
                <Award className="h-6 w-6 text-amber-500" />
                <span>FORMER PLATOON UNDER OFFICERS (PUOs)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-sans font-light">
                Chronological roll of honor honoring previous Platoon Commanders of the Uttara Government College BNCC Platoon.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {sortedFormerPUOs.length === 0 ? (
                <p className="text-xs text-slate-400 font-mono col-span-3 text-center py-4">
                  No former PUO records registered.
                </p>
              ) : (
                sortedFormerPUOs.map((fpuo) => (
                  <div
                    key={fpuo.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between"
                  >
                    <div className="flex items-start space-x-4">
                      {fpuo.photo && !fpuo.photo.includes("unsplash") ? (
                        <img
                          src={fpuo.photo}
                          alt={fpuo.name}
                          className="w-16 h-16 rounded-full border-2 border-amber-500 object-cover shadow-sm shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full border-2 border-amber-500 bg-army-900 text-amber-400 font-bold text-lg flex items-center justify-center shadow-sm shrink-0">
                          {fpuo.name ? fpuo.name.charAt(0) : "P"}
                        </div>
                      )}
                      <div className="space-y-1 min-w-0">
                        <span className="text-[9px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 px-2 py-0.5 rounded uppercase inline-block">
                          Former PUO
                        </span>
                        <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm uppercase truncate">
                          {fpuo.name}
                        </h4>
                        <p className="text-xs font-medium text-army-800 dark:text-amber-400">{fpuo.department}</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] text-slate-400 block uppercase">Session</span>
                        <strong className="text-slate-800 dark:text-slate-200 text-[11px]">{fpuo.session}</strong>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/60 p-2 rounded border border-slate-100 dark:border-slate-800">
                        <span className="text-[9px] text-slate-400 block uppercase">Service Period</span>
                        <strong className="text-slate-800 dark:text-slate-200 text-[11px]">{fpuo.servicePeriod}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* 3. Rank Badges Dictionary */}
      <section className="bg-army-50 dark:bg-slate-900 p-6 rounded-xl border border-army-100 dark:border-slate-800 shadow-inner">
        <h3 className="text-sm font-mono tracking-widest text-army-800 dark:text-amber-500 uppercase mb-4 text-center">
          ★ BNCC PLATOON RANK DICTIONARY ★
        </h3>
        <div className="grid md:grid-cols-4 gap-6">
          {rankReference.map((ref) => (
            <div key={ref.name} className="bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className={`inline-block border text-[10px] font-mono font-bold px-2 py-0.5 rounded mb-3 ${ref.badge}`}>
                  {ref.name}
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-light">{ref.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Confirmation Modal Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full shrink-0">
                <Trash className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-900 dark:text-white">
                  {confirmDialog.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-bold transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
