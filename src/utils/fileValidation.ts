/**
 * @license
 * UGC BNCC Platoon - Firebase Storage & Media Security Validator
 * Enforces strict MIME validation, extension whitelisting, file size limits,
 * filename sanitization, and path-traversal prevention.
 */

// Permitted image MIME types (Strictly NO image/svg+xml or text/html to prevent script execution)
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif"
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif"
] as const;

// Permitted document MIME types
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain"
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt"
] as const;

// Prohibited dangerous extensions that must always be blocked
export const DANGEROUS_EXTENSIONS = [
  "exe", "bat", "cmd", "sh", "bash", "php", "php3", "phtml", "js", "ts", "jsx", "tsx",
  "html", "htm", "xhtml", "svg", "jar", "apk", "py", "pyw", "rb", "pl", "cgi",
  "vbs", "ps1", "scr", "msi", "dll", "com", "bin", "asp", "aspx", "jsp"
];

// Maximum file size limits
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_GALLERY_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface ValidationResult {
  valid: boolean;
  error?: string;
  cleanFilename?: string;
}

/**
 * Extracts and cleans the file extension in lower-case without leading dot.
 */
export function getFileExtension(filename: string): string {
  if (!filename) return "";
  const parts = filename.trim().split(".");
  if (parts.length <= 1) return "";
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Sanitizes a filename:
 * - Strips directory traversal (e.g. "../", "..\\")
 * - Removes control and special characters
 * - Normalizes to alphanumeric, hyphen, underscore, and dots
 * - Prepends timestamp for uniqueness and prevents collision
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return `file_${Date.now()}`;
  
  // Strip any leading/trailing directory paths
  const baseName = filename.replace(/^.*[\\\/]/, "");
  
  // Replace dangerous and whitespace characters with an underscore
  const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  
  // Ensure the filename is not excessively long
  const truncated = safeName.slice(-100);
  
  return `${Date.now()}_${truncated}`;
}

/**
 * Sanitizes and validates the target storage folder against an approved whitelist.
 */
export function sanitizeStorageFolder(folder: string): string {
  const allowedFolders = [
    "cadets",
    "gallery",
    "images",
    "documents",
    "admin_documents",
    "applications",
    "avatars",
    "uploads"
  ];
  
  const clean = folder.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (allowedFolders.includes(clean)) {
    return clean;
  }
  return "uploads";
}

/**
 * Validates an image file before upload.
 */
export function validateImageFile(
  file: File,
  maxSizeBytes: number = MAX_AVATAR_SIZE_BYTES
): ValidationResult {
  if (!file) {
    return { valid: false, error: "No file provided." };
  }

  // Check dangerous extensions first (including double extensions like .php.jpg)
  const lowerName = file.name.toLowerCase();
  for (const dangerous of DANGEROUS_EXTENSIONS) {
    if (lowerName.includes(`.${dangerous}.`) || lowerName.endsWith(`.${dangerous}`)) {
      return {
        valid: false,
        error: `Security Violation: File contains an unauthorized executable or script extension (.${dangerous}).`
      };
    }
  }

  // Validate extension
  const ext = getFileExtension(file.name);
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `Invalid file extension (.${ext || "unknown"}). Allowed formats: ${ALLOWED_IMAGE_EXTENSIONS.join(", ").toUpperCase()}.`
    };
  }

  // Validate MIME type
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mime as any)) {
    return {
      valid: false,
      error: `Invalid media format (${mime || "unspecified"}). Please upload a JPEG, PNG, WEBP, or GIF image.`
    };
  }

  // Validate file size
  if (file.size > maxSizeBytes) {
    const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    const actualMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size exceeds the allowable limit of ${maxMB} MB (selected file is ${actualMB} MB).`
    };
  }

  return {
    valid: true,
    cleanFilename: sanitizeFilename(file.name)
  };
}

/**
 * Validates a document file before upload.
 */
export function validateDocumentFile(
  file: File,
  maxSizeBytes: number = MAX_DOCUMENT_SIZE_BYTES
): ValidationResult {
  if (!file) {
    return { valid: false, error: "No document file provided." };
  }

  // Check dangerous extensions
  const lowerName = file.name.toLowerCase();
  for (const dangerous of DANGEROUS_EXTENSIONS) {
    if (lowerName.includes(`.${dangerous}.`) || lowerName.endsWith(`.${dangerous}`)) {
      return {
        valid: false,
        error: `Security Violation: File contains an unauthorized executable or script extension (.${dangerous}).`
      };
    }
  }

  // Validate extension
  const ext = getFileExtension(file.name);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext as any)) {
    return {
      valid: false,
      error: `Unsupported document format (.${ext || "unknown"}). Allowed formats: ${ALLOWED_DOCUMENT_EXTENSIONS.join(", ").toUpperCase()}.`
    };
  }

  // Validate MIME type (allow generic octet-stream only if extension is strongly verified, else check whitelist)
  const mime = (file.type || "").toLowerCase();
  if (mime && mime !== "application/octet-stream" && !ALLOWED_DOCUMENT_MIME_TYPES.includes(mime as any)) {
    return {
      valid: false,
      error: `Unsupported document MIME type (${mime}). Allowed types: PDF, Word, Excel, PowerPoint, Text.`
    };
  }

  // Validate file size
  if (file.size > maxSizeBytes) {
    const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    const actualMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Document size exceeds the allowable limit of ${maxMB} MB (selected file is ${actualMB} MB).`
    };
  }

  return {
    valid: true,
    cleanFilename: sanitizeFilename(file.name)
  };
}

/**
 * Humanizes Firebase Storage error codes into user-friendly messages.
 */
export function formatStorageErrorMessage(error: any): string {
  if (!error) return "Unknown storage error occurred.";
  const code = error.code || error.message || "";
  
  if (typeof code === "string") {
    if (code.includes("storage/unauthorized")) {
      return "Access Denied: You do not have permission to upload or delete this file in Firebase Storage.";
    }
    if (code.includes("storage/quota-exceeded")) {
      return "Storage Quota Exceeded: The platoon cloud storage quota has been reached. Please contact administration.";
    }
    if (code.includes("storage/retry-limit-exceeded") || code.includes("timeout")) {
      return "Connection Timeout: The file upload took too long or was interrupted by a network issue. Please check your connection and retry.";
    }
    if (code.includes("storage/canceled")) {
      return "Upload was canceled by the user.";
    }
    if (code.includes("storage/object-not-found")) {
      return "The requested file does not exist in storage.";
    }
  }

  return error.message || String(error);
}
