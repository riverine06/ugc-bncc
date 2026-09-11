import { subscribeToCollection, createDocument, updateDocument, deleteDocument, getSingleDocument } from "../firebaseService";
import { LeadershipReference } from "../types";

export const leadershipService = {
  getLeadershipReference: async (id: string): Promise<LeadershipReference | null> => {
    return (await getSingleDocument("leadership", id)) as LeadershipReference | null;
  },

  createLeadershipReference: async (data: Partial<LeadershipReference>, id?: string): Promise<string> => {
    return createDocument("leadership", data, id);
  },

  updateLeadershipReference: async (id: string, data: Partial<LeadershipReference>): Promise<void> => {
    return updateDocument("leadership", id, data);
  },

  deleteLeadershipReference: async (id: string): Promise<void> => {
    return deleteDocument("leadership", id);
  },

  subscribeToLeadership: (callback: (leadership: LeadershipReference[]) => void) => {
    return subscribeToCollection<LeadershipReference>("leadership", callback);
  }
};
