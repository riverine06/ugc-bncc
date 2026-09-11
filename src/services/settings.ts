import { getSingleDocument, setSingleDocument } from "../firebaseService";

export const settingsService = {
  getSettings: async (settingId: string): Promise<any | null> => {
    return getSingleDocument("settings", settingId);
  },

  updateSettings: async (settingId: string, data: any): Promise<void> => {
    return setSingleDocument("settings", settingId, data);
  }
};
