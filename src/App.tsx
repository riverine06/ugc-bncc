/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Routes, Route, Link, useLocation, useNavigate, useParams, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Phone, Mail, MapPin, Clock } from "lucide-react";
import { logFirebaseEvent, auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, onSnapshot, doc } from "firebase/firestore";
import { subscribeToCollection } from "./firebaseService";
import { authService, hasAdminPrivileges, hasEditorPrivileges } from "./services/auth";
import Header from "./components/Header";
import { Member, PlatoonEvent, PlatoonApplication, User, UserRole, GalleryItem, Announcement, MemberStatus, BNCCRank } from "./types";

const Home = React.lazy(() => import("./components/Home"));
const About = React.lazy(() => import("./components/About"));
const Leadership = React.lazy(() => import("./components/Leadership"));
const CadetDirectory = React.lazy(() => import("./components/CadetDirectory"));
const CadetProfile = React.lazy(() => import("./components/CadetProfile"));
const EventPortal = React.lazy(() => import("./components/EventPortal"));
const Recruitment = React.lazy(() => import("./components/Recruitment"));
const Contact = React.lazy(() => import("./components/Contact"));
const Achievements = React.lazy(() => import("./components/Achievements"));
const DocumentLibrary = React.lazy(() => import("./components/DocumentLibrary"));
const Gallery = React.lazy(() => import("./components/Gallery"));
const LoginModal = React.lazy(() => import("./components/LoginModal"));
const AdminDashboard = React.lazy(() => import("./components/AdminDashboard"));

// Official Platoon & Creator Social Configuration
const PLATOON_FACEBOOK_URL = "https://www.facebook.com/ugcBNCC";
const CREATOR_FACEBOOK_URL = "https://www.facebook.com/ab.faisal006";
// Creator / Developer Portfolio link (remains blank as requested so user can add it later)
const CREATOR_PORTFOLIO_URL = "";

function FacebookIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CommandArchiveSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-pulse" id="archive-skeleton">
      <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
      <div className="space-y-3">
        <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-pulse" style={{ animationDelay: "100ms" }}></div>
        <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" style={{ animationDelay: "200ms" }}></div>
        <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" style={{ animationDelay: "300ms" }}></div>
      </div>
      <div className="grid md:grid-cols-3 gap-6 pt-4">
        <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"></div>
        <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"></div>
        <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"></div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  React.useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.documentElement.scrollTo({ top: 0, behavior: "instant" });
    document.body.scrollTo({ top: 0, behavior: "instant" });

    const mainElement = document.querySelector("main");
    if (mainElement) {
      mainElement.scrollTo({ top: 0 });
    }
  }, [pathname, search]);

  return null;
}

