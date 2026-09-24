import { Member } from "../../types";
import {
  createDocument,
  updateDocument,
  deleteDocument,
  getSingleDocument,
  subscribeToCollection
} from "./firestore";

export async function getCadet(id: string): Promise<Member | null> {
  return (await getSingleDocument("cadets", id)) as Member | null;
}

export async function createCadet(data: Partial<Member>, id?: string): Promise<string> {
  return createDocument("cadets", data, id);
}

export async function updateCadet(id: string, data: Partial<Member>): Promise<void> {
  return updateDocument("cadets", id, data);
}

export async function deleteCadet(id: string): Promise<void> {
  return deleteDocument("cadets", id);
}

export function subscribeToCadets(callback: (cadets: Member[]) => void): () => void {
  return subscribeToCollection<Member>("cadets", callback);
}

export const membersService = {
  getCadet,
  createCadet,
  updateCadet,
  deleteCadet,
  subscribeToCadets
};
