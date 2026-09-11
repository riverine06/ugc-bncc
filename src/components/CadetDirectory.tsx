/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import { Search, UserCheck, Briefcase, MapPin, Award, Compass, RefreshCw, Star, ShieldCheck } from "lucide-react";
import { Member, BNCCRank, MemberStatus } from "../types";
import { subscribeToCollection } from "../firebaseService";

interface CadetDirectoryProps {
  members: Member[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectMember: (id: string) => void;
  onReload: () => void;
}

export default function CadetDirectory({
  members,
  searchQuery,
  onSearchChange,
  onSelectMember,
  onReload,
}: CadetDirectoryProps) {
  const [activeTab, setActiveTab] = React.useState<"active" | "officers" | "alumni">("active");
  const [filterBatch, setFilterBatch] = React.useState<string>("");
  const [filterRank, setFilterRank] = React.useState<string>("");
  const [filterGroup, setFilterGroup] = React.useState<string>("");

  const [campParticipants, setCampParticipants] = React.useState<any[]>([]);
  const [achievements, setAchievements] = React.useState<any[]>([]);
  const [applications, setApplications] = React.useState<any[]>([]);

  React.useEffect(() => {
    const unsubCP = subscribeToCollection<any>("campParticipants", (data) => setCampParticipants(data));
    const unsubAch = subscribeToCollection<any>("achievements", (data) => setAchievements(data));
    const unsubApp = subscribeToCollection<any>("applications", (data) => setApplications(data));
    return () => {
      unsubCP();
      unsubAch();
      unsubApp();
    };
  }, []);

  const getCadetStats = (member: Member) => {
    const memberId = member.id;
    const memberEmail = (member.email || "").toLowerCase().trim();
    const memberPhone = (member.phone || "").replace(/\D/g, "");

    // 1. Camps count (deduplicated)
    const seenCampKeys = new Set<string>();

    campParticipants
      .filter((cp) => cp.memberId === memberId)
      .forEach((cp) => {
        const campName = cp.campName || "Camp";
        const key = `${cp.campId || ""}_${campName.toLowerCase().trim()}`;
        seenCampKeys.add(key);
      });

    const matchingApp = applications.find((app) => {
      const appEmail = (app.email || "").toLowerCase().trim();
      const appPhone = (app.phone || "").replace(/\D/g, "");
      const appCadetId = app.cadetId || "";
      return (
        (memberEmail && appEmail && memberEmail === appEmail) ||
        (memberPhone && appPhone && memberPhone === appPhone) ||
        (memberId && appCadetId && memberId === appCadetId)
      );
    });

    if (matchingApp && Array.isArray(matchingApp.campsParticipation)) {
      matchingApp.campsParticipation.forEach((appCamp: any) => {
        const campName = appCamp.campName || "Camp";
        const key = `${appCamp.campId || ""}_${campName.toLowerCase().trim()}`;
        seenCampKeys.add(key);
      });
    }

    // 2. Awards count (deduplicated)
    const seenAwardTitles = new Set<string>();

    achievements
      .filter((a) => a.memberId === memberId || a.recipientId === memberId || a.cadetId === memberId)
      .forEach((a) => {
        const title = (a.title || "").toLowerCase().trim();
        if (title) seenAwardTitles.add(title);
      });

    campParticipants
      .filter((cp) => cp.memberId === memberId && cp.awards && cp.awards.trim() !== "")
      .forEach((cp) => {
        const title = cp.awards.trim().toLowerCase();
        if (title) seenAwardTitles.add(title);
      });

    if (matchingApp) {
      if (matchingApp.pastAchievements && matchingApp.pastAchievements.trim()) {
        const title = matchingApp.pastAchievements.trim().toLowerCase();
        if (title) seenAwardTitles.add(title);
      }
      if (Array.isArray(matchingApp.campsParticipation)) {
        matchingApp.campsParticipation.forEach((appCamp: any) => {
          if (appCamp.achievements && appCamp.achievements.trim()) {
            const title = appCamp.achievements.trim().toLowerCase();
            if (title) seenAwardTitles.add(title);
          }
        });
      }
    }

    return {
      campsCount: seenCampKeys.size,
      awardsCount: seenAwardTitles.size,
    };
  };

  // Derive filter option sets excluding officers and PUO ranks/designations
  const cadetMembersOnly = members.filter(
    (m) =>
      m.status !== MemberStatus.PLATOON_OFFICER &&
      m.rank !== BNCCRank.PLATOON_UNDER_OFFICER &&
      !m.isArmyStaff &&
      !m.rank?.toLowerCase().includes("puo") &&
      !m.rank?.toLowerCase().includes("platoon under officer")
  );

  const currentYear = new Date().getFullYear();
  const defaultBatchYears = Array.from({ length: Math.max(1, currentYear - 2018 + 1) }, (_, i) => (currentYear - i).toString());
  const memberBatches = cadetMembersOnly
    .map((m) => m.joiningYear ? m.joiningYear.toString() : "")
    .filter((b) => b && !isNaN(Number(b)));
  const batches = Array.from(new Set([...defaultBatchYears, ...memberBatches])).sort((a, b) => Number(b) - Number(a));

  const ranks = Array.from(
    new Set(
      cadetMembersOnly
        .map((m) => m.rank)
        .filter((r) => r && !r.toLowerCase().includes("puo") && !r.toLowerCase().includes("platoon under officer"))
    )
  );

  const isOfficerTitle = (str: string) => {
    const s = str.toLowerCase();
    return (
      s.includes("professor") ||
      s.includes("lecturer") ||
      s.includes("associate") ||
      s.includes("assistant") ||
      s.includes("officer") ||
      s.includes("puo") ||
      s.includes("teacher") ||
      s.includes("head")
    );
  };

  const groups = Array.from(
    new Set(
      cadetMembersOnly
        .map((m) => m.department)
        .filter((g) => g && !isOfficerTitle(g))
    )
  );

  // Filter local state based on active tabs & custom dropdown filters
  const filtered = members.filter((member) => {
    // 1. Tab separation
    let matchesTab = false;
    if (activeTab === "active") {
      matchesTab = member.status === MemberStatus.ACTIVE_CADET && member.rank !== BNCCRank.PLATOON_UNDER_OFFICER;
    } else if (activeTab === "officers") {
      matchesTab = member.status === MemberStatus.PLATOON_OFFICER || member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.isArmyStaff === true;
    } else if (activeTab === "alumni") {
      matchesTab = member.status === MemberStatus.ALUMNI;
    }

    if (!matchesTab) return false;

    // 2. Dropdowns
    if (activeTab === "alumni" && filterBatch) {
      const mYear = member.joiningYear?.toString() || "";
      const mSession = member.session || "";
      if (mYear !== filterBatch && !mSession.includes(filterBatch)) return false;
    }
    if (filterRank && member.rank !== filterRank) return false;
    if (filterGroup && member.department !== filterGroup) return false;

    // 3. Main search query
    if (searchQuery) {
      const term = searchQuery.toLowerCase();
      const matchesSearch =
        member.fullName.toLowerCase().includes(term) ||
        member.id.toLowerCase().includes(term) ||
        member.department.toLowerCase().includes(term) ||
        (member.joiningYear && member.joiningYear.toString().includes(term)) ||
        (member.session && member.session.toLowerCase().includes(term)) ||
        (member.currentProfession && member.currentProfession.toLowerCase().includes(term)) ||
        (member.currentCity && member.currentCity.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }

    return true;
  });

  // Rank priority mapping (lower number = higher rank)
  const getRankWeight = (rank: string): number => {
    const r = (rank || "").toLowerCase();
    if (r.includes("platoon under officer") || r.includes("puo")) return 1;
    if (r.includes("cadet under officer") || r.includes("cuo")) return 2;
    if (r.includes("sergeant") || r.includes("sgt")) return 3;
    if (r.includes("corporal") || r.includes("cpl")) return 5;
    if (r.includes("lance corporal") || r.includes("l/cpl")) return 6;
    if (r.includes("cadet")) return 7;
    if (r.includes("recruit")) return 8;
    return 9;
  };

  // Sort cadets: 1. Batch (Newest batch first), 2. Rank within each batch
  const sortedFiltered = [...filtered].sort((a, b) => {
    // 1. Batch (Newest batch first e.g., 2026 > 2025 > 2024 ... > 2018)
    const batchA = a.joiningYear || (a.session ? parseInt(a.session, 10) || 0 : 0);
    const batchB = b.joiningYear || (b.session ? parseInt(b.session, 10) || 0 : 0);
    if (batchB !== batchA) {
      return batchB - batchA;
    }

    // 2. Rank hierarchy within each batch (Highest rank first)
    const rankA = getRankWeight(a.rank);
    const rankB = getRankWeight(b.rank);
    if (rankA !== rankB) {
      return rankA - rankB;
    }

    // 3. Fallback name alphabetical
    return a.fullName.localeCompare(b.fullName);
  });

  const resetFilters = () => {
    setFilterBatch("");
    setFilterRank("");
    setFilterGroup("");
    onSearchChange("");
  };

  return (
    <div className="w-full mx-auto py-10 space-y-8">
      {/* 1. Directory Header with Toggle Tabs */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-army-950 dark:text-amber-400 uppercase tracking-tight">
            CADET LEDGER DIRECTORY
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
            Search, filter, and review military service records and alumni networking histories.
          </p>
        </div>

        {/* Directory Separation Tabs */}
        <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row w-full sm:w-auto self-start gap-1 sm:gap-0">
          <button
            onClick={() => {
              setActiveTab("active");
              resetFilters();
            }}
            className={`flex items-center justify-center space-x-1 px-3.5 py-2 rounded-md font-display font-bold text-xs uppercase transition-all w-full sm:w-auto cursor-pointer ${
              activeTab === "active" 
                ? "bg-white dark:bg-slate-800 text-army-900 dark:text-amber-400 shadow-sm" 
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Active Cadets ({members.filter((m) => m.status === MemberStatus.ACTIVE_CADET && m.rank !== BNCCRank.PLATOON_UNDER_OFFICER).length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("officers");
              resetFilters();
            }}
            className={`flex items-center justify-center space-x-1 px-3.5 py-2 rounded-md font-display font-bold text-xs uppercase transition-all w-full sm:w-auto cursor-pointer ${
              activeTab === "officers" 
                ? "bg-white dark:bg-slate-800 text-army-900 dark:text-amber-400 shadow-sm" 
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
            <span>Platoon Officers ({members.filter((m) => m.status === MemberStatus.PLATOON_OFFICER || m.rank === BNCCRank.PLATOON_UNDER_OFFICER || m.isArmyStaff).length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("alumni");
              resetFilters();
            }}
            className={`flex items-center justify-center space-x-1 px-3.5 py-2 rounded-md font-display font-bold text-xs uppercase transition-all w-full sm:w-auto cursor-pointer ${
              activeTab === "alumni" 
                ? "bg-white dark:bg-slate-800 text-army-900 dark:text-amber-400 shadow-sm" 
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Star className="h-3.5 w-3.5" />
            <span>Alumni Archive ({members.filter((m) => m.status === MemberStatus.ALUMNI).length})</span>
          </button>
        </div>
      </div>

      {/* 2. Filters Bento Panel (Hidden for Platoon Officers) */}
      {activeTab !== "officers" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-slate-400 dark:text-slate-500 uppercase">
              SEARCH FILTERS
            </span>
            <button
              onClick={resetFilters}
              className="text-[10px] font-mono font-bold text-army-700 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-400 flex items-center space-x-1 uppercase cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          </div>

          <div className={`grid grid-cols-1 ${activeTab === "alumni" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
            {/* Main search bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Name, Group, City..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-8 pr-3 text-xs w-full text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
              />
              <Search className="absolute left-2.5 top-3 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Batch filter - only shown for Alumni Archive */}
            {activeTab === "alumni" && (
              <select
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
              >
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="">Filter by Batch (All)</option>
                {batches.map((b) => (
                  <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={b} value={b}>
                    Batch {b}
                  </option>
                ))}
              </select>
            )}

            {/* Rank filter */}
            <select
              value={filterRank}
              onChange={(e) => setFilterRank(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="">Filter by Rank (All)</option>
              {ranks.map((r) => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* HSC Group filter */}
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500 dark:focus:border-amber-500"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="">Filter by HSC Group (All)</option>
              {groups.map((g) => (
                <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* 3. Members Directory List View */}
      {sortedFiltered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 italic text-sm">No cadet files found matching filters.</p>
          <button
            onClick={resetFilters}
            className="mt-4 bg-army-900 hover:bg-army-800 text-white font-mono text-[10px] font-bold uppercase tracking-wider px-4 py-2.5 rounded shadow-sm cursor-pointer"
          >
            Show All Profiles
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedFiltered.map((member) => (
            <motion.div
              layout
              key={member.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 dark:hover:border-amber-500/40 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              {/* Card top banner/color strip */}
              <div className="h-2.5 bg-army-900 dark:bg-[#124632]"></div>

              {/* Card Content */}
              <div className="p-5 flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex items-start space-x-4 mb-4">
                    <img
                      src={member.photoUrl}
                      alt={member.fullName}
                      className="w-16 h-16 rounded-full border-2 border-army-600 object-cover shadow-sm flex-shrink-0"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="flex items-center space-x-1 flex-wrap gap-1">
                        <span className="text-[9px] bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/70 dark:border-amber-500/40 font-bold px-1.5 py-0.5 rounded font-mono uppercase">
                          {member.rank}
                        </span>
                        {member.verified && (
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold px-1 py-0.5 rounded font-mono">
                            VERIFIED
                          </span>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-slate-900 dark:text-white mt-1 hover:text-army-700 dark:hover:text-amber-400 cursor-pointer text-sm" onClick={() => onSelectMember(member.id)}>
                        {member.fullName}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {member.id}</p>
                    </div>
                  </div>

                  {/* Core academic / platoon details */}
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded space-y-1 text-[11px] text-slate-600 dark:text-slate-400 font-mono border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between gap-2">
                      <span>
                        {member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER
                          ? "DESIGNATION / GROUP:"
                          : "HSC GROUP:"}
                      </span>
                      <strong className="text-slate-900 dark:text-slate-200 truncate max-w-[140px]" title={member.department}>{member.department}</strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>
                        {member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER
                          ? "SERVICE SESSION:"
                          : "SESSION:"}
                      </span>
                      <strong className="text-slate-900 dark:text-slate-200">{member.session}</strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>
                        {member.rank === BNCCRank.PLATOON_UNDER_OFFICER || member.status === MemberStatus.PLATOON_OFFICER
                          ? "APPOINTED YEAR:"
                          : "JOIN YEAR:"}
                      </span>
                      <strong className="text-slate-900 dark:text-slate-200">{member.joiningYear}</strong>
                    </div>
                    {member.status === MemberStatus.ALUMNI && member.graduationYear && (
                      <div className="flex justify-between gap-2 text-amber-700 dark:text-amber-500">
                        <span>GRAD YEAR:</span>
                        <strong>{member.graduationYear}</strong>
                      </div>
                    )}
                  </div>

                  {/* Show current profession if alumni */}
                  {member.status === MemberStatus.ALUMNI && member.currentProfession && (
                    <div className="mt-3.5 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-center space-x-1.5 text-xs text-slate-800 dark:text-slate-200">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-sans font-medium line-clamp-1">{member.currentProfession}</span>
                      </div>
                      {member.currentOrganization && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 ml-5 truncate max-w-[200px]">
                          {member.currentOrganization}
                        </p>
                      )}
                      {member.currentCity && (
                        <div className="flex items-center space-x-1 text-[10px] text-slate-400 ml-5">
                          <MapPin className="h-3 w-3 text-slate-300" />
                          <span>{member.currentCity}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show quick stats (active cadets & alumni) */}
                  {(member.status === MemberStatus.ACTIVE_CADET || member.status === MemberStatus.ALUMNI) && (
                    <div className="mt-3.5 flex items-center space-x-3 text-[10px] text-slate-400 font-mono border-t border-slate-100 dark:border-slate-800 pt-3">
                      {(() => {
                        const stats = getCadetStats(member);
                        return (
                          <>
                            <div className="flex items-center space-x-1">
                              <Compass className="h-3.5 w-3.5 text-slate-300" />
                              <span>Camps: {stats.campsCount}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Award className="h-3.5 w-3.5 text-slate-300" />
                              <span>Awards: {stats.awardsCount}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Profile CTA */}
                <button
                  onClick={() => onSelectMember(member.id)}
                  className="mt-5 w-full bg-slate-100 hover:bg-army-900 hover:text-white dark:bg-slate-800 dark:hover:bg-amber-500 dark:hover:text-slate-950 border border-slate-200 hover:border-army-900 dark:border-slate-700 dark:hover:border-amber-500 text-slate-700 dark:text-slate-300 font-display font-bold py-2.5 rounded text-xs transition-colors tracking-wide uppercase shadow-sm cursor-pointer"
                >
                  VIEW CADET PROFILE
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
