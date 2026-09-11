import { subscribeToCollection, createDocument, updateDocument, deleteDocument, getSingleDocument } from "../firebaseService";
import { GalleryItem } from "../types";

export const galleryService = {
  getGalleryItem: async (id: string): Promise<GalleryItem | null> => {
    return (await getSingleDocument("gallery", id)) as GalleryItem | null;
  },

  createGalleryItem: async (data: Partial<GalleryItem>, id?: string): Promise<string> => {
    return createDocument("gallery", data, id);
  },

  updateGalleryItem: async (id: string, data: Partial<GalleryItem>): Promise<void> => {
    return updateDocument("gallery", id, data);
  },

  deleteGalleryItem: async (id: string): Promise<void> => {
    return deleteDocument("gallery", id);
  },

  subscribeToGallery: (callback: (galleryItems: GalleryItem[]) => void) => {
    return subscribeToCollection<GalleryItem>("gallery", callback);
  }
};
