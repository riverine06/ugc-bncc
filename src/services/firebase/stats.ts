import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { MemberStatus, BNCCRank } from "../../types";

export interface LiveStats {
  totalMembers: number;
  activeCadets: number;
  alumni: number;
  events: number;
  camps: number;
  pendingApprovals: number;
  totalAwards: number;
}

/**
 * Computes live aggregate platform stats across cadets, events, applications, achievements, and camps
 */
export async function getLiveStats(): Promise<LiveStats> {
  let totalMembers = 0;
  let activeCadets = 0;
  let alumni = 0;
  let totalEvents = 0;
  let campsCount = 0;
  let pendingApprovals = 0;
  let totalAwards = 0;

  try {
    const cadetSnap = await getDocs(collection(db, "cadets"));
    const cadets = cadetSnap.docs.map((d) => d.data());
    totalMembers = cadets.length;
    activeCadets = cadets.filter(
      (c) => c.status === MemberStatus.ACTIVE_CADET && c.rank !== BNCCRank.PLATOON_UNDER_OFFICER
    ).length;
    alumni = cadets.filter((c) => c.status === MemberStatus.ALUMNI).length;
  } catch (error) {
    console.warn("[StatsService] Stats: Failed to fetch cadets (possibly insufficient permissions):", error);
  }

  try {
    const eventSnap = await getDocs(collection(db, "events"));
    totalEvents = eventSnap.docs.length;
  } catch (error) {
    console.warn("[StatsService] Stats: Failed to fetch events:", error);
  }

  try {
    const appSnap = await getDocs(collection(db, "applications"));
    pendingApprovals = appSnap.docs.map((d) => d.data()).filter((a) => a.status === "Pending").length;
  } catch {
    // Expected for non-admin visitors who cannot read the applications collection
    console.log("[StatsService] Stats: Applications fetch bypassed for non-admin user.");
  }

  try {
    const achSnap = await getDocs(collection(db, "achievements"));
    totalAwards = achSnap.docs.length;
  } catch (error) {
    console.warn("[StatsService] Stats: Failed to fetch achievements:", error);
  }

  try {
    const campSnap = await getDocs(collection(db, "camps"));
    campsCount = campSnap.docs.length;
  } catch (error) {
    console.warn("[StatsService] Stats: Failed to fetch camps:", error);
  }

  return {
    totalMembers,
    activeCadets,
    alumni,
    events: totalEvents,
    camps: campsCount,
    pendingApprovals,
    totalAwards
  };
}
