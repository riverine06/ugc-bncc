import React from "react";
import { 
  Plus, FileText, Trash2, ShieldAlert, Edit, Upload, Loader2, CheckCircle2, 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Copy, X, AlertTriangle, Check, Download 
} from "lucide-react";
import { uploadFileToStorage, deleteFileFromStorage, auth } from "../../firebase";
import { validateDocumentFile } from "../../utils/fileValidation";
import { subscribeToCollection, createDocument, updateDocument, softDeleteRecord, generateId } from "../../firebaseService";
import { documentsService } from "../../services/documents";

interface DocumentVaultCMSProps {
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

export default function DocumentVaultCMS({ onRefresh }: DocumentVaultCMSProps) {
  const [docs, setDocs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<any | null>(null);
  const [docUploading, setDocUploading] = React.useState(false);
  const [docProgress, setDocProgress] = React.useState<number | null>(null);

  // Filters, search, pagination, sorting, selections
  const [searchTerm, setSearchTerm] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("All");
  const [sortBy, setSortBy] = React.useState<"uploadedAt" | "title">("uploadedAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Toasts & Confirmation Dialogue
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  // Form State
  const [form, setForm] = React.useState({
    title: "",
    category: "Manual",
    description: "",
    fileSize: "1.2 MB",
    downloadUrl: "#",
    isInternal: false,
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
    const unsubscribe = subscribeToCollection<any>("documents", (items) => {
      setDocs(items);
      setSelectedIds([]);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleStartEdit = (doc: any) => {
    setEditingDoc(doc);
    setForm({
      title: doc.title,
      category: doc.category || "Manual",
      description: doc.description || "",
      fileSize: doc.fileSize || "1.2 MB",
      downloadUrl: doc.fileUrl || doc.downloadUrl || "#",
      isInternal: !!doc.isInternal || doc.category === "Internal",
    });
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingDoc(null);
    setForm({
      title: "",
      category: "Manual",
      description: "",
      fileSize: "1.2 MB",
      downloadUrl: "#",
      isInternal: false,
    });
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) {
      showToast("Please provide at least a document title.", "error");
      return;
    }

    try {
      if (editingDoc) {
        await updateDocument("documents", editingDoc.id, {
          title: form.title,
          category: form.category,
          description: form.description,
          fileSize: form.fileSize,
          fileUrl: form.downloadUrl,
          downloadUrl: form.downloadUrl,
          isInternal: !!form.isInternal,
        });
        showToast(`Document "${form.title}" updated successfully!`, "success");
      } else {
        const id = "doc-" + generateId();
        await createDocument("documents", {
          id,
          title: form.title,
          category: form.category,
          description: form.description,
          fileSize: form.fileSize,
          fileUrl: form.downloadUrl,
          downloadUrl: form.downloadUrl,
          uploadedAt: new Date().toISOString(),
          fileType: "pdf",
          downloadCount: 0,
          isInternal: !!form.isInternal,
        }, id);
        showToast(`Document "${form.title}" registered & published!`, "success");
      }

      handleCancelEdit();
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      showToast(`Save failed: ${err.message || err}`, "error");
    }
  };

  const handleDocumentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict validation
    const validation = validateDocumentFile(file, 25 * 1024 * 1024);
    if (!validation.valid) {
      showToast(validation.error || "Please select a valid document under 25MB.", "error");
      if (e.target) e.target.value = "";
      return;
    }

    setDocUploading(true);
    setDocProgress(0);

    const sizeInMB = file.size / (1024 * 1024);
    const sizeInKB = file.size / 1024;
    const sizeStr = sizeInMB >= 1 
      ? `${sizeInMB.toFixed(1)} MB` 
      : sizeInKB >= 1
      ? `${sizeInKB.toFixed(0)} KB`
      : `${file.size} B`;

    try {
      if (form.downloadUrl && form.downloadUrl.includes("firebasestorage.googleapis.com")) {
        await deleteFileFromStorage(form.downloadUrl).catch((err) => {
          console.warn("Could not delete old document from storage:", err);
        });
      }

      // If document is classified as Internal/Restricted, upload to protected admin_documents path
      const targetFolder = form.isInternal || form.category === "Internal" ? "admin_documents" : "documents";
      let downloadUrl = "";

      try {
        downloadUrl = await uploadFileToStorage(file, targetFolder, validation.cleanFilename, (p) => {
          setDocProgress(p);
        });
      } catch (storageErr: any) {
        console.warn("Firebase Storage upload failed or timed out, using fallback encoding:", storageErr);
        setDocProgress(50);
        downloadUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            setDocProgress(100);
            resolve(reader.result as string);
          };
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(file);
        });
      }

      const autoTitle = form.title || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

      setForm((prev) => ({
        ...prev,
        downloadUrl,
        fileSize: sizeStr,
        title: autoTitle,
      }));
      showToast(`Document "${file.name}" uploaded successfully! (${sizeStr}) [Path: ${targetFolder}]`, "success");
    } catch (err: any) {
      showToast(`File upload failed: ${err.message || err}`, "error");
    } finally {
      setDocUploading(false);
      setDocProgress(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleDelete = (id: string, title: string) => {
    setConfirmDialog({
      title: "Archive Official Document",
      message: `Are you sure you want to revoke and archive document "${title}"? This moves it to the Recycle Bin.`,
      onConfirm: async () => {
        try {
          const docToDelete = docs.find((d) => d.id === id);
          const userEmail = auth.currentUser?.email || "admin@ugcbncc.org";
          const userId = auth.currentUser?.uid || "admin";

          await softDeleteRecord(
            "documents",
            id,
            title,
            docToDelete,
            userEmail,
            userId
          );
          
          showToast(`Document "${title}" archived to Recycle Bin.`, "success");
          setSelectedIds((prev) => prev.filter((item) => item !== id));
          onRefresh();
        } catch (err: any) {
          showToast(`Archiving failed: ${err.message || err}`, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleDuplicate = async (doc: any) => {
    try {
      const id = "doc-" + generateId();
      const duplicatedData = {
        ...doc,
        id,
        title: `${doc.title} (Duplicate)`,
        uploadedAt: new Date().toISOString(),
        downloadCount: 0,
      };
      await createDocument("documents", duplicatedData, id);
      showToast(`Duplicated document listing "${doc.title}"`, "success");
      onRefresh();
    } catch (err: any) {
      showToast(`Duplication failed: ${err.message}`, "error");
    }
  };

  const handleBulkArchive = () => {
    if (selectedIds.length === 0) return;
    setConfirmDialog({
      title: "Bulk Archive Documents",
      message: `Are you sure you want to archive the ${selectedIds.length} selected documents to the Recycle Bin?`,
      onConfirm: async () => {
        try {
          let count = 0;
          const userEmail = auth.currentUser?.email || "admin@ugcbncc.org";
          const userId = auth.currentUser?.uid || "admin";

          for (const id of selectedIds) {
            const docToDelete = docs.find((d) => d.id === id);
            if (docToDelete) {
              await softDeleteRecord(
                "documents",
                id,
                docToDelete.title || "Untitled Document",
                docToDelete,
                userEmail,
                userId
              );
              count++;
            }
          }
          showToast(`Successfully archived ${count} documents`, "success");
          setSelectedIds([]);
          onRefresh();
        } catch (err: any) {
          showToast(`Bulk archiving failed: ${err.message}`, "error");
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Filter & Search
  const filteredDocs = docs.filter((doc) => {
    const s = searchTerm.toLowerCase();
    const title = (doc.title || "").toLowerCase();
    const desc = (doc.description || "").toLowerCase();
    const cat = (doc.category || "").toLowerCase();
    const matchesSearch = title.includes(s) || desc.includes(s) || cat.includes(s) || doc.id.includes(s);

    if (!matchesSearch) return false;

    if (categoryFilter !== "All" && doc.category !== categoryFilter) {
      return false;
    }

    return true;
  });

  // Sort
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    let comp = 0;
    if (sortBy === "title") {
      comp = (a.title || "").localeCompare(b.title || "");
    } else {
      const dateA = a.uploadedAt || a.date || "";
      const dateB = b.uploadedAt || b.date || "";
      comp = dateA.localeCompare(dateB);
    }
    return sortOrder === "asc" ? comp : -comp;
  });

  // Pagination
  const totalItems = sortedDocs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDocs = sortedDocs.slice(startIndex, startIndex + itemsPerPage);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, sortBy, sortOrder]);

  const handleToggleSelectAll = () => {
    const pageIds = paginatedDocs.map((item) => item.id);
    const allSelectedOnPage = pageIds.every((id) => selectedIds.includes(id));
    if (allSelectedOnPage) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  return (
    <div id="document-vault-panel" className="space-y-6 text-xs relative">
      {/* Toast Alert popup notifications */}
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

      {/* Custom Confirmation Dialog Overlay */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-500">
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
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer"
              >
                CONFIRM ARCHIVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center space-x-2">
            <FileText className="h-4 w-4 text-red-500 animate-pulse" />
            <span>Digital Document Vault CMS</span>
          </h3>
          <p className="text-slate-400 text-[10px] mt-0.5 uppercase font-mono">
            Administer circulars, parade schedules, syllabus guidelines, enlistment pamphlets, and control download links.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end font-mono">
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkArchive}
              className="bg-red-600 hover:bg-red-700 text-white font-mono font-bold uppercase px-3 py-2 rounded text-[9px] flex items-center space-x-1 cursor-pointer transition-all"
            >
              <Trash2 className="h-3 w-3" />
              <span>Bulk Archive ({selectedIds.length})</span>
            </button>
          )}
          <button
            onClick={() => {
              if (showForm) {
                handleCancelEdit();
              }
              setShowForm(!showForm);
            }}
            className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-extrabold uppercase px-4 py-2 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer text-[10px]"
          >
            <Plus className="h-4 w-4" />
            <span>{showForm ? "Hide Form" : "PUBLISH OFFICIAL DOCUMENT"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Document cards list */}
        <div className={`space-y-4 ${showForm ? "lg:col-span-2" : "lg:col-span-3"}`}>
          
          {/* Internal Search / Sorting card controls */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vault documents by title, description or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 rounded text-[11px] focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Filtering */}
              <div className="flex items-center space-x-1.5 shrink-0 font-mono text-[10px] w-full sm:w-auto">
                <span className="text-slate-400 uppercase text-[9px] shrink-0">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-850 p-1.5 rounded font-semibold w-full sm:w-auto text-[10px]"
                >
                  <option value="All">All Categories</option>
                  <option value="Manual">SOP Training Manual</option>
                  <option value="Statute">Parliament Statute</option>
                  <option value="Notice">Regiment Circular</option>
                  <option value="Form">Admission Forms / PDF</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-850 pt-2.5">
              {/* Sorting */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-slate-400 uppercase text-[9px]">Sort by:</span>
                <button
                  onClick={() => {
                    if (sortBy === "uploadedAt") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("uploadedAt");
                      setSortOrder("desc");
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "uploadedAt" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Publish Date</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
                <button
                  onClick={() => {
                    if (sortBy === "title") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("title");
                      setSortOrder("asc");
                    }
                  }}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border flex items-center space-x-1 ${
                    sortBy === "title" 
                      ? "border-amber-500 text-amber-500 bg-amber-500/5" 
                      : "border-slate-200 dark:border-slate-800 text-slate-500"
                  }`}
                >
                  <span>Document Title</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </div>

              <div className="text-[9px] font-mono text-slate-400 uppercase">
                Displaying {sortedDocs.length} of {docs.length} published dockets
              </div>
            </div>
          </div>

          {/* Select all header */}
          {paginatedDocs.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-850 flex items-center justify-between font-mono text-[9px]">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paginatedDocs.every((item) => selectedIds.includes(item.id))}
                  onChange={handleToggleSelectAll}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer mt-0.5"
                />
                <span className="text-slate-600 dark:text-slate-300 font-bold uppercase">SELECT ALL DOCUMENTS ON THIS PAGE</span>
              </label>
              <span className="text-slate-400">PAGE {currentPage} OF {totalPages}</span>
            </div>
          )}

          {/* List group */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-20 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : paginatedDocs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-slate-400 font-mono text-xs">
              NO VAULT CIRCULARS OR SOP MANUALS FOUND matching current SELECTION criteria.
            </div>
          ) : (
            paginatedDocs.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  className={`bg-white dark:bg-slate-900 rounded-xl border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:shadow-md ${
                    isSelected 
                      ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/10" 
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    <div className="flex items-center space-x-2 mt-1 shrink-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(doc.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-red-700 dark:text-red-400 shrink-0">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-display font-bold text-slate-900 dark:text-white text-xs break-words">
                        {doc.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 break-words">
                        Category: <span className="text-amber-500 uppercase font-bold">{doc.category}</span> | Size: {doc.fileSize} | Published: {doc.uploadedAt ? doc.uploadedAt.split("T")[0] : doc.date || ""}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans mt-1.5 leading-relaxed break-words">
                        {doc.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t border-slate-100 dark:border-slate-800 sm:border-t-0 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        const targetUrl = doc.fileUrl || doc.downloadUrl;
                        if (targetUrl && (targetUrl.startsWith("http") || targetUrl.startsWith("data:") || targetUrl.startsWith("blob:"))) {
                          if (targetUrl.startsWith("data:") || targetUrl.startsWith("blob:")) {
                            const link = document.createElement("a");
                            link.href = targetUrl;
                            link.download = `${doc.title.toLowerCase().replace(/\s+/g, "_")}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } else {
                            window.open(targetUrl, "_blank", "noopener,noreferrer");
                          }
                          showToast(`Downloading "${doc.title}"...`, "info");
                        } else {
                          showToast(`No file attached for "${doc.title}". Please upload a document file or specify a valid link.`, "error");
                        }
                      }}
                      className="text-slate-400 hover:text-emerald-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Download / View document file"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDuplicate(doc)}
                      className="text-slate-400 hover:text-blue-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Duplicate Document details"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(doc)}
                      className="text-slate-400 hover:text-amber-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Edit document details"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id, doc.title)}
                      className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      title="Archive document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Pagination bar */}
          {totalPages > 1 && (
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center shadow-sm">
              <span className="text-[10px] font-mono text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 disabled:opacity-40 cursor-pointer text-slate-600 dark:text-slate-400"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Document Publish Form */}
        {showForm && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4 h-fit">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
              <h4 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                {editingDoc ? "UPDATE DOCUMENT" : "PUBLISH DOCUMENT"}
              </h4>
              <button
                onClick={handleCancelEdit}
                className="text-red-500 hover:text-red-650 font-mono text-[9px] font-bold uppercase cursor-pointer"
              >
                [Cancel]
              </button>
            </div>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Victory Day Drill Parade Schedule"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Document Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm({
                        ...form,
                        category: val,
                        isInternal: val === "Internal" ? true : form.isInternal
                      });
                    }}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2 w-full text-slate-700 dark:text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Manual">SOP Training Manual</option>
                    <option value="Statute">Parliament Statute</option>
                    <option value="Notice">Regiment Circular</option>
                    <option value="Form">Admission Forms / PDF</option>
                    <option value="Internal">Internal Administrative / Confidential</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9px]">Estimated Size</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 2.3 MB"
                    value={form.fileSize}
                    onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px] flex items-center justify-between">
                  <span>Access Classification (Security)</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded font-mono ${form.isInternal ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                    {form.isInternal ? "RESTRICTED / INTERNAL ONLY" : "PUBLIC CADET VAULT"}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isInternal: false })}
                    className={`py-1.5 px-2 rounded border text-left flex items-center space-x-1.5 cursor-pointer transition-all ${
                      !form.isInternal
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 font-bold"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>🌐 Public Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isInternal: true })}
                    className={`py-1.5 px-2 rounded border text-left flex items-center space-x-1.5 cursor-pointer transition-all ${
                      form.isInternal
                        ? "border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-800 dark:text-red-300 font-bold"
                        : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>🔒 Restricted / Internal</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Upload Document (Firebase Storage)</label>
                <div className="flex items-center space-x-2">
                  <label className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[10px] font-mono text-slate-600 dark:text-slate-350">
                    {docUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                        <span>Uploading: {docProgress}%</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 text-slate-400" />
                        <span>Select Document file (PDF, DOC, etc.)</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                      onChange={handleDocumentFileUpload}
                      className="hidden"
                      disabled={docUploading}
                    />
                  </label>
                  {form.downloadUrl && form.downloadUrl !== "#" && (
                    <span className="p-2 bg-emerald-50 dark:bg-emerald-955/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded flex items-center space-x-1 shrink-0 text-[10px] font-mono font-bold" title="File link assigned">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Attached</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">PDF Download URL Link</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., /docs/parade.pdf"
                  value={form.downloadUrl}
                  onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 uppercase text-[9px]">Brief Description</label>
                <textarea
                  required
                  placeholder="Provide context on statutory rights or marching parameters contained inside..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-16 resize-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-mono font-black uppercase py-2.5 rounded text-[10px] tracking-wider transition-all cursor-pointer"
              >
                {editingDoc ? "SAVE CHANGES" : "PUBLISH DOCUMENT"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
