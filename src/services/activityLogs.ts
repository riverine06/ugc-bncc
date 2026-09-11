import { subscribeToCollection, logActivity } from "../firebaseService";
import { AuditLog } from "../types";

export const activityLogsService = {
  logOperation: async (
    userId: string,
    userEmail: string,
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ): Promise<void> => {
    return logActivity(userId, userEmail, action, targetType, targetId, details);
  },

  subscribeToLogs: (callback: (logs: AuditLog[]) => void) => {
    return subscribeToCollection<AuditLog>("activityLogs", callback);
  }
};
