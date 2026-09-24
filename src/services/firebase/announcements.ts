import { Announcement } from "../../types";
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  getSingleDocument
} from "./firestore";

export async function getNotice(id: string): Promise<Announcement | null> {
  return (await getSingleDocument("notices", id)) as Announcement | null;
}

export async function createNotice(data: Partial<Announcement>, id?: string): Promise<string> {
  return createDocument("notices", data, id);
}

export async function updateNotice(id: string, data: Partial<Announcement>): Promise<void> {
  return updateDocument("notices", id, data);
}

export async function deleteNotice(id: string): Promise<void> {
  return deleteDocument("notices", id);
}

export function subscribeToNotices(callback: (notices: Announcement[]) => void): () => void {
  return subscribeToCollection<Announcement>("notices", callback);
}

export const announcementsService = {
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  subscribeToNotices
};
