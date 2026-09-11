import React from "react";
import { 
  Settings, Image as ImageIcon, Upload, Link as LinkIcon, Save, HelpCircle, 
  FileText, CheckCircle2, AlertTriangle, X 
} from "lucide-react";
import { User } from "../../types";
import { getSingleDocument, setSingleDocument, generateId } from "../../firebaseService";
import { updateEmail, updatePassword } from "firebase/auth";
import { auth } from "../../firebase";

interface CmsSettingsPanelProps {
  onRefresh: () => void;
  currentUser: User | null;
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

export default function CmsSettingsPanel({ onRefresh, currentUser }: CmsSettingsPanelProps) {
  const [subTab, setSubTab] = React.useState<"homepage" | "about" | "contact" | "security">("homepage");
  const [loading, setLoading] = React.useState(false);
  const [fetching, setFetching] = React.useState(false);

  // States for forms
  const [homepage, setHomepage] = React.useState({
    heroTitle: "",
    heroSubtitle: "",
    heroBgUrl: "",
    heroBgOption: "url" as "upload" | "url",
    paragraphDescription: "",
    mottoEnglish: "Knowledge, Discipline, Unity",
    mottoBengali: "জ্ঞান, শৃঙ্খলা, একতা",
  });

  const [about, setAbout] = React.useState({
    historyP1: "",
    historyP2: "",
    oath: "",
    objectivesText: "",
  });

  const [contact, setContact] = React.useState({
    location: "",
    phone: "",
    email: "",
    timings: "",
    legalNotice: "",
  });

  // Security settings
  const [securityEmail, setSecurityEmail] = React.useState(currentUser?.email || "");
  const [securityPassword, setSecurityPassword] = React.useState("");
  const [securityConfirmPassword, setSecurityConfirmPassword] = React.useState("");

  // Toasts & Confirmations
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmConfig | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = generateId("tst");
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Load Initial Settings
  React.useEffect(() => {
    if (currentUser?.email) {
      setSecurityEmail(currentUser.email);
    }
    setFetching(true);

    const loadData = async () => {
      try {
        const homeData = await getSingleDocument("homepage", "main");
        if (homeData) {
          setHomepage({
            heroTitle: homeData.heroTitle || "LEADERS OF TOMORROW",
            heroSubtitle: homeData.heroSubtitle || "UGC BNCC Platoon under 3 Ramna Battalion",
            heroBgUrl: homeData.heroBgUrl || "",
            heroBgOption: homeData.heroBgOption || "url",
            paragraphDescription: homeData.paragraphDescription || "",
            mottoEnglish: homeData.mottoEnglish || "Knowledge, Discipline, Unity",
            mottoBengali: homeData.mottoBengali || "জ্ঞান, শৃঙ্খলা, একতা",
          });
        }

        const aboutData = await getSingleDocument("settings", "about");
        if (aboutData) {
          setAbout({
            historyP1: aboutData.historyP1 || "",
            historyP2: aboutData.historyP2 || "",
            oath: aboutData.oath || "",
            objectivesText: aboutData.objectivesText || "",
          });
        }

        const contactData = await getSingleDocument("settings", "contact");
        if (contactData) {
          setContact({
            location: contactData.location || "",
            phone: contactData.phone || "",
            email: contactData.email || "",
            timings: contactData.timings || "",
            legalNotice: contactData.legalNotice || "",
          });
        }
      } catch (err: any) {
        console.error("Error loading settings:", err);
        showToast("Error retrieving CMS documents", "error");
      } finally {
        setFetching(false);
      }
    };

    loadData();
  }, [currentUser]);

  const handleSaveHomepage = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setSingleDocument("homepage", "main", homepage);
      showToast("Homepage configurations saved successfully!", "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAbout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setSingleDocument("settings", "about", about);
      showToast("About page contents updated successfully!", "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setSingleDocument("settings", "contact", contact);
      showToast("Contact details and helpdesk numbers committed!", "success");
      onRefresh();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();

    if (securityPassword && securityPassword !== securityConfirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    setConfirmDialog({
      title: "Update Administrator Credentials",
      message: "Are you sure you want to modify your system login email/password? You will need to use these credentials on your next login.",
      onConfirm: async () => {
        setConfirmDialog(null);
        setLoading(true);
        try {
          if (auth.currentUser) {
            if (securityEmail && securityEmail !== auth.currentUser.email) {
              await updateEmail(auth.currentUser, securityEmail);
            }
            if (securityPassword) {
              await updatePassword(auth.currentUser, securityPassword);
            }
            showToast("Login credentials updated successfully!", "success");
            setSecurityPassword("");
            setSecurityConfirmPassword("");
            onRefresh();
          } else {
            throw new Error("No active authenticated session detected.");
          }
        } catch (err: any) {
          showToast(err.message, "error");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const triggerMockUpload = () => {
    showToast("Please enter an image URL or upload an image file using the Upload tool below.", "info");
  };

  return (
    <div id="cms-settings-panel" className="space-y-6 text-xs relative">
      {/* Toast Alert elements */}
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

      {/* Confirmation Overlays */}
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
                CONFIRM CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Top Title Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex justify-between items-center shadow-sm">
        <div>
          <h3 className="font-display font-black text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
            <Settings className="h-4.5 w-4.5 text-slate-800 dark:text-amber-500" />
            <span>Platform CMS Configuration Control</span>
          </h3>
          <p className="text-slate-400 text-[10px] mt-0.5 uppercase font-mono">
            Dynamically update page headlines, background banners, helpdesk telephone hotlines, and legal notices.
          </p>
        </div>
      </div>

      {/* Sub menu tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 font-mono text-[10px] uppercase font-bold tracking-wider">
        <button
          onClick={() => setSubTab("homepage")}
          className={`px-4 py-2 border-b-2 cursor-pointer transition-all ${
            subTab === "homepage"
              ? "border-amber-500 text-slate-900 dark:text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          // HOMEPAGE
        </button>
        <button
          onClick={() => setSubTab("about")}
          className={`px-4 py-2 border-b-2 cursor-pointer transition-all ${
            subTab === "about"
              ? "border-amber-500 text-slate-900 dark:text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          // ABOUT PAGE
        </button>
        <button
          onClick={() => setSubTab("contact")}
          className={`px-4 py-2 border-b-2 cursor-pointer transition-all ${
            subTab === "contact"
              ? "border-amber-500 text-slate-900 dark:text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          // CONTACT & FOOTER
        </button>
        <button
          onClick={() => setSubTab("security")}
          className={`px-4 py-2 border-b-2 cursor-pointer transition-all ${
            subTab === "security"
              ? "border-amber-500 text-slate-900 dark:text-amber-500"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          // SECURITY & CREDENTIALS
        </button>
      </div>

      {/* Panels Content */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        {fetching ? (
          <div className="space-y-4 py-10 animate-pulse">
            <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-1/3"></div>
            <div className="space-y-2">
              <div className="h-10 bg-slate-50 dark:bg-slate-850 border border-slate-100 rounded"></div>
              <div className="h-20 bg-slate-50 dark:bg-slate-850 border border-slate-100 rounded"></div>
            </div>
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded w-1/4 self-end"></div>
          </div>
        ) : (
          <>
            {/* HOMEPAGE SETTINGS */}
            {subTab === "homepage" && (
              <form onSubmit={handleSaveHomepage} className="space-y-5">
                <h4 className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 text-[11px]">
                  Configure Portal Hero section & Motto
                </h4>

                <div className="space-y-2">
                  <label className="font-mono text-slate-500 uppercase text-[9.5px]">Hero Banner Image Background</label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setHomepage({ ...homepage, heroBgOption: "upload" })}
                      className={`px-4 py-1.5 rounded font-mono text-[10px] uppercase font-bold flex items-center space-x-1 cursor-pointer border ${
                        homepage.heroBgOption === "upload"
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500"
                          : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-850 dark:border-slate-800"
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Upload Image</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHomepage({ ...homepage, heroBgOption: "url" })}
                      className={`px-4 py-1.5 rounded font-mono text-[10px] uppercase font-bold flex items-center space-x-1 cursor-pointer border ${
                        homepage.heroBgOption === "url"
                          ? "bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500"
                          : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-850 dark:border-slate-800"
                      }`}
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      <span>Paste URL Link</span>
                    </button>
                  </div>

                  {homepage.heroBgOption === "upload" ? (
                    <div
                      onClick={triggerMockUpload}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-850/20 transition-all flex flex-col items-center justify-center space-y-2"
                    >
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                      <span className="font-bold text-slate-700 dark:text-slate-300">Click or Drag Image to upload</span>
                      <span className="text-[10px] text-slate-400 font-mono uppercase">Supports high-res PNG/JPG</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="https://example.com/photo.jpg"
                      value={homepage.heroBgUrl}
                      onChange={(e) => setHomepage({ ...homepage, heroBgUrl: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  )}

                  {homepage.heroBgUrl && (
                    <div className="relative h-20 w-44 rounded-lg overflow-hidden border border-slate-200 mt-2">
                      <img src={homepage.heroBgUrl} alt="Hero banner preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Hero Title Headline</label>
                    <input
                      type="text"
                      required
                      value={homepage.heroTitle}
                      onChange={(e) => setHomepage({ ...homepage, heroTitle: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Hero Subtitle Subheadline</label>
                    <input
                      type="text"
                      required
                      value={homepage.heroSubtitle}
                      onChange={(e) => setHomepage({ ...homepage, heroSubtitle: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Motto English Translation</label>
                    <input
                      type="text"
                      required
                      value={homepage.mottoEnglish}
                      onChange={(e) => setHomepage({ ...homepage, mottoEnglish: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Motto Bengali Translation</label>
                    <input
                      type="text"
                      required
                      value={homepage.mottoBengali}
                      onChange={(e) => setHomepage({ ...homepage, mottoBengali: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9.5px]">Mission Statement Description</label>
                  <textarea
                    required
                    value={homepage.paragraphDescription}
                    onChange={(e) => setHomepage({ ...homepage, paragraphDescription: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-24 resize-none focus:border-amber-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 px-5 py-2.5 rounded-lg font-mono font-black uppercase text-[10px] tracking-wider flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow"
                  >
                    <Save className="h-4 w-4" />
                    <span>{loading ? "SAVING..." : "Save Homepage"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* ABOUT PAGE SETTINGS */}
            {subTab === "about" && (
              <form onSubmit={handleSaveAbout} className="space-y-5">
                <h4 className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 text-[11px]">
                  Configure Platoon History & Cadet Oath
                </h4>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9.5px]">History Paragraph 1 (Platoon Origins)</label>
                  <textarea
                    required
                    placeholder="Insert the history of the Uttara Government College Platoon origins..."
                    value={about.historyP1}
                    onChange={(e) => setAbout({ ...about, historyP1: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-24 resize-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9.5px]">History Paragraph 2 (Modern Command accomplishments)</label>
                  <textarea
                    required
                    placeholder="Insert paragraphs highlighting current campouts, drills, and operations..."
                    value={about.historyP2}
                    onChange={(e) => setAbout({ ...about, historyP2: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-24 resize-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9.5px]">Cadet Oath of Honor Text</label>
                  <textarea
                    required
                    placeholder="Insert the official Bangladesh National Cadet Corps Cadet Oath..."
                    value={about.oath}
                    onChange={(e) => setAbout({ ...about, oath: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-20 resize-none font-sans italic focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9.5px]">Core Objectives (Enter each objective on a new line)</label>
                  <textarea
                    required
                    placeholder="To develop leadership and character...&#10;To render assistance during disasters..."
                    value={about.objectivesText}
                    onChange={(e) => setAbout({ ...about, objectivesText: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-24 resize-none font-mono"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 px-5 py-2.5 rounded-lg font-mono font-black uppercase text-[10px] tracking-wider flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow"
                  >
                    <Save className="h-4 w-4" />
                    <span>{loading ? "SAVING..." : "Save About Page"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* CONTACT & FOOTER SETTINGS */}
            {subTab === "contact" && (
              <form onSubmit={handleSaveContact} className="space-y-5">
                <h4 className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 text-[11px]">
                  Configure Platoon Contacts, Working Hours & Footer Notices
                </h4>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase text-[9.5px]">HQ Physical Location</label>
                  <textarea
                    required
                    value={contact.location}
                    onChange={(e) => setContact({ ...contact, location: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-16 resize-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Telephone/Hotlines (Enter on new line)</label>
                    <textarea
                      required
                      value={contact.phone}
                      onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none h-16 resize-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Official email inbox address</label>
                    <input
                      type="email"
                      required
                      value={contact.email}
                      onChange={(e) => setContact({ ...contact, email: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Working Office Timings</label>
                    <input
                      type="text"
                      required
                      value={contact.timings}
                      onChange={(e) => setContact({ ...contact, timings: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">Command Legal Notice footer paragraph</label>
                    <input
                      type="text"
                      required
                      value={contact.legalNotice}
                      onChange={(e) => setContact({ ...contact, legalNotice: e.target.value })}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 px-5 py-2.5 rounded-lg font-mono font-black uppercase text-[10px] tracking-wider flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow"
                  >
                    <Save className="h-4 w-4" />
                    <span>{loading ? "SAVING..." : "Save Helpdesk & Footer"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* SECURITY & CREDENTIALS SETTINGS */}
            {subTab === "security" && (
              <form onSubmit={handleSaveSecurity} className="space-y-5">
                <h4 className="font-display font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2 text-[11px]">
                  CHANGE LOGIN CREDENTIALS
                </h4>

                <div className="space-y-4 max-w-md">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">LOGIN USERNAME / EMAIL ADDRESS</label>
                    <input
                      type="email"
                      required
                      value={securityEmail}
                      onChange={(e) => setSecurityEmail(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                      placeholder="e.g., admin@ugcbncc.org"
                    />
                    <p className="text-[9px] text-slate-400 italic">
                      This email is your unique login username for accessing the command CMS.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">NEW SECURE PASSWORD (OPTIONAL)</label>
                    <input
                      type="password"
                      value={securityPassword}
                      onChange={(e) => setSecurityPassword(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                      placeholder="••••••••"
                    />
                    <p className="text-[9px] text-slate-400 italic">
                      Leave empty if you do not wish to modify your existing password.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase text-[9.5px]">CONFIRM NEW PASSWORD</label>
                    <input
                      type="password"
                      value={securityConfirmPassword}
                      onChange={(e) => setSecurityConfirmPassword(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                      placeholder="••••••••"
                      required={!!securityPassword}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 px-5 py-2.5 rounded-lg font-mono font-black uppercase text-[10px] tracking-wider flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 shadow"
                  >
                    <Save className="h-4 w-4" />
                    <span>{loading ? "SAVING..." : "Update Credentials"}</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
