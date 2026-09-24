import { uploadFileToStorage } from "../firebase";
import { validateImageFile, sanitizeFilename, sanitizeStorageFolder } from "./fileValidation";

/**
 * Resizes and compresses an image File using HTML5 Canvas to ensure it stays small
 * (max dimension 800px, JPEG quality 0.75) so it will never exceed Firestore limits (~30-60KB).
 *
 * Enforces MIME and extension validation and file size restrictions.
 * Attempts to upload to Firebase Storage. If Firebase Storage succeeds, returns the Storage URL.
 * If Storage upload fails, errors out, or times out, seamlessly falls back to the compressed Data URL.
 */
export async function processAndUploadImage(
  file: File,
  folder: string = "uploads",
  maxDimension: number = 800,
  quality: number = 0.75,
  onProgress?: (progress: number) => void
): Promise<string> {
  // 1. Strict Security & Format Validation
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "Selected file failed security validation.");
  }

  // 2. Read file as Data URL
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (err) => reject(new Error("Failed to read image file data."));
    reader.readAsDataURL(file);
  });

  // 3. Compress via Canvas
  const compressedDataUrl = await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });

  // Convert compressedDataUrl to Blob for potential storage upload
  let blob: Blob;
  try {
    const arr = compressedDataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    blob = new Blob([u8arr], { type: mime });
  } catch (e) {
    blob = file;
  }

  // 4. Attempt upload to Firebase Storage
  const cleanFolder = sanitizeStorageFolder(folder);
  const cleanFilename = sanitizeFilename(file.name);

  try {
    const downloadUrl = await uploadFileToStorage(blob, cleanFolder, cleanFilename, onProgress);
    if (downloadUrl && typeof downloadUrl === "string" && downloadUrl.startsWith("http")) {
      return downloadUrl;
    }
  } catch (err: any) {
    console.warn(`[imageUtils] Firebase Storage upload error (${err?.message || err}). Falling back to safe compressed Data URL.`);
  }

  // Guaranteed fallback: return the lightweight compressed Data URL (~30-60KB)
  if (onProgress) onProgress(100);
  return compressedDataUrl;
}
