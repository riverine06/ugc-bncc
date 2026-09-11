import { createDocument, updateDocument, deleteDocument, subscribeToCollection, getSingleDocument } from "../firebaseService";
import { Member } from "../types";

export const cadetsService = {
  getCadet: async (id: string): Promise<Member | null> => {
    return (await getSingleDocument("cadets", id)) as Member | null;
  },

  createCadet: async (data: Partial<Member>, id?: string): Promise<string> => {
    return createDocument("cadets", data, id);
  },

  updateCadet: async (id: string, data: Partial<Member>): Promise<void> => {
    return updateDocument("cadets", id, data);
  },

  deleteCadet: async (id: string): Promise<void> => {
    return deleteDocument("cadets", id);
  },

  subscribeToCadets: (callback: (cadets: Member[]) => void) => {
    return subscribeToCollection<Member>("cadets", callback);
  }
};
