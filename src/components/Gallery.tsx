import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ImageIcon, Grid, Tag, Calendar, Info, X, Tent } from "lucide-react";
import { subscribeToCollection } from "../firebaseService";

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  description: string;
  createdAt?: string;
  eventId?: string;
  campId?: string;
}

const DEFAULT_GALLERY_PHOTOS: GalleryItem[] = [
  {
    id: "gal_1",
    title: "Annual Victory Day Parade 2025",
    category: "Parade",
    imageUrl: "",
    description: "UGC BNCC Contingent marching at the National Parade Ground under Ramna Regiment command.",
    createdAt: "2025-12-16"
  },
  {
    id: "gal_2",
    title: "Winter Regiment Training Camp",
    category: "Camp",
    imageUrl: "",
    description: "Cadets participating in tactical field maneuvers and night navigation exercises during central camp.",
    createdAt: "2025-01-20"
  },
  {
    id: "gal_3",
    title: "Voluntary Blood Donation Drive",
    category: "Social Activity",
    imageUrl: "",
    description: "Platoon cadets organized a voluntary blood donation drive collecting 120+ units for emergency hospital supplies.",
    createdAt: "2025-11-20"
  },
  {
    id: "gal_4",
    title: "Infantry Drill & Arms Training",
    category: "Drill",
    imageUrl: "",
    description: "Cadets undergoing rigorous weapon handling SOP and synchronized squad drill at campus grounds.",
    createdAt: "2025-09-10"
  },
  {
    id: "gal_5",
    title: "Leadership & First Aid Workshop",
    category: "Training",
    imageUrl: "",
    description: "Emergency disaster rescue, CPR certification, and battlefield first aid training conducted by Battalion medical officers.",
    createdAt: "2025-05-18"
  },
  {
    id: "gal_6",
    title: "National Independence Day Ceremony",
    category: "National Events",
    imageUrl: "",
    description: "Color Guard squad presenting ceremonial arms and national flag salute at college premises.",
    createdAt: "2025-03-26"
  }
];

