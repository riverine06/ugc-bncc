import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../firebase";
import { TrashItem } from "../../types";
import { generateId, subscribeToCollection } from "./firestore";
import { logActivity } from "./audit";
import { removeCadetAchievements } from "./achievements";

/**
 * Moves an existing document to the Recycle Bin (trash collection) without permanent loss
 */
export async function softDeleteRecord(
  collectionName: string,
  recordId: string,
  title: string,
  data: any,
  userEmail: string,
  userId: string
): Promise<string | undefined> {
  const path = `trash/${recordId}`;
  try {
    const trashId = generateId("tr");
    const trashItem: TrashItem = {
      id: trashId,
      type: collectionName as any,
      title: title || "Unnamed Record",
      deletedAt: new Date().toISOString(),
      data: { ...data, id: recordId }
    };

    // 1. Write to Trash collection
    await setDoc(doc(db, "trash", trashId), trashItem);

    // 2. Delete original document
    await deleteDoc(doc(db, collectionName, recordId));

    // 3. If deleting a cadet/member, soft-delete all related achievements as well
    if (collectionName === "cadets" || collectionName === "members") {
      await removeCadetAchievements(recordId, true, userEmail, userId);
    }

    // 4. Log Audit Activity
    await logActivity(
      userId,
      userEmail,
      "Soft Delete Record",
      collectionName,
      recordId,
      `Soft-deleted ${collectionName} item: "${title}"`
    );

    return trashId;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Restores a soft-deleted item from the trash collection back into its original collection
 */
export async function restoreRecordFromTrash(
  trashId: string,
  userEmail: string,
  userId: string
): Promise<string | undefined> {
  const path = `trash/${trashId}`;
  try {
    const trashDocRef = doc(db, "trash", trashId);
    const trashSnap = await getDoc(trashDocRef);

    if (!trashSnap.exists()) {
      throw new Error("Target trash record no longer exists.");
    }

    const trashItem = trashSnap.data() as TrashItem;
    const { type, data } = trashItem;
    const originalId = data.id || generateId("rec");

    // 1. Restore to original collection
    await setDoc(doc(db, type, originalId), data);

    // 2. Remove from Trash
    await deleteDoc(trashDocRef);

    // 3. If restoring a cadet, also restore any soft-deleted achievements belonging to this cadet
    if ((type as string) === "cadets" || (type as string) === "cadet" || (type as string) === "members") {
      try {
        const trashSnapAll = await getDocs(collection(db, "trash"));
        for (const trDoc of trashSnapAll.docs) {
          const item = trDoc.data();
          if (item.type === "achievements" && item.data) {
            const achData = item.data;
            if (achData.memberId === originalId || achData.recipientId === originalId || achData.cadetId === originalId) {
              await restoreRecordFromTrash(trDoc.id, userEmail, userId).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn("Failed restoring cadet achievements from trash:", err);
      }
    }

    // 4. Log Audit Activity
    await logActivity(
      userId,
      userEmail,
      "Restore Record",
      type,
      originalId,
      `Restored ${type} item: "${trashItem.title}" from Recycle Bin`
    );

    return originalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Permanently purges a record from the trash collection
 */
export async function permanentPurgeRecord(
  trashId: string,
  userEmail: string,
  userId: string
): Promise<void> {
  const path = `trash/${trashId}`;
  try {
    const trashDocRef = doc(db, "trash", trashId);
    let trashItem: TrashItem | null = null;
    try {
      const trashSnap = await getDoc(trashDocRef);
      if (trashSnap.exists()) {
        trashItem = trashSnap.data() as TrashItem;
      }
    } catch (getErr) {
      console.warn(`[RecycleBinService] Error reading trash doc prior to purge:`, getErr);
    }

    // Always unconditionally delete from Firestore trash collection
    await deleteDoc(trashDocRef);

    // If purging a cadet, also purge any related achievement trash items
    if (
      trashItem &&
      ((trashItem.type as string) === "cadets" ||
        (trashItem.type as string) === "cadet" ||
        (trashItem.type as string) === "members")
    ) {
      const cadetId = trashItem.data?.id;
      if (cadetId) {
        try {
          const trashSnapAll = await getDocs(collection(db, "trash"));
          for (const trDoc of trashSnapAll.docs) {
            const item = trDoc.data();
            if (item.type === "achievements" && item.data) {
              const achData = item.data;
              if (achData.memberId === cadetId || achData.recipientId === cadetId || achData.cadetId === cadetId) {
                await deleteDoc(doc(db, "trash", trDoc.id)).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.warn("Failed purging cadet related achievement trash items:", e);
        }
      }
    }

    // Log Audit Activity safely
    const itemTitle = trashItem?.title || trashId;
    const itemType = trashItem?.type || "Trash";
    const targetDocId = trashItem?.data?.id || trashId;

    await logActivity(
      userId,
      userEmail,
      "Permanent Purge",
      itemType,
      targetDocId,
      `Permanently purged ${itemType} item: "${itemTitle}" from physical memory`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Real-time subscription to Recycle Bin trash items
 */
export function subscribeToTrash(callback: (items: TrashItem[]) => void): () => void {
  return subscribeToCollection<TrashItem>("trash", callback);
}

export const recycleBinService = {
  softDelete: softDeleteRecord,
  restore: restoreRecordFromTrash,
  permanentPurge: permanentPurgeRecord,
  subscribe: subscribeToTrash
};
