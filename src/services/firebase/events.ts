import { PlatoonEvent } from "../../types";
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  getSingleDocument
} from "./firestore";

export async function getEvent(id: string): Promise<PlatoonEvent | null> {
  return (await getSingleDocument("events", id)) as PlatoonEvent | null;
}

export async function createEvent(data: Partial<PlatoonEvent>, id?: string): Promise<string> {
  return createDocument("events", data, id);
}

export async function updateEvent(id: string, data: Partial<PlatoonEvent>): Promise<void> {
  return updateDocument("events", id, data);
}

export async function deleteEvent(id: string): Promise<void> {
  return deleteDocument("events", id);
}

export function subscribeToEvents(callback: (events: PlatoonEvent[]) => void): () => void {
  return subscribeToCollection<PlatoonEvent>("events", callback);
}

export const eventsService = {
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  subscribeToEvents,
  subscribeToCamps: (callback: (camps: any[]) => void) => subscribeToCollection("camps", callback),
  subscribeToCampParticipants: (callback: (parts: any[]) => void) => subscribeToCollection("campParticipants", callback),
};
