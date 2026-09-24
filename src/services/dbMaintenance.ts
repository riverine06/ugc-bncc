import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { softDeleteRecord } from "../firebaseService";

export interface DuplicateAuditItem {
  id: string;
  collection: "campParticipants" | "achievements";
  key: string;
  titleOrDetail: string;
  memberId: string;
  isPrimary: boolean;
}

export interface DuplicateAuditReport {
  totalChecked: number;
  duplicateCount: number;
  duplicates: DuplicateAuditItem[];
}

/**
 * SAFE DUPLICATE AUDIT (DRY RUN ONLY)
 *
 * Inspects collections for duplicate candidate records without modifying,
 * deleting, or altering ANY document in the database.
 */
export async function auditDuplicates(): Promise<DuplicateAuditReport> {
  const duplicates: DuplicateAuditItem[] = [];
  let totalChecked = 0;

  try {
    // 1. Inspect campParticipants
    const campPartsSnap = await getDocs(collection(db, "campParticipants"));
    totalChecked += campPartsSnap.size;

    const seenCpKeys = new Map<string, string>(); // key -> primary document ID

    for (const docSnap of campPartsSnap.docs) {
      const data = docSnap.data();
      const memberId = data.memberId || "";
      const campId = data.campId || "";
      const campName = data.campName || "";
      const key = `${memberId}_${campId || campName.toLowerCase().trim()}`;

      if (seenCpKeys.has(key)) {
        duplicates.push({
          id: docSnap.id,
          collection: "campParticipants",
          key,
          titleOrDetail: `Camp: ${campName || campId} (Member: ${memberId})`,
          memberId,
          isPrimary: false,
        });
      } else {
        seenCpKeys.set(key, docSnap.id);
      }
    }

    // 2. Inspect achievements
    const achsSnap = await getDocs(collection(db, "achievements"));
    totalChecked += achsSnap.size;

    const seenAchKeys = new Map<string, string>();

    for (const docSnap of achsSnap.docs) {
      const data = docSnap.data();
      const memberId = data.memberId || data.recipientId || data.cadetId || "";
      const title = (data.title || "").toLowerCase().trim();
      const key = `${memberId}_${title}`;

      if (seenAchKeys.has(key)) {
        duplicates.push({
          id: docSnap.id,
          collection: "achievements",
          key,
          titleOrDetail: `Achievement: "${data.title}" (Member: ${memberId})`,
          memberId,
          isPrimary: false,
        });
      } else {
        seenAchKeys.set(key, docSnap.id);
      }
    }

    return {
      totalChecked,
      duplicateCount: duplicates.length,
      duplicates,
    };
  } catch (err: any) {
    console.error("[Maintenance] Error during duplicate audit:", err);
    throw new Error(`Duplicate audit failed: ${err.message || err}`);
  }
}

/**
 * SAFE CONTROLLED DUPLICATE RESOLUTION
 *
 * Instead of hard-deleting duplicate documents with deleteDoc(), this function:
 * 1. Backs up the record into the 'trash' collection (Soft Delete Engine).
 * 2. Logs an audit trail in 'auditLogs'.
 * 3. Can be completely restored at any time via the Recycle Bin CMS.
 *
 * It NEVER permanently wipes or drops data.
 */
export async function archiveDuplicateRecord(
  collectionName: "campParticipants" | "achievements",
  recordId: string,
  recordData: any,
  title: string,
  userEmail: string,
  userId: string
): Promise<string> {
  console.log(`[Maintenance] Controlled archive of duplicate [${collectionName}/${recordId}]`);
  return softDeleteRecord(
    collectionName,
    recordId,
    `[Duplicate Archive] ${title}`,
    recordData,
    userEmail,
    userId
  );
}
