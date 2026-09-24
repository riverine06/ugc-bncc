import { subscribeToCollection, createDocument, updateDocument, deleteDocument, getSingleDocument } from "../firebaseService";
import { db } from "../firebase";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";

export interface PlatoonDocument {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  uploadedAt: string;
  fileType: string;
  description: string;
  fileSize?: string;
  version?: string;
  downloadCount?: number;
}

export const documentsService = {
  getDocument: async (id: string): Promise<PlatoonDocument | null> => {
    return (await getSingleDocument("documents", id)) as PlatoonDocument | null;
  },

  createDocumentRecord: async (data: Partial<PlatoonDocument>, id?: string): Promise<string> => {
    return createDocument("documents", data, id);
  },

  updateDocumentRecord: async (id: string, data: Partial<PlatoonDocument>): Promise<void> => {
    return updateDocument("documents", id, data);
  },

  deleteDocumentRecord: async (id: string): Promise<void> => {
    return deleteDocument("documents", id);
  },

  subscribeToDocuments: (callback: (documents: PlatoonDocument[]) => void) => {
    return subscribeToCollection<PlatoonDocument>("documents", callback);
  },

  seedDefaultDocumentsIfEmpty: async () => {
    try {
      const { auth } = await import("../firebase");
      if (!auth.currentUser) {
        return;
      }
      const querySnap = await getDocs(collection(db, "documents"));
      if (querySnap.empty) {
        console.log("[DocumentsService] Seeding default documents...");
        const initialDocs: PlatoonDocument[] = [
          {
            id: "doc-1",
            title: "BNCC Cadet Training Manual 2025",
            description: "Official comprehensive training syllabus covering infantry drill maneuvers, physical readiness specifications, weapons training ethics, and cadet ranks.",
            category: "Manuals",
            fileSize: "14.2 MB",
            fileUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0233535895.firebasestorage.app/o/documents%2Fbncc_training_manual_2025.pdf?alt=media",
            uploadedAt: "2025-01-10T00:00:00.000Z",
            fileType: "pdf",
            version: "v3.2",
            downloadCount: 1420
          },
          {
            id: "doc-2",
            title: "UGC Platoon Drill Parade Code & Protocol",
            description: "Detailed Standard Operating Procedure (SOP) regarding parade squad coordinates, uniform inspection regulations, and general drill commands in Bengali/English.",
            category: "SOP",
            fileSize: "3.5 MB",
            fileUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0233535895.firebasestorage.app/o/documents%2Fugc_drill_parade_code.pdf?alt=media",
            uploadedAt: "2024-06-15T00:00:00.000Z",
            fileType: "pdf",
            version: "v1.8",
            downloadCount: 890
          },
          {
            id: "doc-3",
            title: "Annual Camp Enlistment & Clearance Form",
            description: "Mandatory enlistment application form, emergency health self-declaration checklist, and parent permission slip required for Ramna Regiment camps.",
            category: "Registration",
            fileSize: "840 KB",
            fileUrl: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0233535895.firebasestorage.app/o/documents%2Fcamp_enlistment_clearance.pdf?alt=media",
            uploadedAt: "2026-05-20T00:00:00.000Z",
            fileType: "pdf",
            version: "v2026.1",
            downloadCount: 420
          }
        ];
        for (const docItem of initialDocs) {
          await setDoc(doc(db, "documents", docItem.id), docItem);
        }
      }
    } catch (e) {
      console.warn("[DocumentsService] Failed to seed default documents:", e);
    }
  }
};
