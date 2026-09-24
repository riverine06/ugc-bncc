import React from "react";
import { 
  Plus, Image as ImageIcon, Trash2, Edit, Search, ArrowUpDown, ChevronLeft, ChevronRight, 
  Copy, AlertTriangle, Loader2, X, Eye, UploadCloud, FolderKanban, Tent
} from "lucide-react";
import { subscribeToCollection, createDocument, updateDocument, softDeleteRecord, generateId } from "../../firebaseService";
import { auth, uploadFileToStorage } from "../../firebase";
import { validateImageFile } from "../../utils/fileValidation";

interface GalleryCMSProps {
  onRefresh: () => void;
}

interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ConfirmConfig {
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function GalleryCMS({ onRefresh }: GalleryCMSProps) {
  const [photos, setPhotos] = React.useState<any[]>([]);
  const [events, setEvents] = React.useState<any[]>([]);
  const [camps, setCamps] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingPhoto, setEditingPhoto] = React.useState<any | null>(null);

  // Search, Filters, Sorting, Selection, Pagination
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("All");
  const [sortBy, setSortBy] = React.useState<"title" | "category">("title");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(6);

  // Image Lightbox state
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = React.useState<string>("");

  // Toast & Confirm state
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  // Drag & drop highlight state & upload progress
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form State
  const [form, setForm] = React.useState({
    title: "",
    imageUrl: "",
    category: "Drill",
    description: "",
    eventId: "",
    campId: "",
  });

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  React.useEffect(() => {
    setLoading(true);
    const unsub = subscribeToCollection<any>("gallery", (data) => {
      setPhotos(data);
      setLoading(false);
    });
    const unsubEvents = subscribeToCollection<any>("events", (data) => {
      setEvents(data);
    });
    const unsubCamps = subscribeToCollection<any>("camps", (data) => {
      setCamps(data);
    });
    return () => {
      unsub();
      unsubEvents();
      unsubCamps();
    };
  }, []);

  const handleStartEdit = (photo: any) => {
    setEditingPhoto(photo);
    setForm({
      title: photo.title,
      imageUrl: photo.imageUrl,
      category: photo.category || "Drill",
      description: photo.description || "",
      eventId: photo.eventId || "",
      campId: photo.campId || "",
    });
    setShowForm(true);
    showToast(`Loaded photo "${photo.title}" for editing`, "info");
  };

  const handleCancelEdit = () => {
    setEditingPhoto(null);
    setForm({
      title: "",
      imageUrl: "",
      category: "Drill",
      description: "",
      eventId: "",
      campId: "",
    });
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.imageUrl) {
      showToast("Please provide at least a title and image URL link.", "error");
      return;
    }

    try {
      if (editingPhoto) {
        await updateDocument("gallery", editingPhoto.id, {
          ...form,
        });
        showToast("Gallery photo entry updated successfully!", "success");
      } else {
        const id = generateId("gal");
        await createDocument("gallery", {
          ...form,
          id,
        }, id);
        showToast("Gallery photo successfully registered!", "success");
      }
      handleCancelEdit();
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDuplicate = async (photo: any) => {
    try {
      const id = generateId("gal");
      const duplicateData = {
        ...photo,
        id,
        title: `${photo.title} (Copy)`,
      };
      await createDocument("gallery", duplicateData, id);
      showToast(`Duplicated "${photo.title}" successfully`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleDelete = (id: string, title: string) => {
    setConfirmDialog({
      title: "Soft Delete Photo Asset",
      message: `Are you sure you want to move photo "${title}" to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          const photoToDel = photos.find((p) => p.id === id);
          if (photoToDel) {
            await softDeleteRecord("gallery", id, title, photoToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
            showToast(`Moved "${title}" to Recycle Bin`, "success");
            setSelectedIds((prev) => prev.filter((item) => item !== id));
            onRefresh();
          }
        } catch (err: any) {
          showToast(err.message, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Soft Delete Gallery Assets",
      message: `Are you sure you want to move ${selectedIds.length} selected photos to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          let count = 0;
          for (const id of selectedIds) {
            const photoToDel = photos.find((p) => p.id === id);
            if (photoToDel) {
              await softDeleteRecord("gallery", id, photoToDel.title, photoToDel, auth.currentUser?.email || "admin@ugcbncc.org", auth.currentUser?.uid || "admin");
              count++;
            }
          }
          showToast(`Successfully moved ${count} photos to Recycle Bin`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(err.message, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  // Direct File Upload handling
  const processSelectedFile = async (file: File) => {
    const validation = validateImageFile(file, 15 * 1024 * 1024);
    if (!validation.valid) {
      showToast(validation.error || "Please select a valid image under 15MB.", "error");
      return;
    }

    setUploadProgress(15);
    try {
      const url = await uploadFileToStorage(file, "gallery", validation.cleanFilename, (p) => {
        setUploadProgress(Math.max(15, Math.round(p)));
      });
      setForm((prev) => ({ ...prev, imageUrl: url }));
      showToast(`Image "${file.name}" uploaded successfully to Cloud Storage!`, "success");
    } catch (err: any) {
      console.warn("Storage upload failed/timed out, fallback to FileReader Data URL:", err);
      setUploadProgress(60);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(file);
        });
        setForm((prev) => ({ ...prev, imageUrl: dataUrl }));
        showToast(`Image loaded locally (Storage note: ${err?.message || "fallback mode"})`, "info");
      } catch (readErr: any) {
        showToast(`Failed to process image: ${err?.message || "Unknown error"}`, "error");
      }
    } finally {
      setUploadProgress(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  // Drag & Drop Handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
      return;
    }

    // Check for dropped links or text
    const droppedUrl = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text");
    if (droppedUrl && droppedUrl.startsWith("http")) {
      setForm((prev) => ({ ...prev, imageUrl: droppedUrl }));
      showToast("Auto-populated Image URL from dropped source", "success");
    } else {
      showToast("Please drag & drop valid image files or web URLs", "info");
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Categories list matching Media Gallery
  const CATEGORIES = ["All", "Drill", "Parade", "Camp", "Social Activity", "Training", "National Events"];

  // Filtered Photos List
  const filteredPhotos = photos.filter((p) => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = 
      p.title.toLowerCase().includes(s) ||
      (p.description && p.description.toLowerCase().includes(s));
    
    if (!matchesSearch) return false;

    if (categoryFilter !== "All" && p.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    return true;
  });

  // Sorting
  const sortedPhotos = [...filteredPhotos].sort((a, b) => {
    let comp = 0;
    if (sortBy === "title") {
      comp = a.title.localeCompare(b.title);
    } else if (sortBy === "category") {
      comp = (a.category || "").localeCompare(b.category || "");
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Pagination Math
  const totalItems = sortedPhotos.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPhotos = sortedPhotos.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, sortBy, sortOrder]);

  const handleToggleSelectAll = () => {
    const pageIds = paginatedPhotos.map((p) => p.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  return (
    <div id="gallery-cms-panel" className="space-y-6 text-xs relative">
      {/* Toast notifications */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center space-x-2 px-4 py-3 rounded-lg shadow-lg text-white font-mono text-[11px] animate-slide-in-right ${
              toast.type === "success" 
                ? "bg-emerald-600 border border-emerald-500" 
                : toast.type === "error" 
                ? "bg-rose-600 border border-rose-500" 
                : "bg-slate-800 border border-slate-700"
            }`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))} 
              className="text-white/60 hover:text-white cursor-pointer ml-2"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Overlay */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-500">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="text-sm font-bold font-mono uppercase tracking-wider">{confirmDialog.title}</h4>
            </div>
            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2.5 pt-2 font-mono">
              <button
                onClick={() => setConfirmDialog(null)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 px-3.5 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Image Preview */}
      {lightboxUrl && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button 
            className="absolute top-5 right-5 text-white/70 hover:text-white bg-slate-800/40 hover:bg-slate-800/80 p-2.5 rounded-full cursor-pointer"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img 
            src={lightboxUrl} 
            alt="Fullscreen preview" 
            className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl border border-slate-800"
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="text-slate-300 font-sans font-semibold mt-4 text-center max-w-2xl bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-800">
            {lightboxTitle}
          </p>
        </div>
      )}

      {/* Top Header Controls Panel */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
            GALLERY ASSETS MANAGER
          </h3>
          <p className="text-slate-400 text-[10px] mt-0.5">
            Link and catalog official photos from campouts, drill operations, Victory Day parading, and civil actions.
          </p>
        </div>

        <button
          onClick={() => {
            handleCancelEdit();
            setShowForm(!showForm);
          }}
          className="w-full sm:w-auto bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-extrabold uppercase px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer text-[10px]"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? "Hide Register Form" : "REGISTER PHOTO ASSET"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main media assets panel */}
        <div className={`space-y-4 ${showForm ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {/* Filters controls bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by caption, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 rounded text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Filter Categories matched with Media Gallery */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-slate-400 uppercase text-[10px]">Category:</span>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase transition ${
                      categoryFilter === cat
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-850 pt-3">
              {/* Sort controls */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-slate-400 uppercase text-[10px]">Sort by:</span>
                <button
                  onClick={() => {
                    if (sortBy === "title") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("title");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "title" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Title</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "category") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("category");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "category" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Category</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </div>

              {/* Selection info and Bulk actions */}
              <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-500">
                <span>{filteredPhotos.length} photo logs matching</span>
                {selectedIds.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-amber-500 font-bold">({selectedIds.length} Checked)</span>
                    <button
                      onClick={handleBulkDelete}
                      className="bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-[9px] uppercase font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      <span>BULK TRASH</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Select Selection Indicator Bar */}
          {paginatedPhotos.length > 0 && (
            <div className="bg-slate-100/50 dark:bg-slate-900/40 p-2.5 px-4 rounded-lg flex items-center space-x-3 border border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                checked={paginatedPhotos.length > 0 && paginatedPhotos.every((p) => selectedIds.includes(p.id))}
                onChange={handleToggleSelectAll}
                className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
              />
              <span className="font-mono text-[9px] text-slate-500 uppercase font-semibold">Select All Visible On Page</span>
            </div>
          )}

          {/* Grid Layout list with image previews */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="bg-slate-100 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-3 animate-pulse">
                  <div className="aspect-video bg-slate-300 dark:bg-slate-800 rounded-lg"></div>
                  <div className="h-4 bg-slate-300 dark:bg-slate-800 rounded w-2/3"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : paginatedPhotos.length === 0 ? (
            <div className="py-16 text-center text-slate-400 italic font-mono border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              NO PHOTO MEDIA ASSETS INDEXED UNDER SPECIFIED CRITERIA.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {paginatedPhotos.map((photo) => {
                const isChecked = selectedIds.includes(photo.id);
                return (
                  <div
                    key={photo.id}
                    className={`bg-white dark:bg-slate-900 rounded-xl border p-3 shadow-sm flex flex-col justify-between group relative overflow-hidden transition-all ${
                      isChecked ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-150">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Image Preview Overlay Button */}
                      <button 
                        onClick={() => {
                          setLightboxUrl(photo.imageUrl);
                          setLightboxTitle(photo.title);
                        }}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white space-x-1.5 text-[10px] uppercase font-mono tracking-wider cursor-pointer font-bold"
                      >
                        <Eye className="h-4 w-4" />
                        <span>PREVIEW</span>
                      </button>

                      <div className="absolute top-2 left-2 flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(photo.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 shadow-sm bg-black/60 cursor-pointer"
                        />
                        <span className="bg-slate-950/70 text-amber-500 font-mono text-[9px] px-1.5 py-0.5 rounded uppercase font-bold backdrop-blur-xs">
                          {photo.category}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-display font-bold text-slate-900 dark:text-white text-[11px] leading-tight line-clamp-1">
                          {photo.title}
                        </h5>
                        <p className="text-[10px] text-slate-400 font-mono line-clamp-1">{photo.description || "No description"}</p>
                      </div>

                      <div className="flex items-center space-x-0.5 shrink-0">
                        <button
                          onClick={() => handleDuplicate(photo)}
                          className="text-slate-400 hover:text-blue-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Duplicate Asset"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleStartEdit(photo)}
                          className="text-slate-400 hover:text-amber-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit details"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(photo.id, photo.title)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Move to Recycle Bin"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between shadow-sm">
              <span className="text-[10px] font-mono text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Register/Edit Photo Form side-panel */}
        {showForm && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                {editingPhoto ? "UPDATE PHOTO ASSET" : "REGISTER PHOTO"}
              </h4>
              {editingPhoto && (
                <button
                  onClick={handleCancelEdit}
                  className="text-red-500 hover:text-red-600 font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  [Cancel Edit]
                </button>
              )}
            </div>

            {/* Direct File Upload & Drag-Drop Box */}
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileInputChange} 
              className="hidden" 
            />

            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-lg border-2 border-dashed font-sans text-center transition flex flex-col items-center justify-center space-y-2 cursor-pointer ${
                isDragActive 
                  ? "border-amber-500 bg-amber-500/10 text-amber-500" 
                  : "border-slate-200 dark:border-slate-800 hover:border-amber-500/50 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/50"
              }`}
            >
              <UploadCloud className="h-7 w-7 text-amber-500" />
              <div>
                <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px]">
                  Click to browse image or drag & drop file
                </span>
                <span className="text-[9.5px] text-slate-400 block mt-0.5">
                  Direct image upload (PNG, JPG, WEBP) or paste URL below
                </span>
              </div>
              {uploadProgress !== null && (
                <div className="w-full max-w-xs bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-2 transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                  <span className="text-[9px] font-mono text-amber-500 block mt-1">
                    Uploading: {uploadProgress}%
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Photo Caption / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Winter Campout 2024 Drill"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Image URL Link / Direct Asset</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[9px] font-mono font-bold text-amber-500 hover:underline cursor-pointer uppercase"
                  >
                    + Direct Upload
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g., https://example.com/photo.jpg or direct uploaded asset"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
                {form.imageUrl && (
                  <div className="mt-1.5 relative w-full h-24 rounded border border-slate-200 dark:border-slate-800 overflow-hidden bg-black/40 flex items-center justify-center">
                    <img src={form.imageUrl} alt="Thumbnail preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    <span className="absolute bottom-1 right-1 bg-black/80 text-amber-400 text-[8px] font-mono px-1 rounded">Asset Loaded</span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Media Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="Drill">Drill (Silent drill & choreography)</option>
                  <option value="Parade">Parade (Ceremonial Parades)</option>
                  <option value="Camp">Camp (National & Regiment Campouts)</option>
                  <option value="Social Activity">Social Activity (Blood donation & Social drives)</option>
                  <option value="Training">Training (Specialized Cadre & Field Workshops)</option>
                  <option value="National Events">National Events (Independence & Victory Day)</option>
                </select>
              </div>

              {/* Side by side Event and Camp linkage */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px] flex items-center space-x-1">
                    <FolderKanban className="h-3 w-3 text-amber-500" />
                    <span>Linked Platoon Event (Optional)</span>
                  </label>
                  <select
                    value={form.eventId}
                    onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- No linked event (Generic) --</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} ({ev.date})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px] flex items-center space-x-1">
                    <Tent className="h-3 w-3 text-emerald-500" />
                    <span>Linked Camp (Optional)</span>
                  </label>
                  <select
                    value={form.campId}
                    onChange={(e) => setForm({ ...form, campId: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- No linked camp (Generic) --</option>
                    {camps.map((camp) => (
                      <option key={camp.id} value={camp.id}>
                        {camp.name} ({camp.year || camp.startDate || camp.location || "Camp"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Brief Description</label>
                <textarea
                  placeholder="Summarize context of this photo asset..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 h-16 resize-none"
                />
              </div>

              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-black uppercase py-2 text-[10px] tracking-wider transition-all cursor-pointer rounded"
                >
                  {editingPhoto ? "SAVE CHANGES" : "REGISTER PHOTO"}
                </button>
                {editingPhoto && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-mono font-black uppercase px-3 py-2 text-[10px] tracking-wider transition-all cursor-pointer rounded"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

