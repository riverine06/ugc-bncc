/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldAlert,
  Shield,
  Compass,
  Award,
  Calendar,
  Users,
  ChevronRight,
  TrendingUp,
  MapPin,
  Bell,
  Star,
  Quote,
  Trash,
  Plus,
  Loader2,
  X,
  Check,
  Image as ImageIcon,
  Edit,
  Globe,
  Settings,
  User as UserIcon,
  AlertTriangle,
} from "lucide-react";
import { Announcement, PlatoonEvent, Member, GalleryItem, User, UserRole, LeadershipReference, MemberStatus, BNCCRank } from "../types";
import ImageField from "./ImageField";
import RichTextEditor from "./RichTextEditor";
import SEO from "./SEO";
import { useDebounce } from "../utils/useDebounce";
import { PLATOON_ORGANIZATION_SCHEMA, WEBSITE_SCHEMA, generateEventSchema } from "../utils/seoSchemas";
import { getSingleDocument, setSingleDocument, softDeleteRecord, createDocument, generateId, subscribeToCollection } from "../firebaseService";

function parseMarkdown(text: string) {
  if (!text) return "";
  const html = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/### (.*?)\n/g, "<h3 class='text-sm font-bold text-amber-500 mt-2 mb-1'>$1</h3>")
    .replace(/\n- (.*?)/g, "<li class='ml-4 list-disc text-xs'>$1</li>")
    .replace(/\n> (.*?)/g, "<blockquote class='border-l-4 border-amber-500 pl-3 italic my-2'>$1</blockquote>")
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function AnimatedCounter({ value }: { value: number }) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }

    const duration = 1200; // 1.2s countdown duration
    const stepTime = 20; // 50fps
    const steps = duration / stepTime;
    const increment = Math.ceil(end / steps) || 1;
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{count}</span>;
}

interface HomeProps {
  stats: {
    totalMembers: number;
    activeCadets: number;
    alumni: number;
    events: number;
    camps: number;
    totalAwards: number;
  };
  notices: Announcement[];
  upcomingEvents: PlatoonEvent[];
  featuredAlumni: Member[];
  gallery: GalleryItem[];
  currentUser: User | null;
  onChangeTab: (tab: string) => void;
  onSelectMember: (id: string) => void;
  onRefreshData: () => void;
}

