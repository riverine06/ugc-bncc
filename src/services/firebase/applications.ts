import {
  collection,
  doc,
  getDocs,
  setDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { PlatoonApplication, Member } from "../../types";
import { generateId, subscribeToCollection, createDocument, updateDocument, getSingleDocument } from "./firestore";

/**
 * Synchronizes approved or pending applicant camp participation and past honors with the cadet record
 */
export async function autoSyncApplicationsWithCadets(): Promise<void> {
  try {
    const appsSnap = await getDocs(collection(db, "applications"));
    if (appsSnap.empty) return;

    const cadetsSnap = await getDocs(collection(db, "cadets"));
    if (cadetsSnap.empty) return;

    const cadetsList = cadetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Member));
    const campPartsSnap = await getDocs(collection(db, "campParticipants"));
    const existingCampParts = campPartsSnap.docs.map((d) => d.data());
    const achsSnap = await getDocs(collection(db, "achievements"));
    const existingAchs = achsSnap.docs.map((d) => d.data());

    for (const appDoc of appsSnap.docs) {
      const app = appDoc.data() as PlatoonApplication;
      if (!app.email && !app.cadetId) continue;

      // Find matching cadet in cadets collection
      const matchedCadet = cadetsList.find(
        (c) =>
          (app.cadetId && c.id.toUpperCase() === app.cadetId.toUpperCase()) ||
          (app.email && c.email && c.email.toLowerCase().trim() === app.email.toLowerCase().trim()) ||
          (app.phone && c.phone && c.phone.trim() === app.phone.trim())
      );

      if (!matchedCadet) continue;
      const memberId = matchedCadet.id;
      const recipientName = `${matchedCadet.rank || "Cadet"} ${matchedCadet.fullName}`.trim();

      // 1. Sync campsParticipation
      if (app.campsParticipation && Array.isArray(app.campsParticipation)) {
        for (const cp of app.campsParticipation) {
          const exists = existingCampParts.some(
            (ecp: any) =>
              ecp.memberId === memberId &&
              (ecp.campId === cp.campId || ecp.campName?.toLowerCase() === cp.campName?.toLowerCase())
          );
          if (!exists) {
            const cpId = generateId("cp");
            await setDoc(doc(db, "campParticipants", cpId), {
              id: cpId,
              campId: cp.campId,
              memberId: memberId,
              role: cp.role || "Participant",
              awards: cp.achievements || "",
              remarks: "Auto-synced from application"
            });
            existingCampParts.push({ memberId, campId: cp.campId, campName: cp.campName });
          }

          if (cp.achievements && cp.achievements.trim()) {
            const achExists = existingAchs.some(
              (ea: any) =>
                ea.memberId === memberId &&
                ea.title?.trim().toLowerCase() === cp.achievements?.trim().toLowerCase()
            );
            if (!achExists) {
              const achId = generateId("ach");
              await setDoc(doc(db, "achievements", achId), {
                id: achId,
                memberId: memberId,
                recipientId: memberId,
                cadetId: memberId,
                recipient: recipientName,
                title: cp.achievements.trim(),
                description: `Earned award "${cp.achievements.trim()}" during ${cp.campName || "Battalion Camp"}.`,
                date: new Date().toISOString().split("T")[0],
                category: "Camp Honor",
                issuedBy: cp.campName || "3 Ramna Battalion Command",
                campName: cp.campName || "Battalion Camp"
              });
              existingAchs.push({ memberId, title: cp.achievements.trim() });
            }
          }
        }
      }

      // 2. Sync pastAchievements
      if (app.pastAchievements && app.pastAchievements.trim()) {
        const achExists = existingAchs.some(
          (ea: any) =>
            ea.memberId === memberId &&
            ea.title?.trim().toLowerCase() === app.pastAchievements?.trim().toLowerCase()
        );
        if (!achExists) {
          const achId = generateId("ach");
          await setDoc(doc(db, "achievements", achId), {
            id: achId,
            memberId: memberId,
            recipientId: memberId,
            cadetId: memberId,
            recipient: recipientName,
            title: app.pastAchievements.trim(),
            description: "Historical achievement listed during platoon application.",
            date: matchedCadet.joiningYear ? `${matchedCadet.joiningYear}-01-01` : new Date().toISOString().split("T")[0],
            category: "Past Honor",
            issuedBy: "UGC Platoon Command"
          });
          existingAchs.push({ memberId, title: app.pastAchievements.trim() });
        }
      }
    }
  } catch (err) {
    console.debug("[autoSyncApplicationsWithCadets] Skipped auto-sync:", err);
  }
}

export function subscribeToApplications(callback: (apps: PlatoonApplication[]) => void): () => void {
  return subscribeToCollection<PlatoonApplication>("applications", callback);
}

export const applicationsService = {
  autoSync: autoSyncApplicationsWithCadets,
  subscribe: subscribeToApplications,
  create: (data: Partial<PlatoonApplication>, id?: string) => createDocument("applications", data, id),
  update: (id: string, data: Partial<PlatoonApplication>) => updateDocument("applications", id, data),
  get: (id: string) => getSingleDocument("applications", id) as Promise<PlatoonApplication | null>,
};
