import React from "react";
import { motion } from "motion/react";
import { FileText, Download, Search, Folder, BookOpen, Clock, ShieldAlert, Check, Loader2, RefreshCw } from "lucide-react";
import { logFirebaseEvent } from "../firebase";
import { subscribeToCollection } from "../firebaseService";
import { documentsService } from "../services/documents";

interface PlatoonDoc {
  id: string;
  title: string;
  description: string;
  category: string;
  fileSize: string;
  publishDate: string;
  version: string;
  downloadCount: number;
  url?: string;
}

const DEFAULT_DOCUMENTS: PlatoonDoc[] = [
  {
    id: "doc-1",
    title: "BNCC Cadet Training Manual 2025",
    description: "Official comprehensive training syllabus covering infantry drill maneuvers, physical readiness specifications, weapons training ethics, and cadet ranks.",
    category: "Manuals",
    fileSize: "14.2 MB",
    publishDate: "2025-01-10",
    version: "v3.2",
    downloadCount: 1420,
    url: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0233535895.firebasestorage.app/o/documents%2Fbncc_training_manual_2025.pdf?alt=media"
  },
  {
    id: "doc-2",
    title: "UGC Platoon Drill Parade Code & Protocol",
    description: "Detailed Standard Operating Procedure (SOP) regarding parade squad coordinates, uniform inspection regulations, and general drill commands in Bengali/English.",
    category: "SOP",
    fileSize: "3.5 MB",
    publishDate: "2024-06-15",
    version: "v1.8",
    downloadCount: 890,
    url: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0233535895.firebasestorage.app/o/documents%2Fugc_drill_parade_code.pdf?alt=media"
  },
  {
    id: "doc-3",
    title: "Annual Camp Enlistment & Clearance Form",
    description: "Mandatory enlistment application form, emergency health self-declaration checklist, and parent permission slip required for Ramna Regiment camps.",
    category: "Registration",
    fileSize: "840 KB",
    publishDate: "2026-05-20",
    version: "v2026.1",
    downloadCount: 420,
    url: "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0233535895.firebasestorage.app/o/documents%2Fcamp_enlistment_clearance.pdf?alt=media"
  },
  {
    id: "doc-4",
    title: "BNCC Rank Structure & Promotion Regulations",
    description: "Statutory guidelines governing merit requirements, attendance benchmarks, and examination criteria for promotions from Cadet to PUO.",
    category: "Statutes",
    fileSize: "2.1 MB",
    publishDate: "2024-11-01",
    version: "v2.0",
    downloadCount: 650
  }
];