const Home = React.memo(function Home({
  stats,
  notices,
  upcomingEvents,
  featuredAlumni,
  gallery,
  currentUser,
  onChangeTab,
  onSelectMember,
  onRefreshData,
}: HomeProps) {
  // Homepage content state
  const [homepageData, setHomepageData] = React.useState<any>(null);
  const [editingHome, setEditingHome] = React.useState<boolean>(false);
  const [savingHome, setSavingHome] = React.useState<boolean>(false);
  const [homeError, setHomeError] = React.useState<string | null>(null);

  const DEFAULT_HERO_IMAGES: string[] = [];

  const sanitizeImage = (url: string | undefined | null): string => {
    if (!url || typeof url !== "string" || !url.trim()) return "";
    const lower = url.toLowerCase();
    if (
      lower.includes("unsplash.com") ||
      lower.includes("photo-1507003211169") ||
      lower.includes("photo-1506794778202") ||
      lower.includes("photo-1570295999919") ||
      lower.includes("photo-1535713875002") ||
      lower.includes("photo-1541532713592")
    ) {
      return "";
    }
    return url.trim();
  };

  const sanitizeImageList = (urls: any): string[] => {
    if (!Array.isArray(urls)) return [];
    return urls
      .filter((u) => typeof u === "string" && u.trim().length > 0)
      .map((u) => sanitizeImage(u))
      .filter((u) => u.length > 0);
  };

  // Editable fields
  const [heroTitle, setHeroTitle] = React.useState("");
  const [heroSubtitle, setHeroSubtitle] = React.useState("");
  const [heroBgUrl, setHeroBgUrl] = React.useState(DEFAULT_HERO_IMAGES[0]);
  const [mottoEnglish, setMottoEnglish] = React.useState("");
  const [mottoBengali, setMottoBengali] = React.useState("");
  const [establishedText, setEstablishedText] = React.useState("");
  const [paragraphDescription, setParagraphDescription] = React.useState("");
  const [buttonText1, setButtonText1] = React.useState("");
  const [buttonText2, setButtonText2] = React.useState("");

  // Commander message editable fields
  const [commanderName, setCommanderName] = React.useState("");
  const [commanderRank, setCommanderRank] = React.useState("");
  const [commanderPhoto, setCommanderPhoto] = React.useState("");
  const [commanderMessage, setCommanderMessage] = React.useState("");

  // Custom Stat Counter editable fields
  const [statsActiveCadets, setStatsActiveCadets] = React.useState<number>(36);
  const [statsAchievements, setStatsAchievements] = React.useState<number>(15);
  const [statsCampsAttended, setStatsCampsAttended] = React.useState<number>(12);
  const [statsBloodUnits, setStatsBloodUnits] = React.useState<number>(145);

  // Slideshow URLs
  const [heroSlideshowUrls, setHeroSlideshowUrls] = React.useState<string[]>(DEFAULT_HERO_IMAGES);

  // Gallery Quick Add states
  const [addingPhoto, setAddingPhoto] = React.useState<boolean>(false);
  const [photoTitle, setPhotoTitle] = React.useState<string>("");
  const [photoUrl, setPhotoUrl] = React.useState<string>("");
  const [photoCategory, setPhotoCategory] = React.useState<string>("Training");
  const [photoDesc, setPhotoDesc] = React.useState<string>("");
  const [submittingPhoto, setSubmittingPhoto] = React.useState<boolean>(false);
  const [galleryError, setGalleryError] = React.useState<string | null>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  const coreValues = [
    {
      title: "DISCIPLINE",
      desc: "Strict adherence to military order, command structure, and personal integrity.",
      color: "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400",
      icon: <ShieldAlert className="h-6 w-6 text-emerald-700 dark:text-emerald-500" />,
    },
    {
      title: "LEADERSHIP",
      desc: "Empowering young cadets to lead from the front in crisis and peace alike.",
      color: "border-amber-600 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400",
      icon: <TrendingUp className="h-6 w-6 text-amber-700 dark:text-amber-500" />,
    },
    {
      title: "PATRIOTISM",
      desc: "Unwavering commitment and love for the sovereignty and people of Bangladesh.",
      color: "border-red-600 bg-red-50/50 dark:bg-red-950/20 text-red-800 dark:text-red-400",
      icon: <Star className="h-6 w-6 text-red-700 dark:text-red-500" />,
    },
    {
      title: "SERVICE",
      desc: "Selfless voluntary contribution to the society during emergencies, camps and floods.",
      color: "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-400",
      icon: <Compass className="h-6 w-6 text-blue-700 dark:text-blue-500" />,
    },
  ];

  const fetchHomepage = async () => {
    try {
      const data = await getSingleDocument("homepage", "main");
      if (data) {
        setHomepageData(data);
        setHeroTitle(data.heroTitle || "UGC BNCC DIGITAL PLATOON");
        setHeroSubtitle(data.heroSubtitle || "★ BANGLADESH NATIONAL CADET CORPS ★");
        setHeroBgUrl(sanitizeImage(data.heroBgUrl));
        setMottoEnglish(data.mottoEnglish || "Knowledge • Discipline • Unity");
        setMottoBengali(data.mottoBengali || "জ্ঞান, শৃঙ্খলা, একতা");
        setEstablishedText(data.establishedText || "ESTD 2018");
        setParagraphDescription(data.paragraphDescription || "Official digital registry and command platform of Uttara Government College Platoon. Moulding young students into disciplined, patriotic, and highly competent future defense and civil leaders.");
        setButtonText1(data.buttonText1 || "Apply to Join Platoon");
        setButtonText2(data.buttonText2 || "View Cadet Profiles");
        setCommanderName(data.commanderName || "PUO Dr. Md. Aminul Islam");
        setCommanderRank(data.commanderRank || "Platoon Under Officer");
        setCommanderPhoto(sanitizeImage(data.commanderPhoto));
        setCommanderMessage(data.commanderMessage || "As the Platoon Commander of Uttara Government College BNCC Platoon, I welcome you to our digital command hub. Our mission is to build highly disciplined, patriotic, and competent future leaders. Through weekly drills, rescue camps, and voluntary campaigns, we instill a spirit of selfless service. Stand tall, march forward, and salute the nation.");
        setStatsActiveCadets(data.statsActiveCadets !== undefined ? Number(data.statsActiveCadets) : 36);
        setStatsAchievements(data.statsAchievements !== undefined ? Number(data.statsAchievements) : 15);
        setStatsCampsAttended(data.statsCampsAttended !== undefined ? Number(data.statsCampsAttended) : 12);
        setStatsBloodUnits(data.statsBloodUnits !== undefined ? Number(data.statsBloodUnits) : 145);
        setHeroSlideshowUrls(sanitizeImageList(data.heroSlideshowUrls));
      }
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    fetchHomepage();
  }, []);

  const effectiveHeroImages = React.useMemo(() => {
    const list: string[] = [];
    const bgClean = sanitizeImage(heroBgUrl);
    if (bgClean && !list.includes(bgClean)) {
      list.push(bgClean);
    }
    const slidesClean = sanitizeImageList(heroSlideshowUrls);
    slidesClean.forEach((url) => {
      if (url && !list.includes(url)) {
        list.push(url);
      }
    });
    return list;
  }, [heroBgUrl, heroSlideshowUrls]);

  const [slideshowIndex, setSlideshowIndex] = React.useState(0);

  React.useEffect(() => {
    if (effectiveHeroImages.length <= 1) return;
    const interval = setInterval(() => {
      setSlideshowIndex((prev) => (prev + 1) % effectiveHeroImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [effectiveHeroImages]);

  // Real-time homepage database subscription for live updates
  React.useEffect(() => {
    const unsub = subscribeToCollection<any>("homepage", (data) => {
      const mainHome = data.find((d: any) => d.id === "main");
      if (mainHome) {
        setHomepageData(mainHome);
        setHeroTitle(mainHome.heroTitle || "UGC BNCC DIGITAL PLATOON");
        setHeroSubtitle(mainHome.heroSubtitle || "★ BANGLADESH NATIONAL CADET CORPS ★");
        setHeroBgUrl(sanitizeImage(mainHome.heroBgUrl));
        setMottoEnglish(mainHome.mottoEnglish || "Knowledge • Discipline • Unity");
        setMottoBengali(mainHome.mottoBengali || "জ্ঞান, শৃঙ্খলা, একতা");
        setEstablishedText(mainHome.establishedText || "ESTD 2018");
        setParagraphDescription(mainHome.paragraphDescription || "Official digital registry and command platform of Uttara Government College Platoon.");
        setButtonText1(mainHome.buttonText1 || "Apply to Join Platoon");
        setButtonText2(mainHome.buttonText2 || "View Cadet Profiles");
        setCommanderName(mainHome.commanderName || "PUO Dr. Md. Aminul Islam");
        setCommanderRank(mainHome.commanderRank || "Platoon Under Officer");
        setCommanderPhoto(sanitizeImage(mainHome.commanderPhoto));
        setCommanderMessage(mainHome.commanderMessage || "As the Platoon Commander of Uttara Government College BNCC Platoon, I welcome you to our digital command hub.");
        setStatsActiveCadets(mainHome.statsActiveCadets !== undefined ? Number(mainHome.statsActiveCadets) : 36);
        setStatsAchievements(mainHome.statsAchievements !== undefined ? Number(mainHome.statsAchievements) : 15);
        setStatsCampsAttended(mainHome.statsCampsAttended !== undefined ? Number(mainHome.statsCampsAttended) : 12);
        setStatsBloodUnits(mainHome.statsBloodUnits !== undefined ? Number(mainHome.statsBloodUnits) : 145);
        setHeroSlideshowUrls(sanitizeImageList(mainHome.heroSlideshowUrls));
      }
    });
    return () => unsub();
  }, []);

  const handleSaveHomepage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHome(true);

    const payload = {
      heroTitle,
      heroSubtitle,
      heroBgUrl,
      mottoEnglish,
      mottoBengali,
      establishedText,
      paragraphDescription,
      buttonText1,
      buttonText2,
      commanderName,
      commanderRank,
      commanderPhoto,
      commanderMessage,
      statsActiveCadets: Number(statsActiveCadets || 0),
      statsAchievements: Number(statsAchievements || 0),
      statsCampsAttended: Number(statsCampsAttended || 0),
      statsBloodUnits: Number(statsBloodUnits || 0),
      heroSlideshowUrls,
    };

    try {
      await setSingleDocument("homepage", "main", payload);
      setHomepageData({ ...payload, id: "main" });
      setEditingHome(false);
      setHomeError(null);
    } catch (err: any) {
      setHomeError(err.message);
    } finally {
      setSavingHome(false);
    }
  };

  const handleAddPhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoTitle || !photoUrl) {
      setGalleryError("Title and image are required.");
      return;
    }

    setSubmittingPhoto(true);
    try {
      const id = generateId("gal");
      await createDocument("gallery", {
        id,
        title: photoTitle,
        imageUrl: photoUrl,
        category: photoCategory,
        description: photoDesc,
        date: new Date().toISOString().split("T")[0]
      }, id);
      setAddingPhoto(false);
      setPhotoTitle("");
      setPhotoUrl("");
      setPhotoDesc("");
      setGalleryError(null);
      onRefreshData();
    } catch (err: any) {
      setGalleryError(err.message);
    } finally {
      setSubmittingPhoto(false);
    }
  };

  const [deletePhotoDialog, setDeletePhotoDialog] = React.useState<{ id: string; title: string } | null>(null);
  const [deletingPhoto, setDeletingPhoto] = React.useState(false);

  const confirmDeletePhoto = async () => {
    if (!deletePhotoDialog || deletingPhoto) return;
    setDeletingPhoto(true);
    try {
      const itemToDel = gallery.find((g) => g.id === deletePhotoDialog.id);
      if (itemToDel) {
        await softDeleteRecord(
          "gallery",
          deletePhotoDialog.id,
          deletePhotoDialog.title,
          itemToDel,
          currentUser?.email || "admin@ugcbncc.org",
          currentUser?.id || "admin"
        );
        onRefreshData();
      }
      setDeletePhotoDialog(null);
      setGalleryError(null);
    } catch (err: any) {
      setGalleryError(err.message || "Failed to delete photo.");
    } finally {
      setDeletingPhoto(false);
    }
  };

  // Operations search & Live Leadership Sync
  const [globalSearch, setGlobalSearch] = React.useState("");
  const debouncedGlobalSearch = useDebounce(globalSearch, 200);
  const [isSearchOpen, setIsSearchOpen] = React.useState(true);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(-1);
  const searchContainerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<{ [key: number]: HTMLDivElement | null }>({});
  const [allMembers, setAllMembers] = React.useState<Member[]>([]);
  const [allEvents, setAllEvents] = React.useState<PlatoonEvent[]>([]);
  const [allLeadership, setAllLeadership] = React.useState<LeadershipReference[]>([]);

  React.useEffect(() => {
    const unsubMembers = subscribeToCollection<any>("cadets", (data) => {
      setAllMembers(data);
    });
    const unsubEvents = subscribeToCollection<any>("events", (data) => {
      setAllEvents(data);
    });
    const unsubLeadership = subscribeToCollection<any>("leadership", (data) => {
      setAllLeadership(data);
    });
    return () => {
      unsubMembers();
      unsubEvents();
      unsubLeadership();
    };
  }, []);

  // Dynamically resolve active Platoon Commander from leadership collection
  const activeCommanderInfo = React.useMemo(() => {
    if (!allLeadership || allLeadership.length === 0) return null;

    // Filter active leadership references
    const activeRefs = allLeadership.filter(
      (r) => !r.status || r.status.toLowerCase() === "active"
    );

    // Find reference matching platoon_commander, faculty, or position containing "commander"
    let pcRef = activeRefs.find(
      (r) =>
        r.roleType === "platoon_commander" ||
        (r.roleType as string) === "faculty" ||
        r.position?.toLowerCase().includes("platoon commander")
    );

    if (!pcRef) {
      pcRef = activeRefs.find((r) => r.position?.toLowerCase().includes("commander"));
    }

    if (!pcRef) return null;

    const memberId = pcRef.memberId || pcRef.cadetId;
    const member = allMembers.find((m) => m.id === memberId);

    if (!member) {
      return {
        name: pcRef.position || "Platoon Commander",
        rank: pcRef.position || "Platoon Commander",
        photo: "",
        bio: "",
      };
    }

    return {
      name: member.fullName,
      rank: pcRef.position || member.rank || "Platoon Commander",
      photo: member.photoUrl || "",
      bio: member.biography || "",
    };
  }, [allLeadership, allMembers]);

  // Click outside and keyboard navigation (Escape key) to handle search overlay
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGlobalSearch("");
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const results = React.useMemo(() => {
    if (!debouncedGlobalSearch.trim()) return null;
    const term = debouncedGlobalSearch.toLowerCase();

    const matchingMembers = allMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(term) ||
        m.id.toLowerCase().includes(term) ||
        m.rank.toLowerCase().includes(term) ||
        m.department.toLowerCase().includes(term) ||
        m.status.toLowerCase().includes(term)
    );

    const activeCadets = matchingMembers.filter(
      (m) => m.status !== MemberStatus.ALUMNI && m.status !== "Alumni"
    );
    const alumni = matchingMembers.filter(
      (m) => m.status === MemberStatus.ALUMNI || m.status === "Alumni"
    );

    return {
      activeCadets,
      alumni,
      total: matchingMembers.length,
    };
  }, [debouncedGlobalSearch, allMembers]);

  const flatResults = React.useMemo(() => {
    if (!results) return [];
    const list: Array<{
      member: Member;
      isAlumni: boolean;
      action: () => void;
    }> = [];

    results.activeCadets.forEach((m) => {
      list.push({
        member: m,
        isAlumni: false,
        action: () => {
          onSelectMember(m.id);
          setGlobalSearch("");
          setIsSearchOpen(false);
        },
      });
    });

    results.alumni.forEach((m) => {
      list.push({
        member: m,
        isAlumni: true,
        action: () => {
          onSelectMember(m.id);
          setGlobalSearch("");
          setIsSearchOpen(false);
        },
      });
    });

    return list;
  }, [results, onSelectMember]);

  React.useEffect(() => {
    setSelectedIndex(-1);
  }, [globalSearch]);

  React.useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!flatResults || flatResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsSearchOpen(true);
      setSelectedIndex((prev) => {
        if (prev < 0) return 0;
        return (prev + 1) % flatResults.length;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsSearchOpen(true);
      setSelectedIndex((prev) => {
        if (prev <= 0) return flatResults.length - 1;
        return prev - 1;
      });
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
        e.preventDefault();
        flatResults[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      setIsSearchOpen(false);
    }
  };

  return (
    <div className="space-y-16 pb-16" id="home-module">
      <SEO
        title="UGC BNCC Digital Platoon | Uttara Government College"
        description="Official digital presence, cadet record archive, recruitment portal, and event management platform of the Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College, established in 2018."
        canonicalPath="/"
        jsonLd={[
          PLATOON_ORGANIZATION_SCHEMA,
          WEBSITE_SCHEMA,
          ...(upcomingEvents && upcomingEvents.length > 0
            ? upcomingEvents.slice(0, 3).map((ev) => generateEventSchema(ev))
            : [])
        ]}
      />
      
      {/* Homepage CMS Admin Control Panel */}
      {isAdmin && (
        <div className="w-full mx-auto" id="homepage-cms-controls">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300/50 p-4 rounded-xl flex flex-col space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 uppercase">
                  Homepage CMS Panel
                </span>
              </div>
              <button
                onClick={() => setEditingHome(!editingHome)}
                className="inline-flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-army-950 font-mono text-xs font-bold px-4 py-1.5 rounded transition-all shadow-sm cursor-pointer"
              >
                {editingHome ? <X className="h-3.5 w-3.5" /> : <Settings className="h-3.5 w-3.5" />}
                <span>{editingHome ? "Exit Landing Editor" : "Customize Landing Page"}</span>
              </button>
            </div>

            {homeError && (
              <div className="border border-red-200 bg-red-50 text-red-700 font-mono text-xs p-3 rounded">
                CMS SAVE ERROR: {homeError}
              </div>
            )}

            {editingHome && (
              <form onSubmit={handleSaveHomepage} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono border-t pt-4 border-amber-300/30">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Hero Dynamic Heading</label>
                  <input
                    type="text"
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Hero Badge subtitle</label>
                  <input
                    type="text"
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <ImageField
                    id="hero-bg-field"
                    value={heroBgUrl}
                    onChange={(val) => setHeroBgUrl(val)}
                    label="Hero Container Background Banner (Options A & B supported)"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">English Motto</label>
                  <input
                    type="text"
                    value={mottoEnglish}
                    onChange={(e) => setMottoEnglish(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Bengali Motto text</label>
                  <input
                    type="text"
                    value={mottoBengali}
                    onChange={(e) => setMottoBengali(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Established badge text</label>
                  <input
                    type="text"
                    value={establishedText}
                    onChange={(e) => setEstablishedText(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Button 1 text</label>
                  <input
                    type="text"
                    value={buttonText1}
                    onChange={(e) => setButtonText1(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Button 2 text</label>
                  <input
                    type="text"
                    value={buttonText2}
                    onChange={(e) => setButtonText2(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-500 font-bold uppercase">Paragraph narrative Description (Markdown supported)</label>
                  <RichTextEditor
                    id="paragraph-desc"
                    value={paragraphDescription}
                    onChange={(val) => setParagraphDescription(val)}
                  />
                </div>

                {/* Slideshow image URLs */}
                <div className="border-t border-amber-300/30 pt-4 md:col-span-2 space-y-3">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Hero Banner Slideshow Image Assets (Up to 3 Slides)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <ImageField
                        id="slide-1"
                        value={heroSlideshowUrls[0] || ""}
                        onChange={(val) => {
                          const updated = [...heroSlideshowUrls];
                          updated[0] = val;
                          setHeroSlideshowUrls(updated);
                        }}
                        label="Slide 1 Photo URL"
                      />
                    </div>
                    <div className="space-y-1">
                      <ImageField
                        id="slide-2"
                        value={heroSlideshowUrls[1] || ""}
                        onChange={(val) => {
                          const updated = [...heroSlideshowUrls];
                          updated[1] = val;
                          setHeroSlideshowUrls(updated);
                        }}
                        label="Slide 2 Photo URL"
                      />
                    </div>
                    <div className="space-y-1">
                      <ImageField
                        id="slide-3"
                        value={heroSlideshowUrls[2] || ""}
                        onChange={(val) => {
                          const updated = [...heroSlideshowUrls];
                          updated[2] = val;
                          setHeroSlideshowUrls(updated);
                        }}
                        label="Slide 3 Photo URL"
                      />
                    </div>
                  </div>
                </div>

                {/* Commander's Corner CMS */}
                <div className="border-t border-amber-300/30 pt-4 md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Commander's Corner (Official Message Hub)</h4>
                  </div>

                  {activeCommanderInfo && (
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-lg text-xs">
                      <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 font-mono">
                        <Star className="h-4 w-4 shrink-0 text-amber-500" />
                        <span>Active Commander from Leadership Directory: <strong>{activeCommanderInfo.name}</strong> ({activeCommanderInfo.rank})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCommanderName(activeCommanderInfo.name);
                          setCommanderRank(activeCommanderInfo.rank);
                          if (activeCommanderInfo.photo) setCommanderPhoto(activeCommanderInfo.photo);
                          if (activeCommanderInfo.bio) setCommanderMessage(activeCommanderInfo.bio);
                        }}
                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded transition-colors"
                      >
                        Sync to Form
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold uppercase">Commander Name</label>
                      <input
                        type="text"
                        value={commanderName}
                        onChange={(e) => setCommanderName(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold uppercase">Commander Rank / Post</label>
                      <input
                        type="text"
                        value={commanderRank}
                        onChange={(e) => setCommanderRank(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <ImageField
                        id="commander-photo-field"
                        value={commanderPhoto}
                        onChange={(val) => setCommanderPhoto(val)}
                        label="Commander's Official Photo Asset"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-slate-500 font-bold uppercase">Commander's Official Message (Markdown supported)</label>
                      <RichTextEditor
                        id="commander-message"
                        value={commanderMessage}
                        onChange={(val) => setCommanderMessage(val)}
                      />
                    </div>
                  </div>
                </div>

                {/* Customizable statistics counters */}
                <div className="border-t border-amber-300/30 pt-4 md:col-span-2 space-y-4">
                  <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Customizable Statistical Counter Values</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold uppercase">Active Cadets Count</label>
                      <input
                        type="number"
                        value={statsActiveCadets}
                        onChange={(e) => setStatsActiveCadets(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold uppercase">Achievements Count</label>
                      <input
                        type="number"
                        value={statsAchievements}
                        onChange={(e) => setStatsAchievements(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold uppercase">Camps Count</label>
                      <input
                        type="number"
                        value={statsCampsAttended}
                        onChange={(e) => setStatsCampsAttended(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold uppercase">Blood Units Donated</label>
                      <input
                        type="number"
                        value={statsBloodUnits}
                        onChange={(e) => setStatsBloodUnits(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingHome}
                  className="md:col-span-2 bg-army-900 hover:bg-army-950 text-white font-bold py-2 rounded flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {savingHome ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span>COMMIT HOMEPAGE UPDATES</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 1. Dynamic Hero Section */}
      <section
        className="relative bg-army-950 text-white py-20 lg:py-24 px-4 sm:px-6 lg:px-8 overflow-visible border-b-8 border-amber-500 rounded-2xl shadow-xl mx-auto w-full min-h-[500px] flex items-center justify-center z-20"
        id="hero-section"
      >
        {/* Dynamic Slideshow Backgrounds with Fading Transitions */}
        <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
          {effectiveHeroImages.map((url, idx) => (
            <motion.div
              key={url + "-" + idx}
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.55), rgba(6, 10, 18, 0.75)), url(${url})`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: idx === (slideshowIndex % effectiveHeroImages.length) ? 1 : 0 }}
              transition={{ duration: 1.2 }}
            />
          ))}
        </div>
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] rounded-2xl overflow-hidden pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse rounded-2xl overflow-hidden pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-96 h-96 bg-army-600/15 rounded-full blur-3xl rounded-2xl overflow-hidden pointer-events-none"></div>

        {/* Tactical scanner lines */}
        <div className="absolute left-0 right-0 h-[2px] bg-amber-500/10 shadow-[0_0_8px_rgba(217,119,6,0.3)] animate-[bounce_6s_infinite] pointer-events-none"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6 w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 bg-army-900/80 border-2 border-amber-500/40 text-amber-400 px-4 py-1.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase shadow-lg"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping"></span>
            <span>{heroSubtitle}</span>
          </motion.div>

          <div className="space-y-3">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-3xl sm:text-5xl md:text-7xl font-display font-black tracking-tight uppercase leading-tight md:leading-none text-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]"
            >
              {heroTitle.includes("UGC BNCC") && heroTitle.includes("DIGITAL PLATOON") ? (
                <>
                  <span className="block text-white">UGC BNCC</span>
                  <span className="block text-amber-400 mt-1 sm:mt-2">DIGITAL PLATOON</span>
                </>
              ) : (
                heroTitle.split("\n").map((line, i) => (
                  <span key={i} className="block text-white">{line}</span>
                ))
              )}
            </motion.h1>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="font-display font-bold text-sm sm:text-base md:text-lg text-amber-400 dark:text-amber-300 tracking-wider text-center uppercase pt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
            >
              {mottoEnglish}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
            >
              <span className="text-amber-300/90 font-medium italic">
                "{mottoBengali}"
              </span>
              <span className="bg-army-900/90 border border-amber-500/40 text-amber-400 font-mono text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded shadow-sm uppercase tracking-wider">
                {establishedText}
              </span>
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-6 text-sm md:text-base text-white/95 max-w-2xl mx-auto font-sans font-normal leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]"
          >
            {parseMarkdown(paragraphDescription)}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.6 }}
            className="mt-8 flex flex-wrap justify-center gap-4"
          >
            <button
              onClick={() => onChangeTab("recruitment")}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-army-950 px-8 py-3.5 rounded-lg font-display font-bold text-sm shadow-lg hover:shadow-xl transition-all uppercase tracking-wider border-2 border-white/10 cursor-pointer text-center"
            >
              {buttonText1}
            </button>
            <button
              onClick={() => onChangeTab("directory")}
              className="w-full sm:w-auto bg-army-900/80 hover:bg-army-800 border-2 border-army-600 hover:border-amber-500/50 text-amber-400 px-8 py-3.5 rounded-lg font-display font-bold text-sm transition-all uppercase tracking-wider cursor-pointer text-center"
            >
              {buttonText2}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="max-w-xl mx-auto pt-6 text-xs w-full relative z-30"
          >
            <div className="relative" ref={searchContainerRef}>
              <input
                type="text"
                role="combobox"
                aria-expanded={isSearchOpen && globalSearch.trim().length > 0 && !!results}
                aria-controls="tactical-search-results"
                aria-activedescendant={selectedIndex >= 0 ? `search-item-${selectedIndex}` : undefined}
                aria-autocomplete="list"
                value={globalSearch}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setIsSearchOpen(true);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search by Cadet ID, Name or Rank..."
                className="w-full bg-army-900/90 border-2 border-amber-500/70 focus:border-amber-400 rounded-xl py-3 pl-10 pr-12 text-white placeholder-army-300 focus:outline-none font-mono text-center shadow-2xl transition-all"
              />
              <span className="absolute left-3.5 top-3.5 text-amber-400">🔍</span>
              {globalSearch && (
                <button
                  onClick={() => {
                    setGlobalSearch("");
                    setIsSearchOpen(false);
                  }}
                  className="absolute right-3.5 top-3.5 text-amber-400 hover:text-white uppercase font-mono font-bold text-[10px] cursor-pointer"
                >
                  [clear]
                </button>
              )}

              <AnimatePresence>
                {isSearchOpen && globalSearch.trim().length > 0 && results && (
                  <motion.div
                    id="tactical-search-results"
                    role="listbox"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute left-0 right-0 top-full mt-2 text-slate-100 border-2 border-amber-500 rounded-xl shadow-2xl p-4 text-left z-50 max-h-[350px] overflow-y-auto space-y-3.5 backdrop-blur-md"
                    style={{
                      top: "100%",
                      marginTop: "8px",
                      backgroundColor: "rgba(12, 22, 36, 0.88)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                    }}
                  >
                    <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest border-b border-slate-700/80 pb-1 flex justify-between items-center">
                      <span>TACTICAL PERSONNEL SEARCH</span>
                      <span className="text-amber-400 font-bold font-mono">
                        {results.total} MATCHES
                      </span>
                    </div>

                    {results.activeCadets.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-mono text-[10px] text-amber-400 font-bold uppercase flex items-center justify-between">
                          <span>[Active Cadets]</span>
                          <span className="text-[9px] text-slate-400">({results.activeCadets.length})</span>
                        </div>
                        {results.activeCadets.map((m, idx) => {
                          const flatIdx = idx;
                          const isHighlighted = selectedIndex === flatIdx;
                          return (
                            <div
                              key={m.id}
                              id={`search-item-${flatIdx}`}
                              role="option"
                              aria-selected={isHighlighted}
                              ref={(el) => {
                                itemRefs.current[flatIdx] = el;
                              }}
                              onMouseEnter={() => setSelectedIndex(flatIdx)}
                              onClick={() => {
                                onSelectMember(m.id);
                                setGlobalSearch("");
                                setIsSearchOpen(false);
                              }}
                              className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition-all ${
                                isHighlighted
                                  ? "bg-amber-500/20 text-amber-300 border-l-4 border-amber-400 pl-2.5 font-bold shadow-sm"
                                  : "hover:bg-slate-800/70 border-l-4 border-transparent text-slate-200"
                              }`}
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                {m.photoUrl ? (
                                  <img
                                    src={m.photoUrl}
                                    alt={m.fullName}
                                    className="w-8 h-8 rounded-full object-cover border border-amber-500/50 flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-army-800 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono text-xs font-bold flex-shrink-0">
                                    {m.fullName.charAt(0)}
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <strong className="text-xs uppercase truncate">{m.fullName}</strong>
                                    <span className="text-[10px] text-amber-400/90 font-mono flex-shrink-0">({m.rank})</span>
                                  </div>
                                  {!(m.rank === BNCCRank.PLATOON_UNDER_OFFICER || m.rank === "Platoon Under Officer (PUO)" || m.status === MemberStatus.PLATOON_OFFICER || m.status === MemberStatus.FORMER_PUO) ? (
                                    <span className="font-mono text-[9px] text-slate-400">ID: {m.id}</span>
                                  ) : (
                                    <span className="font-mono text-[9px] text-amber-400 font-bold uppercase">
                                      {m.status === MemberStatus.FORMER_PUO ? "Former PUO" : "Platoon Commander"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-mono text-[9px] bg-army-800/80 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded font-bold uppercase ml-2 flex-shrink-0">
                                {m.rank === BNCCRank.PLATOON_UNDER_OFFICER || m.status === MemberStatus.PLATOON_OFFICER ? "Faculty PUO" : "Active Cadet"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {results.alumni.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="font-mono text-[10px] text-amber-400 font-bold uppercase flex items-center justify-between">
                          <span>[Alumni]</span>
                          <span className="text-[9px] text-slate-400">({results.alumni.length})</span>
                        </div>
                        {results.alumni.map((m, idx) => {
                          const flatIdx = results.activeCadets.length + idx;
                          const isHighlighted = selectedIndex === flatIdx;
                          return (
                            <div
                              key={m.id}
                              id={`search-item-${flatIdx}`}
                              role="option"
                              aria-selected={isHighlighted}
                              ref={(el) => {
                                itemRefs.current[flatIdx] = el;
                              }}
                              onMouseEnter={() => setSelectedIndex(flatIdx)}
                              onClick={() => {
                                onSelectMember(m.id);
                                setGlobalSearch("");
                                setIsSearchOpen(false);
                              }}
                              className={`p-2 rounded-lg cursor-pointer flex justify-between items-center transition-all ${
                                isHighlighted
                                  ? "bg-amber-500/20 text-amber-300 border-l-4 border-amber-400 pl-2.5 font-bold shadow-sm"
                                  : "hover:bg-slate-800/70 border-l-4 border-transparent text-slate-200"
                              }`}
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                {m.photoUrl ? (
                                  <img
                                    src={m.photoUrl}
                                    alt={m.fullName}
                                    className="w-8 h-8 rounded-full object-cover border border-slate-600 flex-shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-300 font-mono text-xs font-bold flex-shrink-0">
                                    {m.fullName.charAt(0)}
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center space-x-1.5 truncate">
                                    <strong className="text-xs uppercase truncate">{m.fullName}</strong>
                                    <span className="text-[10px] text-slate-300/80 font-mono flex-shrink-0">({m.rank})</span>
                                  </div>
                                  {!(m.rank === BNCCRank.PLATOON_UNDER_OFFICER || m.rank === "Platoon Under Officer (PUO)" || m.status === MemberStatus.PLATOON_OFFICER || m.status === MemberStatus.FORMER_PUO) ? (
                                    <span className="font-mono text-[9px] text-slate-400">ID: {m.id}</span>
                                  ) : (
                                    <span className="font-mono text-[9px] text-amber-400 font-bold uppercase">Former PUO</span>
                                  )}
                                  {(m.currentProfession || m.currentOrganization) && (
                                    <span className="text-[9px] text-amber-300 truncate max-w-[200px]">
                                      {m.currentProfession} {m.currentOrganization ? `@ ${m.currentOrganization}` : ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="font-mono text-[9px] bg-slate-800 text-slate-300 border border-slate-600 px-2 py-0.5 rounded font-bold uppercase ml-2 flex-shrink-0">
                                Alumni
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {results.total === 0 && (
                      <div className="text-center py-4 text-slate-400 font-mono uppercase text-xs">
                        No personnel records match your query.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. Platoon Statistics Ledger */}
      <section className="w-full mx-auto">
        <div className="bg-army-900 border-2 border-amber-500 text-white rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-army-950 px-6 py-3 border-b border-army-800 flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">
              OFFICIAL CADET FORCE STATISTICAL RECORD
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-6 divide-y lg:divide-y-0 lg:divide-x divide-army-800 text-center">
            <div className="p-6">
              <div className="text-4xl font-display font-extrabold text-amber-400">
                <AnimatedCounter value={stats.activeCadets ?? 0} />
              </div>
              <div className="text-xs text-army-300 font-mono tracking-wider uppercase mt-1">Active Cadets</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-display font-extrabold text-white">
                <AnimatedCounter value={stats.alumni ?? 0} />
              </div>
              <div className="text-xs text-army-300 font-mono tracking-wider uppercase mt-1">Alumni Count</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-display font-extrabold text-amber-400">
                <AnimatedCounter value={stats.events ?? 0} />
              </div>
              <div className="text-xs text-army-300 font-mono tracking-wider uppercase mt-1">Total Events</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-display font-extrabold text-white">
                <AnimatedCounter value={stats.camps ?? 0} />
              </div>
              <div className="text-xs text-army-300 font-mono tracking-wider uppercase mt-1">Camps Conducted</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-display font-extrabold text-amber-400">
                <AnimatedCounter value={stats.totalAwards ?? 0} />
              </div>
              <div className="text-xs text-army-300 font-mono tracking-wider uppercase mt-1">Awards Won</div>
            </div>
            <div className="p-6">
              <div className="text-4xl font-display font-extrabold text-white">
                <AnimatedCounter value={homepageData?.statsBloodUnits !== undefined ? homepageData.statsBloodUnits : 0} />
              </div>
              <div className="text-xs text-army-300 font-mono tracking-wider uppercase mt-1">Blood Donated (Units)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Commander's Corner Section */}
      <section className="w-full mx-auto">
        <div className="bg-gradient-to-r from-army-950 via-army-900 to-army-950 text-white rounded-2xl shadow-xl overflow-hidden border border-amber-500/30 relative">
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="grid md:grid-cols-12 gap-8 p-8 md:p-12 items-center relative z-10">
            {/* Commander Photo with Golden Border Accent */}
            <div className="md:col-span-4 flex flex-col items-center text-center space-y-4">
              <div className="relative group">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
                {(activeCommanderInfo?.photo || commanderPhoto) ? (
                  <img
                    src={activeCommanderInfo?.photo || commanderPhoto}
                    alt={activeCommanderInfo?.name || commanderName || "PUO Dr. Md. Aminul Islam"}
                    className="w-48 h-48 rounded-2xl object-cover border-2 border-amber-500/50 shadow-2xl relative z-10 transform transition duration-500 hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-2xl bg-army-900 border-2 border-amber-500/50 shadow-2xl relative z-10 flex flex-col items-center justify-center p-4 text-amber-400 transform transition duration-500 hover:scale-105">
                    <Shield className="h-16 w-16 mb-2 text-amber-500 opacity-90" />
                    <span className="font-display font-black text-xs uppercase text-amber-300 tracking-wider text-center">
                      {activeCommanderInfo?.name || commanderName || "Platoon Commander"}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-lg font-display font-black text-amber-400 tracking-wide uppercase">
                  {activeCommanderInfo?.name || commanderName || "PUO Dr. Md. Aminul Islam"}
                </h4>
                <p className="text-xs font-mono text-army-300 font-bold uppercase tracking-wider mt-1">
                  {activeCommanderInfo?.rank || commanderRank || "Platoon Under Officer"}
                </p>
                <span className="inline-flex items-center space-x-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase mt-2">
                  <span>★ PLATOON commander</span>
                </span>
              </div>
            </div>

            {/* Message Body */}
            <div className="md:col-span-8 space-y-6">
              <div className="flex items-center space-x-3">
                <div className="h-[2px] bg-amber-50 w-12 rounded"></div>
                <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest">
                  Official Command Message
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-display font-extrabold text-white uppercase tracking-tight">
                Moulding Disciplined Leaders of Tomorrow
              </h2>
              
              <div className="relative bg-army-950/60 p-6 rounded-xl border border-army-800/80">
                <Quote className="absolute -top-4 -left-3 h-10 w-10 text-amber-500/20" />
                <div className="text-xs md:text-sm text-army-100 font-sans leading-relaxed italic space-y-4 font-light">
                  {parseMarkdown(
                    commanderMessage ||
                    activeCommanderInfo?.bio ||
                    "As the Platoon Commander of Uttara Government College BNCC Platoon, I welcome you to our digital command hub. Our mission is to build highly disciplined, patriotic, and competent future leaders. Through weekly drills, rescue camps, and voluntary campaigns, we instill a spirit of selfless service. Stand tall, march forward, and salute the nation."
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-army-400 border-t border-army-800/80 pt-4">
                <span>SECURITY LEVEL: UNCLASSIFIED</span>
                <span>UGC BNCC HQ • DHAKA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Values & Mission statement */}
      <section className="w-full mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <Award className="h-8 w-8 text-army-800 dark:text-amber-500 mx-auto mb-2" />
          <h2 className="text-2xl md:text-3xl font-display font-extrabold text-army-950 dark:text-white uppercase tracking-tight">
            CORE COMMAND MODULES
          </h2>
          <p className="text-slate-500 text-xs md:text-sm mt-2">
            The foundation pillars of the Bangladesh National Cadet Corps training standard.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {coreValues.map((val) => (
            <div
              key={val.title}
              className={`border-t-4 rounded-xl p-6 shadow-sm bg-white dark:bg-slate-900 transition-all hover:shadow-md ${val.color}`}
            >
              <div className="mb-4">{val.icon}</div>
              <h4 className="font-display font-black text-slate-900 dark:text-white text-base tracking-wide uppercase">
                {val.title}
              </h4>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-2.5 leading-relaxed font-light">
                {val.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Notices & Drills Combined Section */}
      <section className="w-full mx-auto grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Bell className="h-5 w-5 text-army-800 dark:text-amber-500" />
            <h2 className="text-lg font-display font-bold text-army-950 dark:text-white uppercase">
              SECURE COMMAND TRANSMISSIONS
            </h2>
          </div>

          <div className="space-y-4">
            {notices.length === 0 ? (
              <p className="text-slate-500 italic text-sm">No transmissions logged in archives.</p>
            ) : (
              notices.map((notice) => (
                <div
                  key={notice.id}
                  id={notice.id}
                  className={`bg-white dark:bg-slate-900 p-5 rounded-lg border shadow-sm relative ${
                    notice.pinned
                      ? "border-amber-500 dark:border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {notice.pinned && (
                    <span className="absolute top-4 right-4 bg-amber-500 text-army-950 font-mono text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                      ★ IMMEDIATE TASKING
                    </span>
                  )}
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                    <span>{notice.date}</span>
                    <span>•</span>
                    <span className="text-amber-600 dark:text-amber-400 uppercase font-black">
                      [{notice.category}]
                    </span>
                  </div>
                  <h4 className="font-display font-extrabold text-slate-900 dark:text-white text-sm mt-2.5">
                    {notice.title}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 text-xs mt-2 leading-relaxed font-light">
                    {notice.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <Calendar className="h-5 w-5 text-army-800 dark:text-amber-500" />
            <h2 className="text-lg font-display font-bold text-army-950 dark:text-white uppercase">UPCOMING DRILLS & EVENTS</h2>
          </div>

          <div className="space-y-4">
            {upcomingEvents.length === 0 ? (
              <p className="text-slate-500 italic text-sm">No platoon events scheduled.</p>
            ) : (
              upcomingEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-inner flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[9px] bg-amber-100 dark:bg-slate-800 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                        {event.eventType}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{event.date}</span>
                    </div>
                    <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm mt-2">{event.name}</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 line-clamp-2 font-light">{event.description}</p>
                    <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-400 mt-2 space-x-1.5 font-mono">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span>{event.venue}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => onChangeTab("events")}
                    className="mt-3.5 flex items-center justify-center space-x-1 text-xs text-army-700 dark:text-amber-400 font-bold hover:text-amber-600 dark:hover:text-amber-300 transition-colors self-end cursor-pointer"
                  >
                    <span>Register to Join</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 5. Featured Veteran / Alumni Spotlight */}
      <section className="bg-army-950 text-white py-16 px-4 sm:px-6 lg:px-8 border-y-4 border-amber-500 rounded-2xl shadow-xl w-full mx-auto">
        <div className="w-full mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-display font-extrabold text-amber-400 uppercase tracking-tight">
              PROUD ALUMNI SPOTLIGHT
            </h2>
            <p className="text-army-200 text-xs md:text-sm font-sans mt-2 font-light">
              Since 2018, our cadet graduates have stepped into influential, patriotic careers, serving as live inspirations for current recruits.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {featuredAlumni.map((alum) => (
              <div
                key={alum.id}
                className="bg-army-900 border border-army-800 rounded-lg p-5 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center space-x-4 mb-4">
                    <img
                      src={alum.photoUrl}
                      alt={`Portrait of Cadet Alumnus ${alum.rank} ${alum.fullName}`}
                      className="w-14 h-14 rounded-full border-2 border-amber-500 object-cover"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-display font-bold text-sm text-white">{alum.fullName}</h4>
                      <p className="text-[10px] font-mono text-amber-400 uppercase">
                        ★ {alum.rank} (Alumni)
                      </p>
                      <p className="text-[10px] text-army-300 font-mono">
                        Session: {alum.session}
                      </p>
                    </div>
                  </div>

                  <div className="relative bg-army-950 p-4 rounded border-l-4 border-amber-500">
                    <Quote className="absolute top-2 right-2 h-4 w-4 text-army-800 opacity-30" />
                    <p className="text-[11px] font-sans italic text-army-200 leading-relaxed line-clamp-3 font-light">
                      {alum.biography}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-army-850">
                  <div className="flex justify-between items-center text-[10px]">
                    <div className="min-w-0 pr-2">
                      <span className="text-amber-400 block font-mono text-[9px] font-bold uppercase tracking-wider">CURRENT SERVICE</span>
                      {alum.currentProfession && (
                        <strong className="text-white block font-display text-xs truncate max-w-[180px]" title={alum.currentProfession}>
                          {alum.currentProfession}
                        </strong>
                      )}
                      {alum.currentOrganization && (
                        <span className="text-amber-300 block text-[10px] truncate max-w-[180px]" title={alum.currentOrganization}>
                          @ {alum.currentOrganization}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onSelectMember(alum.id)}
                      className="inline-flex items-center space-x-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-army-950 border border-amber-500/40 hover:border-amber-500 px-3 py-1.5 rounded-md font-mono font-bold text-[11px] uppercase tracking-wider transition-all duration-200 shadow-sm cursor-pointer group/btn"
                    >
                      <UserIcon className="h-3 w-3 text-amber-400 group-hover/btn:text-army-950 transition-colors" />
                      <span>Profile</span>
                      <ChevronRight className="h-3 w-3 text-amber-400 group-hover/btn:text-army-950 group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Platoon Historical Gallery */}
      <section className="w-full mx-auto text-center bg-white dark:bg-slate-900 p-6 sm:p-8 lg:p-10 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-army-950 dark:text-white uppercase">Platoon Historical Gallery</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-2xl mx-auto mt-2 font-light">
            A visual archive of national programs, weekly drills, blood donation drives, winter camps, and Annual Iftar Mahfils since 2018.
          </p>
        </div>

        {/* Admin Quick Action Panel for Gallery */}
        {isAdmin && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300/50 p-4 rounded-xl flex flex-col space-y-4 max-w-2xl mx-auto text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 uppercase">
                  Gallery Asset Controls
                </span>
              </div>
              {!addingPhoto ? (
                <button
                  onClick={() => setAddingPhoto(true)}
                  className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-army-950 font-mono text-xs font-bold px-3 py-1 rounded transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Photo</span>
                </button>
              ) : (
                <button
                  onClick={() => setAddingPhoto(false)}
                  className="inline-flex items-center space-x-1 bg-slate-200 dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-mono text-xs font-bold px-3 py-1 rounded transition-all cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  <span>Cancel</span>
                </button>
              )}
            </div>

            {galleryError && (
              <div className="border border-red-200 bg-red-50 text-red-700 font-mono text-xs rounded p-3">
                Error: {galleryError}
              </div>
            )}

            {addingPhoto && (
              <form onSubmit={handleAddPhotoSubmit} className="grid md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Photo Title</label>
                  <input
                    type="text"
                    required
                    value={photoTitle}
                    onChange={(e) => setPhotoTitle(e.target.value)}
                    placeholder="e.g. National drill competition"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold uppercase">Category</label>
                  <select
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  >
                    <option value="Training">Training</option>
                    <option value="Camps">Camps</option>
                    <option value="National Events">National Events</option>
                    <option value="Iftar Mahfil">Iftar Mahfil</option>
                    <option value="Blood Donation">Blood Donation</option>
                    <option value="Social Programs">Social Programs</option>
                    <option value="Reunions">Reunions</option>
                    <option value="Competitions">Competitions</option>
                  </select>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <ImageField
                    id="gallery-photo-field"
                    value={photoUrl}
                    onChange={(val) => setPhotoUrl(val)}
                    label="Gallery Asset Photo (Options A & B supported)"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-500 font-bold uppercase">Brief Description</label>
                  <input
                    type="text"
                    value={photoDesc}
                    onChange={(e) => setPhotoDesc(e.target.value)}
                    placeholder="Describe this platoon moment..."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={submittingPhoto}
                  className="md:col-span-2 bg-army-900 hover:bg-army-950 text-white font-bold py-2 rounded flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {submittingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  <span>PUBLISH ASSET TO PUBLIC GALLERY</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* Dynamic Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {gallery.length === 0 ? (
            <div className="col-span-4 py-8 text-slate-400 font-mono text-xs">No photos published yet.</div>
          ) : (
            gallery.map((item) => (
              <div key={item.id} className="relative group rounded overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800 aspect-[4/3]">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover transition-all duration-300 group-hover:scale-110"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
                
                {/* Overlay for Info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3 text-left">
                  <span className="text-[8px] bg-amber-500 text-army-950 font-mono font-bold px-1.5 py-0.5 rounded uppercase self-start mb-1.5">
                    {item.category}
                  </span>
                  <h4 className="text-xs font-display font-bold text-white tracking-wide uppercase leading-tight">
                    {item.title}
                  </h4>
                  {item.description && (
                    <p className="text-[10px] text-slate-300 font-light mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <span className="text-[8px] text-slate-400 font-mono mt-1 block">
                    {item.date}
                  </span>
                </div>

                {/* Admin delete overlay (soft delete) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setDeletePhotoDialog({ id: item.id, title: item.title })}
                    className="absolute top-2 right-2 p-1.5 bg-red-600/90 text-white rounded hover:bg-red-700 transition-all shadow-md z-20 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                    title="Soft delete photo to trash"
                    aria-label={`Move ${item.title} to trash`}
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Delete Photo Confirmation Modal */}
        {deletePhotoDialog && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          >
            <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-5 max-w-sm w-full space-y-3 shadow-2xl">
              <div className="flex items-center space-x-2.5 text-rose-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider">Move Photo to Trash</h4>
              </div>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Move &ldquo;{deletePhotoDialog.title}&rdquo; to the institutional trash collection? It can be restored from the Recycle Bin.
              </p>
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  disabled={deletingPhoto}
                  onClick={() => setDeletePhotoDialog(null)}
                  className="px-3 py-1.5 rounded text-xs font-mono text-slate-300 hover:bg-slate-800 border border-slate-700 min-h-[36px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingPhoto}
                  onClick={confirmDeletePhoto}
                  className="px-3.5 py-1.5 rounded text-xs font-mono font-bold bg-rose-600 hover:bg-rose-700 text-white min-h-[36px] flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {deletingPhoto ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Moving...</span>
                    </>
                  ) : (
                    <span>Confirm Move</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          <button
            onClick={() => onChangeTab("directory")}
            className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-mono text-xs font-semibold px-4 py-2.5 rounded transition-all uppercase cursor-pointer"
          >
            <span>Browse Cadet Profiles</span>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => onChangeTab("gallery")}
            className="inline-flex items-center space-x-1 bg-army-900 hover:bg-army-800 text-white font-mono text-xs font-semibold px-4 py-2.5 rounded transition-all uppercase cursor-pointer"
          >
            <span>View Full Media Gallery</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
})

export default Home;