function CadetProfileWrapper({ currentUser, onBack }: { currentUser: User | null; onBack: () => void }) {
  const { id } = useParams<{ id: string }>();
  if (!id) {
    return (
      <div className="text-center py-20 text-slate-500 font-mono">
        Profile selector inactive. Return to directory.
      </div>
    );
  }
  return <CadetProfile memberId={id} onBack={onBack} currentUser={currentUser} />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // Calculate current view tab for Header active highlighting
  const currentView = React.useMemo(() => {
    const path = location.pathname;
    if (path === "/" || path === "") return "home";
    if (path.startsWith("/profile")) return "profile";
    if (path.startsWith("/directory/")) return "profile";
    return path.replace("/", "");
  }, [location.pathname]);

  // Theme State with robust localStorage caching and prefers-color-scheme fallback
  const [theme, setTheme] = React.useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("ugc_bncc_theme");
      if (saved === "light" || saved === "dark") {
        return saved;
      }
      if (typeof window !== "undefined" && window.matchMedia) {
        const matchesDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return matchesDark ? "dark" : "light";
      }
    } catch (e) {
      console.warn("localStorage access failed, defaulting to light theme:", e);
    }
    return "light";
  });

  // Apply Theme class to document element robustly
  React.useEffect(() => {
    try {
      localStorage.setItem("ugc_bncc_theme", theme);
    } catch (e) {
      console.warn("localStorage save failed:", e);
    }
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Firebase Analytics Page View Tracking
  React.useEffect(() => {
    logFirebaseEvent("page_view", {
      page_path: location.pathname,
      page_title: currentView.toUpperCase(),
    });
  }, [location.pathname, currentView]);

  // Authentication State (Driven strictly by Firebase Authentication)
  const [token, setToken] = React.useState<string | null>(null);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [currentMember, setCurrentMember] = React.useState<Member | null>(null);
  const [authLoading, setAuthLoading] = React.useState<boolean>(true);
  const [loginModalOpen, setLoginModalOpen] = React.useState<boolean>(false);

  // Database Fetched State
  const [members, setMembers] = React.useState<Member[]>([]);
  const [events, setEvents] = React.useState<PlatoonEvent[]>([]);
  const [applications, setApplications] = React.useState<PlatoonApplication[]>([]);
  const [gallery, setGallery] = React.useState<GalleryItem[]>([]);
  const [notices, setNotices] = React.useState<Announcement[]>([]);
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [contactInfo, setContactInfo] = React.useState<{
    location: string;
    phone: string;
    email: string;
    timings: string;
    footerAbout?: string;
    legalNotice?: string;
  }>({
    location: "Uttara Govt. College campus,\nSector-7, Uttara, Dhaka-1230",
    phone: "+880 1712-345678 (Hotline)",
    email: "ugc.bncc@gmail.com",
    timings: "Sun - Thu, 09:00 AM - 05:00 PM",
    footerAbout: "The Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College serves as a premier training command, molding disciplined future military and civil leaders.",
    legalNotice: "All digital military dossiers, cadet records, and duty rosters are protected by UGC BNCC Command regulations. Unauthorized access is strictly prohibited.",
  });

  const [campsCount, setCampsCount] = React.useState<number>(0);
  const [awardsCount, setAwardsCount] = React.useState<number>(0);

  const stats = React.useMemo(() => {
    const totalMembers = members.length;
    const activeCadets = members.filter(c => c.status === MemberStatus.ACTIVE_CADET && c.rank !== BNCCRank.PLATOON_UNDER_OFFICER).length;
    const alumni = members.filter(c => c.status === MemberStatus.ALUMNI).length;
    const totalEvents = events.length;
    const totalCamps = campsCount;
    const totalAwards = awardsCount;
    const pendingApprovals = applications.filter(a => a.status === "Pending").length;

    return {
      totalMembers,
      activeCadets,
      alumni,
      events: totalEvents,
      camps: totalCamps,
      pendingApprovals,
      totalAwards,
    };
  }, [members, events, campsCount, awardsCount, applications]);

  // Initialize DB and configure real Firebase Auth state persistence
  React.useEffect(() => {
    // Clean up any legacy mock session traces from browser storage
    try {
      localStorage.removeItem("ugc_bncc_mock_user");
      localStorage.removeItem("ugc_bncc_token");
    } catch (storageErr) {
      // ignore
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const email = (firebaseUser.email || "").toLowerCase().trim();

          // Authoritative role resolution from Firebase Auth custom claims / verified admin list
          const role = await authService.resolveUserRole(firebaseUser);

          // Fetch member details if linked
          let loggedMember: Member | null = null;
          try {
            const querySnap = await getDocs(query(collection(db, "cadets"), where("email", "==", email)));
            if (!querySnap.empty) {
              loggedMember = querySnap.docs[0].data() as Member;
              if (loggedMember.status === MemberStatus.ALUMNI && role === UserRole.ACTIVE_CADET) {
                // Keep alumni status if not an admin/editor
              }
            }
          } catch (e) {
            console.warn("[App] Could not load cadet details:", e);
          }

          const loggedUser: User = {
            id: firebaseUser.uid,
            email,
            role,
            memberId: loggedMember?.id || null,
            createdAt: firebaseUser.metadata.creationTime || new Date().toISOString()
          };

          setToken(firebaseUser.uid);
          setCurrentUser(loggedUser);
          setCurrentMember(loggedMember);
        } else {
          // Strictly unauthenticated
          setToken(null);
          setCurrentUser(null);
          setCurrentMember(null);
        }
      } catch (err) {
        console.error("[App] Error in auth observer:", err);
        setToken(null);
        setCurrentUser(null);
        setCurrentMember(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // 1. Core Public Firestore Real-Time subscriptions (mounted once, shared across routes)
  React.useEffect(() => {
    // 1. Cadets
    const unsubMembers = subscribeToCollection<Member>("cadets", (data) => {
      setMembers(data);
    });

    // 2. Events
    const unsubEvents = subscribeToCollection<PlatoonEvent>("events", (data) => {
      setEvents(data);
    });

    // 3. Gallery
    const unsubGallery = subscribeToCollection<GalleryItem>("gallery", (data) => {
      setGallery(data);
    });

    // 4. Announcements / Notices
    const unsubNotices = subscribeToCollection<Announcement>("notices", (data) => {
      setNotices(data);
    });

    // 5. Camps count subscription
    const unsubCamps = subscribeToCollection<any>("camps", (data) => {
      setCampsCount(data.length);
    });

    // 6. Achievements count subscription
    const unsubAchievements = subscribeToCollection<any>("achievements", (data) => {
      setAwardsCount(data.length);
    });

    // 7. Contact & Settings Sync
    const unsubContact = onSnapshot(doc(db, "settings", "contact"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setContactInfo({
          location: data.location || "Uttara Govt. College campus,\nSector-7, Uttara, Dhaka-1230",
          phone: data.phone || "+880 1712-345678 (Hotline)",
          email: data.email || "ugc.bncc@gmail.com",
          timings: data.timings || "Sun - Thu, 09:00 AM - 05:00 PM",
          footerAbout: data.footerAbout || "The Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College serves as a premier training command, molding disciplined future military and civil leaders.",
          legalNotice: data.legalNotice || "All digital military dossiers, cadet records, and duty rosters are protected by UGC BNCC Command regulations. Unauthorized access is strictly prohibited.",
        });
      }
    });

    return () => {
      unsubMembers();
      unsubEvents();
      unsubGallery();
      unsubNotices();
      unsubCamps();
      unsubAchievements();
      unsubContact();
    };
  }, []);

  // 2. Role-restricted Applications subscription (isolated to prevent rebuilding all listeners on auth events)
  React.useEffect(() => {
    if (currentUser && hasEditorPrivileges(currentUser.role)) {
      const unsub = subscribeToCollection<PlatoonApplication>("applications", (data) => {
        setApplications(data);
      });
      return () => unsub();
    } else {
      setApplications([]);
    }
  }, [currentUser?.role]);

  // Navigation handlers for router
  const handleSelectMember = React.useCallback((memberId: string) => {
    navigate(`/profile/${memberId}`);
  }, [navigate]);

  const handleNavigate = React.useCallback((view: string) => {
    let targetPath = "/";
    if (view === "home" || view === "/") {
      targetPath = "/";
    } else if (view.startsWith("profile-")) {
      const parsedId = view.replace("profile-", "");
      targetPath = `/profile/${parsedId}`;
    } else if (view.startsWith("/")) {
      targetPath = view;
    } else {
      targetPath = `/${view}`;
    }

    if (location.pathname === targetPath || (targetPath === "/" && location.pathname === "/")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
      document.body.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(targetPath);
    }
  }, [navigate, location.pathname]);

  const handleBack = React.useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Auto open login modal if accessing /login route directly
  React.useEffect(() => {
    if (location.pathname === "/login") {
      setLoginModalOpen(true);
    }
  }, [location.pathname]);

  // Intercept Backspace key when user is not typing in an input field
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace") {
        const activeEl = document.activeElement as HTMLElement | null;
        const isInput =
          activeEl &&
          (activeEl.tagName === "INPUT" ||
            activeEl.tagName === "TEXTAREA" ||
            activeEl.tagName === "SELECT" ||
            activeEl.isContentEditable);

        if (!isInput) {
          e.preventDefault();
          navigate(-1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const handleLoginSuccess = React.useCallback((userToken: string, loggedUser: User, loggedMember: Member | null) => {
    setToken(userToken);
    setCurrentUser(loggedUser);
    setCurrentMember(loggedMember);
    if (loggedUser.role === UserRole.ADMIN || loggedUser.role === UserRole.SUPER_ADMIN) {
      navigate("/admin");
    }
  }, [navigate]);

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("SignOut failed: ", e);
    }
    try {
      localStorage.removeItem("ugc_bncc_token");
      localStorage.removeItem("ugc_bncc_mock_user");
    } catch (e) {
      // ignore
    }
    setToken(null);
    setCurrentUser(null);
    setCurrentMember(null);
    navigate("/");
  }, [navigate]);

  const fetchData = React.useCallback(async () => {
    try {
      // 1. Fetch cadets
      const cadetsSnap = await getDocs(collection(db, "cadets"));
      const cadetsList = cadetsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Member[];
      setMembers(cadetsList);

      // 2. Fetch events
      const eventsSnap = await getDocs(collection(db, "events"));
      const eventsList = eventsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as PlatoonEvent[];
      setEvents(eventsList);

      // 3. Fetch notices
      const noticesSnap = await getDocs(collection(db, "notices"));
      const noticesList = noticesSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Announcement[];
      setNotices(noticesList);

      // 4. Fetch gallery
      const gallerySnap = await getDocs(collection(db, "gallery"));
      const galleryList = gallerySnap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as GalleryItem[];
      setGallery(galleryList);

      // 5. Fetch camps count
      const campsSnap = await getDocs(collection(db, "camps"));
      setCampsCount(campsSnap.docs.length);

      // 6. Fetch achievements count
      const achSnap = await getDocs(collection(db, "achievements"));
      setAwardsCount(achSnap.docs.length);

      // 7. Fetch applications (Authorized Admin/Editor only)
      if (hasAdminPrivileges(currentUser?.role) && auth.currentUser) {
        try {
          const appsSnap = await getDocs(collection(db, "applications"));
          const appsList = appsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id })) as PlatoonApplication[];
          setApplications(appsList);
        } catch (e: any) {
          console.warn("Could not fetch applications:", e?.message || e);
        }
      }
    } catch (e) {
      console.warn("Manual data fetch fallback failed:", e);
    }
  }, [currentUser?.role]);

  // Fullscreen view for Admin Dashboard
  if (location.pathname === "/admin") {
    if (authLoading) {
      return (
        <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center font-mono text-xs text-slate-500">
          <div className="space-y-3 text-center">
            <div className="h-6 w-6 border-2 border-army-700 dark:border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="tracking-widest uppercase text-slate-600 dark:text-slate-400">Verifying Security Clearance...</div>
          </div>
        </div>
      );
    }

    const hasAdminAccess = Boolean(currentUser && hasAdminPrivileges(currentUser.role));

    return (
      <div className="h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden selection:bg-amber-500 selection:text-white font-sans text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200">
        <ScrollToTop />
        <React.Suspense fallback={<CommandArchiveSkeleton />}>
          {hasAdminAccess ? (
            <AdminDashboard
              stats={stats}
              members={members}
              events={events}
              applications={applications}
              onRefresh={fetchData}
              onLogout={handleLogout}
              onViewPublicSite={() => navigate("/")}
              currentUser={currentUser}
            />
          ) : (
            <div className="max-w-md mx-auto py-16 px-6 text-center border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 rounded-xl mt-16 shadow-lg">
              <div className="text-red-700 dark:text-red-400 font-mono text-sm font-bold uppercase tracking-wider mb-2">
                RESTRICTED COMMAND SECTOR
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-sans mb-6">
                Administrative clearance is required. Please authenticate with an authorized command account.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setLoginModalOpen(true)}
                  className="px-4 py-2 bg-army-800 hover:bg-army-900 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                >
                  Authenticate
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold uppercase tracking-wider rounded transition-colors cursor-pointer"
                >
                  Return to Portal
                </button>
              </div>
            </div>
          )}
        </React.Suspense>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between selection:bg-amber-500 selection:text-white font-sans text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200">
      <ScrollToTop />
      <div>
        {/* Navigation Header */}
        <Header
          user={currentUser}
          onOpenLogin={() => {
            setLoginModalOpen(true);
            if (location.pathname !== "/login") {
              navigate("/login");
            }
          }}
          onLogout={handleLogout}
          currentTab={currentView}
          onChangeTab={handleNavigate}
          onSearch={(term) => {
            setSearchQuery(term);
            if (location.pathname !== "/directory") {
              navigate("/directory");
            }
          }}
          searchQuery={searchQuery}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Dynamic Route Content */}
        <main className="pb-16 w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-8 pt-4">
          {location.pathname !== "/" && !location.pathname.startsWith("/profile") && (
            <button
              onClick={handleBack}
              className="mb-6 inline-flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-500 hover:text-army-800 dark:text-slate-400 dark:hover:text-amber-400 uppercase transition-all duration-200 cursor-pointer hover:translate-x-[-4px]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to previous view</span>
            </button>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.995 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            >
              <React.Suspense fallback={<CommandArchiveSkeleton />}>
                <Routes location={location}>
                  <Route
                    path="/"
                    element={
                      <Home
                        stats={{
                          totalMembers: stats.totalMembers,
                          activeCadets: stats.activeCadets,
                          alumni: stats.alumni,
                          events: stats.events,
                          camps: stats.camps,
                          totalAwards: stats.totalAwards,
                        }}
                        notices={notices}
                        upcomingEvents={events.slice(0, 3)}
                        featuredAlumni={members.filter((m) => m.status === "Alumni").slice(0, 3)}
                        gallery={gallery}
                        currentUser={currentUser}
                        onChangeTab={handleNavigate}
                        onSelectMember={handleSelectMember}
                        onRefreshData={fetchData}
                      />
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      <Home
                        stats={{
                          totalMembers: stats.totalMembers,
                          activeCadets: stats.activeCadets,
                          alumni: stats.alumni,
                          events: stats.events,
                          camps: stats.camps,
                          totalAwards: stats.totalAwards,
                        }}
                        notices={notices}
                        upcomingEvents={events.slice(0, 3)}
                        featuredAlumni={members.filter((m) => m.status === "Alumni").slice(0, 3)}
                        gallery={gallery}
                        currentUser={currentUser}
                        onChangeTab={handleNavigate}
                        onSelectMember={handleSelectMember}
                        onRefreshData={fetchData}
                      />
                    }
                  />
                  <Route path="/about" element={<About currentUser={currentUser} />} />
                  <Route path="/leadership" element={<Leadership currentUser={currentUser} />} />
                  <Route
                    path="/directory"
                    element={
                      <CadetDirectory
                        members={members}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onSelectMember={handleSelectMember}
                        onReload={fetchData}
                      />
                    }
                  />
                  <Route
                    path="/profile/:id"
                    element={<CadetProfileWrapper currentUser={currentUser} onBack={handleBack} />}
                  />
                  <Route
                    path="/directory/:id"
                    element={<CadetProfileWrapper currentUser={currentUser} onBack={handleBack} />}
                  />
                  <Route
                    path="/events"
                    element={<EventPortal events={events} user={currentUser} onRefresh={fetchData} />}
                  />
                  <Route path="/recruitment" element={<Recruitment />} />
                  <Route path="/contact" element={<Contact currentUser={currentUser} />} />
                  <Route path="/achievements" element={<Achievements currentUser={currentUser} />} />
                  <Route path="/documents" element={<DocumentLibrary />} />
                  <Route path="/gallery" element={<Gallery />} />
                  <Route
                    path="*"
                    element={<Navigate to="/" replace />}
                  />
                </Routes>
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Footer Banner */}
      <footer className="bg-army-950 text-white py-12 border-t-4 border-amber-500">
        <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs font-sans font-light">
          {/* Column 1: Identity & Official Platoon Social */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-amber-500 font-display font-black text-sm tracking-wider uppercase">
                UGC BNCC Platoon
              </span>
              <span className="text-army-300 font-mono text-[9px] bg-army-900 border border-army-700 px-1.5 py-0.5 rounded">ESTD 2018</span>
            </div>
            <p className="text-slate-200 leading-relaxed text-[11px] whitespace-pre-line">
              {contactInfo.footerAbout || "The Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College serves as a premier training command, molding disciplined future military and civil leaders."}
            </p>
            <div className="pt-1">
              <a
                href={PLATOON_FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-[11px] font-mono font-medium text-slate-200 hover:text-amber-400 bg-army-900/90 hover:bg-army-900 border border-army-800 hover:border-amber-500/50 px-2.5 py-1.5 rounded transition-all group shadow-sm"
                title="Official UGC BNCC Facebook Page"
              >
                <FacebookIcon className="h-3.5 w-3.5 text-[#1877F2] group-hover:scale-110 transition-transform" />
                <span>UGC BNCC</span>
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-4">
            <h4 className="font-display font-bold text-amber-500 uppercase tracking-wider text-[11px] border-b border-army-800 pb-2">
              QUICK LINKS
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px] font-mono text-slate-200">
              <Link
                to="/"
                onClick={() => {
                  if (location.pathname === "/") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ HOME
              </Link>
              <Link
                to="/about"
                onClick={() => {
                  if (location.pathname === "/about") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ ABOUT
              </Link>
              <Link
                to="/leadership"
                onClick={() => {
                  if (location.pathname === "/leadership") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ DIRECTORY
              </Link>
              <Link
                to="/directory"
                onClick={() => {
                  if (location.pathname === "/directory") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ CADETS
              </Link>
              <Link
                to="/events"
                onClick={() => {
                  if (location.pathname === "/events") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ EVENTS
              </Link>
              <Link
                to="/gallery"
                onClick={() => {
                  if (location.pathname === "/gallery") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ GALLERY
              </Link>
              <Link
                to="/achievements"
                onClick={() => {
                  if (location.pathname === "/achievements") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ AWARDS
              </Link>
              <Link
                to="/documents"
                onClick={() => {
                  if (location.pathname === "/documents") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="hover:text-amber-400 transition-colors cursor-pointer text-left"
              >
                ▶ DOCS
              </Link>
              <Link
                to="/recruitment"
                onClick={() => {
                  if (location.pathname === "/recruitment") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                    document.body.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer text-left col-span-2 font-semibold"
              >
                ▶ [JOIN PLATOON]
              </Link>
            </div>
          </div>

          {/* Column 3: Contact Details & Dispatch */}
          <div className="space-y-4">
            <h4 className="font-display font-bold text-amber-500 uppercase tracking-wider text-[11px] border-b border-army-800 pb-2">
              PLATOON HQ CONTACTS
            </h4>
            <ul className="space-y-3 text-slate-200 text-[11px]">
              <li className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed whitespace-pre-line">
                  {contactInfo.location}
                </span>
              </li>
              <li className="flex items-center space-x-2">
                <Phone className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="whitespace-pre-line">{contactInfo.phone}</span>
              </li>
              <li className="flex items-center space-x-2">
                <Mail className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <a href={`mailto:${contactInfo.email}`} className="text-slate-200 hover:text-amber-400 transition-colors whitespace-pre-line underline decoration-slate-600 hover:decoration-amber-400">
                  {contactInfo.email}
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <FacebookIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <a
                  href={PLATOON_FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-200 hover:text-amber-400 transition-colors whitespace-pre-line underline decoration-slate-600 hover:decoration-amber-400"
                >
                  UGC BNCC
                </a>
              </li>
              <li className="flex items-center space-x-2">
                <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-slate-300 text-[10.5px] whitespace-pre-line">{contactInfo.timings}</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Command Legal Notice */}
          <div className="space-y-4">
            <h4 className="font-display font-bold text-amber-500 uppercase tracking-wider text-[11px] border-b border-army-800 pb-2">
              COMMAND LEGAL NOTICE
            </h4>
            <p className="text-slate-200 leading-relaxed text-[11px] whitespace-pre-line">
              {contactInfo.legalNotice || "All digital military dossiers, cadet records, and duty rosters are protected by UGC BNCC Command regulations. Unauthorized access is strictly prohibited."}
            </p>
            <div className="text-[10px] text-slate-400 font-mono pt-1">
              Authorized operations by Bangladesh National Cadet Corps, 3 Ramna Battalion, Ramna Regiment.
            </div>
          </div>
        </div>

        {/* Footer Sub-Bar: Copyright, Official Platoon Social, & Developer Credits */}
        <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-8 mt-10 pt-6 border-t border-army-900 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-[11px]">
            <span>© {new Date().getFullYear()} UGC BNCC Digital Platoon. All rights reserved.</span>
            <span className="hidden sm:inline text-army-800">|</span>
            <a
              href={PLATOON_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 text-slate-300 hover:text-amber-400 transition-colors"
              title="Official UGC BNCC Facebook Page"
            >
              <FacebookIcon className="h-3.5 w-3.5 text-[#1877F2]" />
              <span>Platoon Facebook</span>
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-2.5 gap-y-1 text-[11px] text-slate-400">
            <span>Developed by</span>
            <a
              href={CREATOR_FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-slate-200 hover:text-amber-400 transition-colors font-semibold"
              title="Developer Profile on Facebook"
            >
              <FacebookIcon className="h-3 w-3 text-[#1877F2]" />
              <span>Ab Faisal Ahmed</span>
            </a>
            <span className="text-army-800">•</span>
            {CREATOR_PORTFOLIO_URL ? (
              <a
                href={CREATOR_PORTFOLIO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:text-amber-300 transition-colors underline decoration-slate-600 hover:decoration-amber-400"
                title="Developer Portfolio"
              >
                Portfolio
              </a>
            ) : (
              <a
                href=""
                onClick={(e) => {
                  // Portfolio link placeholder - ready to add URL in CREATOR_PORTFOLIO_URL
                  e.preventDefault();
                }}
                className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                title="Portfolio link (ready to be updated in CREATOR_PORTFOLIO_URL)"
              >
                Portfolio
              </a>
            )}
          </div>
        </div>
      </footer>

      {/* Authenticator Modal Popup */}
      {loginModalOpen && (
        <React.Suspense fallback={null}>
          <LoginModal
            onClose={() => {
              setLoginModalOpen(false);
              if (location.pathname === "/login") {
                navigate(-1);
              }
            }}
            onLoginSuccess={handleLoginSuccess}
          />
        </React.Suspense>
      )}
    </div>
  );
}
