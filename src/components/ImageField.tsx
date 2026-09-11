/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link, Upload, Eye, Image as ImageIcon, Loader2, CheckCircle2 } from "lucide-react";
import { deleteFileFromStorage } from "../firebase";
import { processAndUploadImage } from "../utils/imageUtils";

interface ImageFieldProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  id: string;
}

export default function ImageField({ value, onChange, label, placeholder, id }: ImageFieldProps) {
  const [mode, setMode] = React.useState<"url" | "upload">(
    value && value.startsWith("data:image/") ? "upload" : "url"
  );
  const [dragActive, setDragActive] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const processFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Invalid asset type. Please upload an image file (PNG, JPG, WEBP, etc.)");
      return;
    }
    
    // File size warning
    const warningSize = 5 * 1024 * 1024;
    if (file.size > warningSize) {
      alert("Selected image is large. System will automatically downsample and compress this asset.");
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Clean up old storage image if applicable
      if (value && value.includes("firebasestorage.googleapis.com")) {
        deleteFileFromStorage(value).catch((err) => {
          console.warn("Could not delete old image from storage:", err);
        });
      }

      const downloadUrl = await processAndUploadImage(file, "images", 800, 0.75, (progress) => {
        setUploadProgress(progress);
      });

      onChange(downloadUrl);
    } catch (uploadError: any) {
      console.error("Upload failed", uploadError);
      alert(`Image upload error: ${uploadError?.message || uploadError}`);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      processFile(files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-2 w-full" id={`${id}-wrapper`}>
      {label && (
        <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
          {label}
        </label>
      )}
      
      <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-lg w-fit border border-slate-200/50 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all ${
            mode === "url"
              ? "bg-white dark:bg-slate-900 text-amber-500 shadow-sm"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          id={`${id}-btn-url`}
          disabled={uploading}
        >
          <Link className="h-3 w-3" />
          <span>🔗 Image URL</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all ${
            mode === "upload"
              ? "bg-white dark:bg-slate-900 text-amber-500 shadow-sm"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
          id={`${id}-btn-upload`}
          disabled={uploading}
        >
          <Upload className="h-3 w-3" />
          <span>📤 Upload Image</span>
        </button>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1">
          {mode === "url" ? (
            <input
              type="text"
              id={id}
              value={value || ""}
              onChange={handleUrlChange}
              placeholder={placeholder || "https://example.com/photo.jpg"}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
            />
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-1 ${
                dragActive
                  ? "border-amber-500 bg-amber-50/20 dark:bg-amber-950/10"
                  : "border-slate-200 dark:border-slate-800 hover:border-amber-500/50 bg-slate-50 dark:bg-slate-950"
              } ${uploading ? "opacity-60 cursor-not-allowed" : ""}`}
              id={`${id}-drag-drop`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id={`${id}-file-input`}
                disabled={uploading}
              />
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
                  <p className="text-[10px] font-mono text-amber-500 uppercase font-bold">
                    UPLOADING TO STORAGE: {uploadProgress}%
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 text-slate-400" />
                  <p className="text-[10px] font-mono text-slate-500 uppercase font-medium">
                    {dragActive ? "Drop image here" : "Drag & drop image or Click to select"}
                  </p>
                  {value && value.startsWith("http") && value.includes("firebasestorage.googleapis.com") && (
                    <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5" /> SECURE STORAGE DEPLOYED
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {value && (
          <div className="relative group shrink-0 border border-slate-200 dark:border-slate-800 p-1 rounded-lg bg-white dark:bg-slate-900 shadow-sm">
            <img
              src={value}
              alt="Preview"
              className="w-12 h-12 object-cover rounded-md"
              onError={(e) => {
                // If invalid URL, hide preview element
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center pointer-events-none">
              <Eye className="h-3.5 w-3.5 text-white" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

