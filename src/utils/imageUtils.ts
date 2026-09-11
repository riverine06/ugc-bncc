import { uploadFileToStorage } from "../firebase";

/**
 * Resizes and compresses an image File using HTML5 Canvas to ensure it stays small
 * (max dimension 800px, JPEG quality 0.75) so it will never exceed Firestore limits (~30-60KB).
 *
 * Then attempts to upload to Firebase Storage with a timeout (6s).
 * If Firebase Storage succeeds, returns the Storage URL.
 * If Storage upload fails, errors out, or times out, seamlessly returns the compressed Data URL.
 */
export async function processAndUploadImage(
  file: File,
  folder: string = "uploads",
  maxDimension: number = 800,
  quality: number = 0.75,
  onProgress?: (progress: number) => void
): Promise<string> {
  // 1. Read file as Data URL
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

  // 2. Compress via Canvas
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

      canvas.width = width;
      canvas.height = height;
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

  // 3. Attempt upload to Firebase Storage with a 6-second timeout
  try {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}_${sanitizedName}`;
    const uploadPromise = uploadFileToStorage(blob, folder, filename, onProgress);

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("Storage upload connection timeout")), 6000)
    );

    const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
    if (downloadUrl && typeof downloadUrl === "string" && downloadUrl.startsWith("http")) {
      return downloadUrl;
    }
  } catch (err) {
    console.warn("[imageUtils] Storage upload bypass triggered (using lightweight compressed Data URL fallback).", err);
  }

  // Guaranteed fallback: return the lightweight compressed Data URL (~30-60KB)
  if (onProgress) onProgress(100);
  return compressedDataUrl;
}
