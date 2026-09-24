import { GalleryItem } from "../../types";
import {
  subscribeToCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  getSingleDocument
} from "./firestore";

export async function getGalleryItem(id: string): Promise<GalleryItem | null> {
  return (await getSingleDocument("gallery", id)) as GalleryItem | null;
}

export async function createGalleryItem(data: Partial<GalleryItem>, id?: string): Promise<string> {
  return createDocument("gallery", data, id);
}

export async function updateGalleryItem(id: string, data: Partial<GalleryItem>): Promise<void> {
  return updateDocument("gallery", id, data);
}

export async function deleteGalleryItem(id: string): Promise<void> {
  return deleteDocument("gallery", id);
}

export function subscribeToGallery(callback: (galleryItems: GalleryItem[]) => void): () => void {
  return subscribeToCollection<GalleryItem>("gallery", callback);
}

export const galleryService = {
  getGalleryItem,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  subscribeToGallery
};
