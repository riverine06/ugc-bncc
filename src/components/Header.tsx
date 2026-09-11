/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Menu, X, LogIn, LogOut, UserCheck, ShieldAlert, Search, Sun, Moon } from "lucide-react";
import { User, UserRole } from "../types";
import BNCCLogo from "./BNCCLogo";

interface HeaderProps {
  user: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  currentTab: string;
  onChangeTab: (tab: string) => void;
  onSearch: (term: string) => void;
  searchQuery: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

const Header = React.memo(function Header({
  user,
  onOpenLogin,
  onLogout,
  currentTab,
  onChangeTab,
  onSearch,
  searchQuery,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [searchExpanded, setSearchExpanded] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);

  const navItems = [
    { id: "home", path: "/", label: "HOME" },
    { id: "about", path: "/about", label: "ABOUT" },
    { id: "leadership", path: "/leadership", label: "LEADERS" },
    { id: "directory", path: "/directory", label: "CADETS" },
    { id: "events", path: "/events", label: "EVENTS" },
    { id: "gallery", path: "/gallery", label: "GALLERY" },
    { id: "achievements", path: "/achievements", label: "AWARDS" },
    { id: "documents", path: "/documents", label: "DOCS" },
    { id: "recruitment", path: "/recruitment", label: "JOIN" },
    { id: "contact", path: "/contact", label: "CONTACT" },
  ];

  const lastScrollY = React.useRef(0);
  const touchStartY = React.useRef<number | null>(null);
  const wheelAccumulator = React.useRef(0);
  const openTimeRef = React.useRef(0);
  const statesRef = React.useRef({ mobileMenuOpen });

  React.useEffect(() => {
    const wasAnyOpen = statesRef.current.mobileMenuOpen;
    const isAnyOpen = mobileMenuOpen;
    if (isAnyOpen && !wasAnyOpen) {
      lastScrollY.current = window.scrollY || document.documentElement.scrollTop;
      openTimeRef.current = Date.now();
      touchStartY.current = null;
      wheelAccumulator.current = 0;
    }
    statesRef.current = { mobileMenuOpen };
  }, [mobileMenuOpen]);

  const mobileMenuOpenRef = React.useRef(mobileMenuOpen);
  const searchExpandedRef = React.useRef(searchExpanded);
  const searchQueryRef = React.useRef(searchQuery);

  React.useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
    searchExpandedRef.current = searchExpanded;
    searchQueryRef.current = searchQuery;
  }, [mobileMenuOpen, searchExpanded, searchQuery]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (!mobileMenuOpenRef.current && !searchExpandedRef.current) return;

      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        if (mobileMenuOpenRef.current) {
          setMobileMenuOpen(false);
        }
        if (searchExpandedRef.current && !searchQueryRef.current) {
          setSearchExpanded(false);
        }
      }
    }

    function handleTouchStart(event: TouchEvent) {
      if (window.innerWidth >= 1280) return;
      if (!statesRef.current.mobileMenuOpen) return;

      if (event.touches && event.touches[0]) {
        touchStartY.current = event.touches[0].clientY;
      }
    }

    function handleTouchMove(event: TouchEvent) {
      if (window.innerWidth >= 1280) return;
      if (!statesRef.current.mobileMenuOpen) return;

      if (touchStartY.current !== null && event.touches && event.touches[0]) {
        const currentY = event.touches[0].clientY;
        const diff = Math.abs(currentY - touchStartY.current);

        if (diff > 10) {
          setMobileMenuOpen(false);
          touchStartY.current = null;
        }
      }
    }

    function handleScroll() {
      if (window.innerWidth >= 1280) return;
      if (!statesRef.current.mobileMenuOpen) return;

      if (Date.now() - openTimeRef.current < 50) {
        lastScrollY.current = window.scrollY || document.documentElement.scrollTop;
        return;
      }

      const currentScrollY = window.scrollY || document.documentElement.scrollTop;
      const diff = Math.abs(currentScrollY - lastScrollY.current);

      if (diff > 10) {
        setMobileMenuOpen(false);
      }
    }

    function handleWheel(event: WheelEvent) {
      if (window.innerWidth >= 1280) return;
      if (!statesRef.current.mobileMenuOpen) return;

      if (Date.now() - openTimeRef.current < 50) {
        return;
      }

      wheelAccumulator.current += Math.abs(event.deltaY);
      if (wheelAccumulator.current > 10) {
        setMobileMenuOpen(false);
        wheelAccumulator.current = 0;
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const handleNavClick = (id: string, path: string = "") => {
    const isSameTab = path ? (location.pathname === path || (path === "/" && location.pathname === "/")) : false;
    if (isSameTab) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
      document.body.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      onChangeTab(id);
    }
    setMobileMenuOpen(false);
  };

  const isSearchActive = searchExpanded || searchQuery.length > 0;

  return (
    <header ref={headerRef} className="sticky top-0 z-50 w-full bg-[#102235] dark:bg-[#091320] border-b border-[#22324A] shadow-xl transition-colors duration-200">
      {/* Top Gold & Green Military Accent Line */}
      <div className="h-1 bg-gradient-to-r from-[#FFB400] via-[#3D5A40] to-[#FFB400] w-full" />

      <div className="max-w-[1536px] mx-auto px-3 sm:px-4 xl:px-6 2xl:px-8">
        <div className="flex flex-nowrap items-center justify-between h-20 gap-2 xl:gap-4 2xl:gap-6 w-full">
          
          {/* LEFT: Official BNCC Logo & Title (flex-shrink-0) */}
          <Link
            to="/"
            className="flex flex-nowrap items-center space-x-2 xl:space-x-2.5 2xl:space-x-3 cursor-pointer shrink-0 group min-w-0 my-auto"
            onClick={() => {
              if (location.pathname === "/") {
                window.scrollTo({ top: 0, behavior: "smooth" });
                document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
                document.body.scrollTo({ top: 0, behavior: "smooth" });
              }
              setMobileMenuOpen(false);
            }}
          >
            {/* Official BNCC Crest Logo */}
            <div className="flex items-center justify-center shrink-0 p-1 rounded-xl bg-slate-900/40 border border-amber-500/20 group-hover:border-amber-500/50 transition-all">
              <BNCCLogo size={38} className="w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] xl:w-[40px] xl:h-[40px] 2xl:w-[46px] 2xl:h-[46px] drop-shadow-md shrink-0" />
            </div>
            
            {/* Logo Text columns */}
            <div className="flex flex-col select-none justify-center min-w-0 shrink-0">
              <div className="font-sans font-black text-[12px] sm:text-[13px] xl:text-[14px] 2xl:text-[16px] leading-tight tracking-wider text-[#FFB400] uppercase whitespace-nowrap">
                UGC BNCC
              </div>
              <div className="font-sans font-black text-[10px] sm:text-[11px] xl:text-[12px] 2xl:text-[14px] leading-tight tracking-wider text-slate-100 uppercase whitespace-nowrap">
                DIGITAL PLATOON
              </div>
              <div className="font-sans text-[7px] sm:text-[8px] 2xl:text-[8.5px] font-bold text-slate-400 tracking-widest leading-none mt-0.5 uppercase whitespace-nowrap hidden 2xl:block">
                COMMAND MANAGEMENT SYSTEM
              </div>
            </div>
          </Link>

          {/* CENTER: Desktop Navigation Menu (flex-1, justify-center, items-center, whitespace-nowrap, min-w-0, flex-nowrap) */}
          <nav className="hidden xl:flex items-center justify-center flex-1 min-w-0 flex-nowrap space-x-1.5 xl:space-x-2 2xl:space-x-3 my-auto whitespace-nowrap px-2">
            {navItems.map((item) => {
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={() => handleNavClick(item.id, item.path)}
                  className={({ isActive }) =>
                    `relative px-2 xl:px-2.5 2xl:px-3 py-1.5 rounded-lg font-sans text-[10px] xl:text-[11px] 2xl:text-xs tracking-normal 2xl:tracking-wider transition-all duration-200 uppercase whitespace-nowrap shrink-0 flex items-center ${
                      isActive
                        ? "text-[#FFB400] font-black bg-[#0E1A2B] border border-amber-500/50 shadow-[0_0_12px_rgba(255,180,0,0.25)] drop-shadow-[0_0_5px_rgba(255,180,0,0.3)]"
                        : "text-slate-300 font-bold hover:text-white hover:bg-slate-800/50"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span>{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="navActiveIndicator"
                          className="absolute -bottom-1.5 left-1.5 right-1.5 h-0.5 bg-[#FFB400] rounded-full shadow-[0_0_8px_rgba(255,180,0,0.8)]"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* RIGHT: Search (Compact Expandable Icon), Theme Toggle, Login Button (flex-shrink-0) */}
          <div className="hidden xl:flex items-center space-x-2 xl:space-x-2.5 2xl:space-x-3 shrink-0 ml-auto my-auto">
            {/* Expandable Search Component */}
            <div className="relative flex items-center">
              {isSearchActive ? (
                <motion.div
                  initial={{ width: 36, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 36, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative flex items-center"
                >
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search dossiers..."
                    value={searchQuery}
                    onChange={(e) => {
                      onSearch(e.target.value);
                      if (currentTab !== "directory") {
                        onChangeTab("directory");
                      }
                    }}
                    onBlur={() => {
                      if (!searchQuery) {
                        setSearchExpanded(false);
                      }
                    }}
                    className="bg-[#0E1A2B] border border-[#22324A] focus:border-[#FFB400] rounded-lg py-1.5 pl-8 pr-6 text-[10px] xl:text-[11px] text-slate-100 placeholder-slate-400 font-mono shadow-inner w-36 xl:w-44 transition-all focus:outline-none"
                    autoFocus
                  />
                  <Search className="absolute left-2.5 h-4 w-4 text-amber-400 pointer-events-none" />
                  <button
                    onClick={() => {
                      onSearch("");
                      setSearchExpanded(false);
                    }}
                    className="absolute right-1.5 p-0.5 text-slate-400 hover:text-white rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ) : (
                <button
                  onClick={() => {
                    setSearchExpanded(true);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="group p-2 rounded-lg bg-[#0E1A2B] border border-[#22324A] text-slate-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-[#12233a] transition-all cursor-pointer shadow-sm flex items-center justify-center shrink-0"
                  title="Search dossiers"
                  aria-label="Open search input"
                >
                  <Search className="h-5 w-5 text-slate-300 group-hover:text-amber-400 transition-transform group-hover:scale-105" />
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-slate-700/40 shrink-0" />

            {/* Premium Sliding Dark & Light Theme Switcher */}
            <button
              onClick={onToggleTheme}
              className="relative flex items-center bg-[#07111D] border border-amber-500/30 hover:border-amber-500/60 rounded-full p-1 w-13 xl:w-14 h-7 transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-inner shrink-0"
              title={theme === "light" ? "Switch to Tactical Dark Force Mode" : "Switch to Sunlight Cadet Mode"}
              aria-label="Toggle dark/light theme"
            >
              <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[10px] pointer-events-none">
                <Moon className={`h-3.5 w-3.5 transition-colors ${theme === "dark" ? "text-amber-400" : "text-slate-500"}`} />
                <Sun className={`h-3.5 w-3.5 transition-colors ${theme === "light" ? "text-amber-500" : "text-slate-500"}`} />
              </div>
              <motion.div
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`w-5 h-5 rounded-full ${
                  theme === "dark"
                    ? "bg-gradient-to-tr from-amber-500 to-amber-300 translate-x-5 xl:translate-x-6"
                    : "bg-gradient-to-tr from-[#3D5A40] to-emerald-400 translate-x-0"
                } shadow-md flex items-center justify-center z-10`}
              >
                {theme === "dark" ? (
                  <Moon className="h-3 w-3 text-slate-950 fill-slate-950" />
                ) : (
                  <Sun className="h-3 w-3 text-slate-950 fill-slate-950" />
                )}
              </motion.div>
            </button>

            <div className="h-4 w-px bg-slate-700/40 shrink-0" />

            {/* Login / Portal Button */}
            <button
              onClick={() => {
                if (user) {
                  handleNavClick(
                    user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? "admin" : `profile-${user.memberId}`,
                    user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? "/admin" : `/profile/${user.memberId}`
                  );
                } else {
                  onOpenLogin();
                }
              }}
              className="bg-[#FFB400] hover:bg-[#FFC02D] text-slate-950 font-sans font-black text-[10px] xl:text-[11px] 2xl:text-xs tracking-wider px-2.5 xl:px-3 2xl:px-3.5 py-2 rounded-lg shadow-md hover:shadow-lg transition-all active:scale-95 uppercase cursor-pointer shrink-0 whitespace-nowrap flex items-center"
            >
              {user ? (
                user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 mr-1 text-slate-950 shrink-0" />
                    <span>ADMIN<span className="hidden 2xl:inline"> DASHBOARD</span></span>
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5 mr-1 text-slate-950 shrink-0" />
                    <span>CADET<span className="hidden 2xl:inline"> PORTAL</span></span>
                  </>
                )
              ) : (
                "LOGIN"
              )}
            </button>

            {/* Auth status icon & logout */}
            {user && (
              <div className="flex items-center space-x-1 pl-1 border-l border-[#22324A] shrink-0">
                <button
                  onClick={onLogout}
                  className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile & Tablet Controls (<1280px / xl:hidden) */}
          <div className="flex items-center space-x-2 shrink-0 xl:hidden my-auto">
            {/* Tablet Compact Search Icon Button */}
            <button
              onClick={() => {
                setMobileMenuOpen(true);
              }}
              className="p-2 rounded-lg bg-[#0E1A2B] border border-[#22324A] text-slate-300 hover:text-amber-400 transition-all cursor-pointer shadow-sm shrink-0 md:block hidden"
              title="Search"
              aria-label="Open mobile search menu"
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Mobile/Tablet Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg bg-[#0E1A2B] border border-[#22324A] text-amber-400 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
              aria-label="Toggle theme"
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* Login / Portal Button */}
            <button
              onClick={() => {
                if (user) {
                  handleNavClick(user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? "admin" : `profile-${user.memberId}`);
                } else {
                  onOpenLogin();
                }
              }}
              className="bg-[#FFB400] text-slate-950 px-3 py-2 rounded-lg text-[11px] font-black tracking-wide uppercase shadow-sm shrink-0 whitespace-nowrap"
            >
              {user ? (
                user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN ? (
                  "ADMIN"
                ) : (
                  "PORTAL"
                )
              ) : (
                "LOGIN"
              )}
            </button>

            {/* Drawer Hamburger Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-200 hover:text-white bg-[#0E1A2B] border border-[#22324A] hover:bg-slate-800/80 focus:outline-none shrink-0 cursor-pointer"
              aria-label="Toggle mobile navigation menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6 text-amber-400" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile & Tablet Navigation Drawer (below 1280px / xl:hidden) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="xl:hidden bg-[#091320] border-t border-[#22324A] px-4 pt-3 pb-6 space-y-3 shadow-2xl overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {navItems.map((item) => {
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === "/"}
                    onClick={() => handleNavClick(item.id, item.path)}
                    className={({ isActive }) =>
                      `block w-full text-center px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${
                        isActive 
                          ? "text-[#FFB400] bg-[#0E1A2B] border border-amber-500/40 shadow-inner" 
                          : "text-slate-300 hover:text-white bg-slate-900/50 border border-slate-800"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                );
              })}
            </div>

            {/* Mobile search */}
            <div className="pt-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Platoon records..."
                  value={searchQuery}
                  onChange={(e) => {
                    onSearch(e.target.value);
                    if (currentTab !== "directory") {
                      onChangeTab("directory");
                    }
                  }}
                  className="bg-[#0E1A2B] border border-[#22324A] rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-[#FFB400] w-full text-slate-100 placeholder-slate-400 font-mono"
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {user && (
              <div className="pt-3 border-t border-[#22324A] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Logged in as</div>
                  <div className="text-xs font-bold text-amber-400 font-mono">{user.email}</div>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-1.5 text-red-400 hover:text-red-300 text-xs font-mono font-bold bg-red-950/40 border border-red-800/40 px-3 py-1.5 rounded-lg"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>LOGOUT</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
})

export default Header;
