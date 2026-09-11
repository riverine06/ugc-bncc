import { subscribeToCollection, createDocument, updateDocument, deleteDocument, getSingleDocument } from "../firebaseService";
import { PlatoonEvent } from "../types";

export const eventsService = {
  getEvent: async (id: string): Promise<PlatoonEvent | null> => {
    return (await getSingleDocument("events", id)) as PlatoonEvent | null;
  },

  createEvent: async (data: Partial<PlatoonEvent>, id?: string): Promise<string> => {
    return createDocument("events", data, id);
  },

  updateEvent: async (id: string, data: Partial<PlatoonEvent>): Promise<void> => {
    return updateDocument("events", id, data);
  },

  deleteEvent: async (id: string): Promise<void> => {
    return deleteDocument("events", id);
  },

  subscribeToEvents: (callback: (events: PlatoonEvent[]) => void) => {
    return subscribeToCollection<PlatoonEvent>("events", callback);
  }
};
