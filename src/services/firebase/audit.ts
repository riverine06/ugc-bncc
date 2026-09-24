import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { AuditLog } from "../../types";
import { generateId, subscribeToCollection } from "./firestore";

/**
 * Records an immutable action into the activityLogs collection
 */
export async function logActivity(
  userId: string,
  userEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  details: string
): Promise<void> {
  const logId = generateId("log");
  try {
    const logItem: AuditLog = {
      id: logId,
      userId: userId || "guest",
      userEmail: userEmail || "guest@ugcbncc.org",
      action,
      targetType,
      targetId,
      timestamp: new Date().toISOString(),
      details
    };
    await setDoc(doc(db, "activityLogs", logId), logItem);
  } catch (error) {
    console.error("[AuditService] Failed to record audit trail log:", error);
  }
}

/**
 * Subscribes in real-time to the audit logs trail
 */
export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void): () => void {
  return subscribeToCollection<AuditLog>("activityLogs", callback);
}