export default function Gallery() {
  const [photos, setPhotos] = React.useState<GalleryItem[]>(DEFAULT_GALLERY_PHOTOS);
  const [events, setEvents] = React.useState<any[]>([]);
  const [camps, setCamps] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<string>("All");
  const [lightboxPhoto, setLightboxPhoto] = React.useState<GalleryItem | null>(null);

  React.useEffect(() => {
    const unsub = subscribeToCollection<GalleryItem>("gallery", (data) => {
      if (data && data.length > 0) {
        setPhotos(data);
      }
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

  const displayPhotos = photos.length > 0 ? photos : DEFAULT_GALLERY_PHOTOS;

  // Standard categories based on possible DB values
  const categories = ["All", "Drill", "Parade", "Camp", "Social Activity", "Training", "National Events"];

  const filteredPhotos = activeFilter === "All"
    ? displayPhotos
    : displayPhotos.filter((p) => p.category.toLowerCase() === activeFilter.toLowerCase());

  return (
    <div className="space-y-8" id="media-gallery-section">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center space-x-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border border-amber-500/20">
          <ImageIcon className="h-3.5 w-3.5" />
          <span>PLATOON COMMAND ARCHIVES</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-display font-black text-army-950 dark:text-white uppercase tracking-tight">
          MEDIA GALLERY
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-light leading-relaxed">
          Explore photographic logs of national drills, winter regiment camps, social aid drives, and leadership training programs since 2018.
        </p>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap justify-center gap-2 max-w-3xl mx-auto border-b border-slate-150 dark:border-slate-800 pb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-mono font-semibold tracking-wide border transition-all cursor-pointer ${
              (cat === "All" && activeFilter === "All") || (cat.toLowerCase() === activeFilter.toLowerCase())
                ? "bg-amber-500 text-slate-950 border-amber-500 font-bold shadow-md hover:bg-amber-600"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-500/40 hover:text-amber-500"
            }`}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm space-y-4 animate-pulse flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-850"></div>
              <div className="p-5 flex-grow space-y-3">
                <div className="space-y-2">
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3.5">
                  <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-3.5 w-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl mx-auto shadow-sm">
          <ImageIcon className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300 font-display font-bold text-sm uppercase">No Records Encountered</p>
          <p className="text-slate-400 text-xs mt-1.5 font-light">No photo logs match the selected category filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPhotos.map((photo) => (
            <motion.div
              layout
              key={photo.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-lg transition-all group flex flex-col justify-between"
            >
              <div
                className="relative aspect-[4/3] bg-army-950/40 dark:bg-slate-800 overflow-hidden cursor-pointer border-b border-slate-100 dark:border-slate-800 flex items-center justify-center"
                onClick={() => setLightboxPhoto(photo)}
              >
                {photo.imageUrl && !photo.imageUrl.includes("unsplash") ? (
                  <img
                    src={photo.imageUrl}
                    alt={photo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-amber-500/60">
                    <ImageIcon className="h-12 w-12 mb-2 text-amber-500/40" />
                    <span className="font-mono text-[10px] text-army-300 uppercase tracking-widest font-semibold">
                      UGC BNCC Archive
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-white text-[10px] font-mono uppercase bg-amber-500/90 text-slate-950 px-2.5 py-1 rounded font-bold">
                    View Fullscreen
                  </span>
                </div>
                <span className="absolute top-3 left-3 bg-slate-950/80 text-white border border-white/10 font-mono text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-wider">
                  {photo.category}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <h3 className="font-display font-black text-slate-900 dark:text-white text-sm uppercase leading-snug tracking-wide group-hover:text-amber-500 transition-colors">
                    {photo.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed font-light line-clamp-3">
                    {photo.description || "Official photograph representing platoon exercises and ceremonial achievements."}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-3.5 font-mono">
                  <div className="flex items-center space-x-1">
                    <Tag className="h-3 w-3 text-amber-500/80" />
                    <span className="uppercase font-semibold text-slate-500 dark:text-slate-400">{photo.category}</span>
                  </div>
                  <button
                    onClick={() => setLightboxPhoto(photo)}
                    className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-bold"
                  >
                    DETAILS »
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Lightbox / Details Modal */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setLightboxPhoto(null)}
          >
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-6 right-6 p-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col md:flex-row"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="md:w-3/5 bg-army-950 flex flex-col items-center justify-center relative aspect-video md:aspect-auto min-h-[300px]">
                {lightboxPhoto.imageUrl && !lightboxPhoto.imageUrl.includes("unsplash") ? (
                  <img
                    src={lightboxPhoto.imageUrl}
                    alt={lightboxPhoto.title}
                    className="w-full h-full object-contain max-h-[80vh]"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-amber-500/70">
                    <ImageIcon className="h-16 w-16 mb-3 text-amber-500/50" />
                    <span className="font-mono text-xs text-army-300 uppercase tracking-widest font-bold">
                      UGC BNCC Archive Frame
                    </span>
                  </div>
                )}
              </div>

              <div className="md:w-2/5 p-6 md:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                    <span className="bg-amber-500 text-slate-950 font-mono text-[9px] px-2.5 py-0.5 rounded font-black uppercase tracking-wider">
                      {lightboxPhoto.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>OFFICIAL ARCHIVE</span>
                    </span>
                  </div>

                  <h3 className="text-xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {lightboxPhoto.title}
                  </h3>

                  <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed font-light whitespace-pre-wrap">
                    {lightboxPhoto.description || "Official photograph logging the accomplishments of the Bangladesh National Cadet Corps Cadet Platoon of Uttara Government College."}
                  </p>

                  {lightboxPhoto.eventId && (() => {
                    const linkedEvent = events.find((e) => e.id === lightboxPhoto.eventId);
                    if (!linkedEvent) return null;
                    return (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-3 rounded-xl text-[10.5px] font-mono mt-3">
                        <span className="font-bold uppercase tracking-wider block mb-0.5 text-xs">Linked Platoon Event</span>
                        <div className="font-sans font-semibold text-slate-700 dark:text-slate-200">{linkedEvent.name}</div>
                        <div className="text-[9.5px] text-slate-400 mt-1">Date: {linkedEvent.date} | Venue: {linkedEvent.venue}</div>
                      </div>
                    );
                  })()}

                  {lightboxPhoto.campId && (() => {
                    const linkedCamp = camps.find((c) => c.id === lightboxPhoto.campId);
                    if (!linkedCamp) return null;
                    return (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 p-3 rounded-xl text-[10.5px] font-mono mt-3">
                        <span className="font-bold uppercase tracking-wider block mb-0.5 text-xs flex items-center space-x-1">
                          <Tent className="h-3.5 w-3.5" />
                          <span>Linked BNCC Camp</span>
                        </span>
                        <div className="font-sans font-semibold text-slate-700 dark:text-slate-200">{linkedCamp.name}</div>
                        <div className="text-[9.5px] text-slate-400 mt-1">
                          Location: {linkedCamp.location || "Central Grounds"} | Date/Year: {linkedCamp.startDate || linkedCamp.year || "N/A"}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-150 dark:border-slate-800 flex items-start space-x-2 text-[10.5px]">
                  <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-slate-500 leading-normal font-sans">
                    These media items are registered within the command archives for educational and historical ledger reference purposes.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
