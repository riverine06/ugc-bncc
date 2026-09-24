import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../../firebase";
import { PlatoonDocument } from "../../types";
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  getSingleDocument
} from "./firestore";

export async function getDocument(id: string): Promise<PlatoonDocument | null> {
  return (await getSingleDocument("documents", id)) as PlatoonDocument | null;
}

export async function createDocumentRecord(
  data: Partial<PlatoonDocument>,
  id?: string
): Promise<string> {
  return createDocument("documents", data, id);
}

export async function updateDocumentRecord(
  id: string,
  data: Partial<PlatoonDocument>
): Promise<void> {
  return updateDocument("documents", id, data);
}

export async function deleteDocumentRecord(id: string): Promise<void> {
  return deleteDocument("documents", id);
}

export function subscribeToDocuments(
  callback: (documents: PlatoonDocument[]) => void
): () => void {
  return subscribeToCollection<PlatoonDocument>("documents", callback);
}

export async function incrementDocumentDownloadCount(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, "documents", id), {
      downloadCount: increment(1)
    });
  } catch (err) {
    console.warn("[DocumentsService] Failed to increment download count:", err);
  }
}

export const documentsService = {
  getDocument,
  createDocumentRecord,
  updateDocumentRecord,
  deleteDocumentRecord,
  subscribeToDocuments,
  incrementDownloadCount: incrementDocumentDownloadCount
};