export default function DocumentLibrary() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All");
  const [downloads, setDownloads] = React.useState<Record<string, number>>({});
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [docs, setDocs] = React.useState<PlatoonDoc[]>(DEFAULT_DOCUMENTS);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Seed default documents first if collection is empty
    const initAndSubscribe = async () => {
      try {
        await documentsService.seedDefaultDocumentsIfEmpty();
      } catch (err) {
        console.warn("Seeding documents error:", err);
      }

      // Subscribe to live updates from Firestore
      const unsubscribe = subscribeToCollection<any>("documents", (items) => {
        const mapped: PlatoonDoc[] = items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description || "",
          category: item.category || "Manuals",
          fileSize: item.fileSize || "1.5 MB",
          publishDate: item.uploadedAt ? item.uploadedAt.split("T")[0] : new Date().toISOString().split("T")[0],
          version: item.version || "v1.0",
          downloadCount: item.downloadCount || 0,
          url: item.fileUrl || ""
        }));
        setDocs(mapped.length > 0 ? mapped : DEFAULT_DOCUMENTS);
        setLoading(false);
      });

      return unsubscribe;
    };

    let unsub: (() => void) | undefined;
    initAndSubscribe().then((unsubFn) => {
      unsub = unsubFn;
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleDownload = (id: string, name: string, url?: string) => {
    setDownloadingId(id);
    setTimeout(() => {
      setDownloads((prev) => ({
        ...prev,
        [id]: (prev[id] || 0) + 1,
      }));
      setDocs((prevDocs) =>
        prevDocs.map((d) => (d.id === id ? { ...d, downloadCount: d.downloadCount + 1 } : d))
      );
      setDownloadingId(null);

      // Log download event to Firebase Analytics
      logFirebaseEvent("document_download", {
        document_id: id,
        document_title: name,
        category: docs.find(d => d.id === id)?.category || "General"
      });

      // Navigate to or trigger real download
      if (url && (url.startsWith("http") || url.startsWith("data:") || url.startsWith("blob:"))) {
        if (url.startsWith("data:") || url.startsWith("blob:")) {
          const link = document.createElement("a");
          link.href = url;
          link.download = `${name.toLowerCase().replace(/\s+/g, "_")}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } else {
        // Create an official document download file
        const textContent = `UGC BNCC Platoon Official Document\nTitle: ${name}\nCategory: ${docs.find(d => d.id === id)?.category || "General"}\nPublished: ${docs.find(d => d.id === id)?.publishDate || new Date().toISOString()}\nVersion: ${docs.find(d => d.id === id)?.version || "v1.0"}`;
        const blob = new Blob([textContent], { type: "application/pdf" });
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `${name.toLowerCase().replace(/\s+/g, "_")}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }
    }, 1200);
  };

  const filteredDocs = docs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="space-y-10">
        {/* Page Header Skeleton */}
        <div className="relative overflow-hidden bg-army-950 border-2 border-amber-500/30 text-white p-8 rounded-xl shadow-2xl animate-pulse">
          <div className="h-4 w-32 bg-slate-800 rounded mb-4"></div>
          <div className="h-8 w-64 bg-slate-800 rounded mb-2"></div>
          <div className="h-3 w-full bg-slate-800 rounded"></div>
        </div>

        {/* Categories list and Search Skeleton */}
        <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-full animate-pulse"></div>
            ))}
          </div>
          <div className="h-8 w-full md:w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        </div>

        {/* Documents Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-3.5 w-1/2 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
              <div className="h-10 bg-slate-100 dark:bg-slate-950 rounded"></div>
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="relative overflow-hidden bg-army-950 border-2 border-amber-500 text-white p-8 rounded-xl shadow-2xl">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 bg-army-900 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-widest">
            <Folder className="h-3 w-3 animate-pulse" />
            <span>Digital Document Vault</span>
          </div>
          <h2 className="text-3xl font-display font-extrabold tracking-tight uppercase">
            REGIMENTAL <span className="text-amber-400">DOCUMENT CABINET</span>
          </h2>
          <p className="text-xs text-army-200 font-sans max-w-2xl font-light">
            Access, read, and download official cadet training guides, standard operating procedures, parent clearance forms, and circular updates published by UGC BNCC Platoon Command.
          </p>
        </div>
      </div>

      {/* Categories list and Search */}
      <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between text-xs">
        <div className="flex flex-wrap gap-2">
          {["All", "Manuals", "Circulars", "SOP", "Registration"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full font-display font-medium tracking-wide border transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-army-900 text-white border-army-900 dark:bg-amber-500 dark:text-army-950 dark:border-amber-500"
                  : "bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-army-500"
              }`}
            >
              {cat === "SOP" ? "Standard Procedures (SOP)" : cat}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search manuals, circulars..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md py-1.5 pl-8 pr-3 text-xs w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500"
          />
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 font-mono">
            No official publications match this search.
          </div>
        ) : (
          filteredDocs.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all relative flex flex-col justify-between hover:border-amber-500/50"
            >
              <div className="space-y-3.5">
                {/* Header indicators */}
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                  <span className="flex items-center space-x-1 uppercase">
                    <BookOpen className="h-3 w-3 text-amber-500" />
                    <strong className="text-slate-700 dark:text-slate-300">{doc.category}</strong>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{doc.publishDate}</span>
                  </span>
                </div>

                {/* Title and details */}
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-slate-900 dark:text-white text-base leading-tight">
                    {doc.title}
                  </h3>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                    <span>VERSION: {doc.version}</span>
                    <span>•</span>
                    <span>SIZE: {doc.fileSize}</span>
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-sans font-light">
                  {doc.description}
                </p>
              </div>

              {/* Action and downloaded stats */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Downloaded {doc.downloadCount} times
                </span>
                <button
                  disabled={downloadingId === doc.id}
                  onClick={() => handleDownload(doc.id, doc.title, doc.url)}
                  className="bg-army-900 hover:bg-army-950 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700 text-white font-mono text-xs font-bold py-1.5 px-3.5 rounded flex items-center space-x-1 cursor-pointer"
                >
                  {downloadingId === doc.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>DOWNLOADING...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 text-amber-400" />
                      <span>DOWNLOAD PDF</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Regimental Document Security Advisory Banner */}
      <section className="bg-slate-900 text-white p-5 rounded-lg border border-red-500/30 flex items-start space-x-3 text-xs">
        <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-display font-bold uppercase tracking-wider text-red-400">
            REGIMENTAL ARCHIVE SECURITY NOTICE
          </h4>
          <p className="text-slate-300 leading-relaxed font-light">
            All downloadable publications provided above are intended strictly for educational and training purposes of Uttara Government College BNCC cadets. Unauthorized distribution of SOP guidelines or official platoon rosters outside military channels is strictly discouraged.
          </p>
        </div>
      </section>
    </div>
  );
}
