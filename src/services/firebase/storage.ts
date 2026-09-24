import { uploadFileToStorage, deleteFileFromStorage } from "../../firebase";

export async function uploadFile(
  file: File | Blob,
  folder: string,
  filename?: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  return uploadFileToStorage(file, folder, filename, onProgress);
}

export async function deleteFile(url: string): Promise<void> {
  return deleteFileFromStorage(url);
}

export const storageService = {
  uploadFile,
  deleteFile,
  uploadFileToStorage,
  deleteFileFromStorage
};
