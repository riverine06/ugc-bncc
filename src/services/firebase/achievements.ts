import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../../firebase";
import { generateId, registerUpdateHook, subscribeToCollection, createDocument, updateDocument } from "./firestore";
import { logActivity } from "./audit";
import { TrashItem } from "../../types";

/**
 * Synchronizes cadet rank updates to all achievements referencing that cadet
 */
export async function syncCadetRankInAchievements(cadetId: string, newRank: string, fullName?: string): Promise<void> {
  try {
    const achsSnap = await getDocs(collection(db, "achievements"));
    for (const achDoc of achsSnap.docs) {
      const ach = achDoc.data();
      if (ach.memberId === cadetId || ach.recipientId === cadetId || ach.cadetId === cadetId) {
        let nameToUse = fullName;
        if (!nameToUse) {
          try {
            const cadetDocSnap = await getDoc(doc(db, "cadets", cadetId));
            if (cadetDocSnap.exists()) {
              nameToUse = cadetDocSnap.data().fullName;
            }
          } catch {
            // fallback
          }
        }
        const updatedRecipient = nameToUse ? `${newRank} ${nameToUse}`.trim() : `${newRank} Cadet`;
        await updateDoc(doc(db, "achievements", achDoc.id), {
          recipient: updatedRecipient,
        }).catch((e) => console.warn("[syncCadetRankInAchievements] Error updating doc:", e));
      }
    }
  } catch (err) {
    console.warn("[syncCadetRankInAchievements] Error querying achievements:", err);
  }
}

// Hook into generic Firestore updateDocument to auto-sync rank changes
registerUpdateHook(async (collectionName, id, data) => {
  if ((collectionName === "cadets" || collectionName === "members") && data.rank) {
    await syncCadetRankInAchievements(id, data.rank, data.fullName);
  }
});

/**
 * Safely soft-deletes achievements associated with a cadet into the trash collection
 */
export async function removeCadetAchievements(
  cadetId: string,
  _isSoftDelete: boolean = true,
  userEmail: string = "admin@ugcbncc.org",
  userId: string = "admin"
): Promise<void> {
  try {
    if (!cadetId || !cadetId.trim()) return;
    const achsSnap = await getDocs(collection(db, "achievements"));
    for (const achDoc of achsSnap.docs) {
      const ach = achDoc.data();
      if (ach.memberId === cadetId || ach.recipientId === cadetId || ach.cadetId === cadetId) {
        const trashId = generateId("tr");
        const trashItem: TrashItem = {
          id: trashId,
          type: "achievements" as any,
          title: ach.title || "Related Achievement",
          deletedAt: new Date().toISOString(),
          data: { ...ach, id: achDoc.id }
        };
        await setDoc(doc(db, "trash", trashId), trashItem);
        await deleteDoc(doc(db, "achievements", achDoc.id));
        await logActivity(
          userId,
          userEmail,
          "Soft Delete Record",
          "achievements",
          achDoc.id,
          `Soft-deleted achievements item: "${ach.title || "Related Achievement"}"`
        );
      }
    }
  } catch (err) {
    console.warn("[removeCadetAchievements] Error archiving achievements:", err);
  }
}

/**
 * Non-destructive metadata backfill for achievements
 */
export async function cleanUpDuplicateCampAndAchievements(): Promise<void> {
  try {
    const cadetsSnap = await getDocs(collection(db, "cadets"));
    const cadetsList = cadetsSnap.empty ? [] : cadetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const achsSnap = await getDocs(collection(db, "achievements"));
    if (!achsSnap.empty) {
      for (const docSnap of achsSnap.docs) {
        const data = docSnap.data();
        const memberId = data.memberId || data.recipientId || data.cadetId || "";
        const updates: Record<string, any> = {};

        if (!data.recipient || data.recipient === "★" || !data.recipient.trim()) {
          if (memberId) {
            const match = cadetsList.find((c) => c.id === memberId || c.id.toUpperCase() === memberId.toUpperCase());
            if (match) {
              updates.recipient = `${match.rank || "Cadet"} ${match.fullName}`.trim();
              updates.recipientId = memberId;
            }
          }
        }
        if (!data.issuedBy || !data.issuedBy.trim()) {
          updates.issuedBy = data.campName || (data.category === "Camp Honor" ? "3 Ramna Battalion Command" : "UGC Platoon Command");
        }
        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, "achievements", docSnap.id), updates).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.debug("[cleanUpDuplicateCampAndAchievements] Skipped non-destructive backfill:", err);
  }
}

/**
 * Achievement-specific CRUD helpers
 */
export const achievementsService = {
  syncCadetRank: syncCadetRankInAchievements,
  removeCadetAchievements,
  cleanUpDuplicates: cleanUpDuplicateCampAndAchievements,
  subscribe: (callback: (items: any[]) => void) => subscribeToCollection("achievements", callback),
  create: (data: any, id?: string) => createDocument("achievements", data, id),
  update: (id: string, data: any) => updateDocument("achievements", id, data),
};
