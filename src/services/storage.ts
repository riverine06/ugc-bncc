import { uploadFileToStorage, deleteFileFromStorage } from "../firebase";

export const storageService = {
  uploadFile: async (
    file: File | Blob,
    folder: string,
    filename?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    return uploadFileToStorage(file, folder, filename, onProgress);
  },

  deleteFile: async (url: string): Promise<void> => {
    return deleteFileFromStorage(url);
  }
};
