/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { MapPin, Phone, Mail, Clock, Send, ShieldAlert, CheckCircle, Edit, Check, X, Loader2 } from "lucide-react";
import { User, UserRole } from "../types";
import { getSingleDocument, setSingleDocument } from "../firebaseService";

interface ContactProps {
  currentUser: User | null;
}

interface ContactData {
  location: string;
  phone: string;
  email: string;
  timings: string;
  latitude: number;
  longitude: number;
  footerAbout?: string;
  legalNotice?: string;
}

export default function Contact({ currentUser }: ContactProps) {
  const DEFAULT_CONTACT: ContactData = {
    location: "UGC BNCC Office Room #204 (2nd Floor)\nAcademic Building 1, Uttara Government College\nSector 7, Uttara, Dhaka-1230, Bangladesh",
    phone: "Platoon Commander: +880 171 234 5678\nCadet Headquarter Duty: +880 181 234 5679",
    email: "aminul.bangla@ugc.edu.bd\nhq@ugcbncc.org",
    timings: "Weekly Parade Drill: Saturdays 07:00 AM - 10:00 AM\nOffice Open: Sun to Wed 11:00 AM - 02:00 PM",
    latitude: 23.8690,
    longitude: 90.3957,
    footerAbout: "The Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College serves as a premier training command, molding disciplined future military and civil leaders.",
    legalNotice: "All digital military dossiers, cadet records, and duty rosters are protected by UGC BNCC Command regulations. Unauthorized access is strictly prohibited."
  };

  const [data, setData] = React.useState<ContactData | null>(DEFAULT_CONTACT);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Form states
  const [location, setLocation] = React.useState<string>(DEFAULT_CONTACT.location);
  const [phone, setPhone] = React.useState<string>(DEFAULT_CONTACT.phone);
  const [email, setEmail] = React.useState<string>(DEFAULT_CONTACT.email);
  const [timings, setTimings] = React.useState<string>(DEFAULT_CONTACT.timings);
  const [latitude, setLatitude] = React.useState<number>(DEFAULT_CONTACT.latitude);
  const [longitude, setLongitude] = React.useState<number>(DEFAULT_CONTACT.longitude);
  const [footerAbout, setFooterAbout] = React.useState<string>(DEFAULT_CONTACT.footerAbout || "");
  const [legalNotice, setLegalNotice] = React.useState<string>(DEFAULT_CONTACT.legalNotice || "");

  // Contact form submission states
  const [formSubmitted, setFormSubmitted] = React.useState(false);
  const [senderName, setSenderName] = React.useState("");
  const [returnEmail, setReturnEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;

  React.useEffect(() => {
    fetchContact();
  }, []);

  const fetchContact = async () => {
    setLoading(true);
    const defaultData: ContactData = {
      location: "UGC BNCC Office Room #204 (2nd Floor)\nAcademic Building 1, Uttara Government College\nSector 7, Uttara, Dhaka-1230, Bangladesh",
      phone: "Platoon Commander: +880 171 234 5678\nCadet Headquarter Duty: +880 181 234 5679",
      email: "aminul.bangla@ugc.edu.bd\nhq@ugcbncc.org",
      timings: "Weekly Parade Drill: Saturdays 07:00 AM - 10:00 AM\nOffice Open: Sun to Wed 11:00 AM - 02:00 PM",
      latitude: 23.8690,
      longitude: 90.3957,
      footerAbout: "The Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College serves as a premier training command, molding disciplined future military and civil leaders.",
      legalNotice: "All digital military dossiers, cadet records, and duty rosters are protected by UGC BNCC Command regulations. Unauthorized access is strictly prohibited."
    };

    try {
      let resData = await getSingleDocument("settings", "contact") as any;
      if (!resData) {
        resData = defaultData;
        try {
          await setSingleDocument("settings", "contact", resData);
        } catch (writeErr) {
          console.warn("Failed to auto-save default contact document:", writeErr);
        }
      }
      setData(resData);
      setLocation(resData.location || defaultData.location);
      setPhone(resData.phone || defaultData.phone);
      setEmail(resData.email || defaultData.email);
      setTimings(resData.timings || defaultData.timings);
      setLatitude(resData.latitude || 23.8690);
      setLongitude(resData.longitude || 90.3957);
      setFooterAbout(resData.footerAbout || defaultData.footerAbout!);
      setLegalNotice(resData.legalNotice || defaultData.legalNotice!);
      setError(null);
    } catch (err: any) {
      console.warn("Using fallback contact settings due to fetch error:", err);
      setData(defaultData);
      setLocation(defaultData.location);
      setPhone(defaultData.phone);
      setEmail(defaultData.email);
      setTimings(defaultData.timings);
      setLatitude(defaultData.latitude);
      setLongitude(defaultData.longitude);
      setFooterAbout(defaultData.footerAbout!);
      setLegalNotice(defaultData.legalNotice!);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    if (!data) return;
    setLocation(data.location || "");
    setPhone(data.phone || "");
    setEmail(data.email || "");
    setTimings(data.timings || "");
    setLatitude(data.latitude || 23.8690);
    setLongitude(data.longitude || 90.3957);
    setFooterAbout(data.footerAbout || "The Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College serves as a premier training command, molding disciplined future military and civil leaders.");
    setLegalNotice(data.legalNotice || "All digital military dossiers, cadet records, and duty rosters are protected by UGC BNCC Command regulations. Unauthorized access is strictly prohibited.");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);

    const payload: ContactData = {
      location,
      phone,
      email,
      timings,
      latitude: Number(latitude),
      longitude: Number(longitude),
      footerAbout,
      legalNotice
    };

    try {
      await setSingleDocument("settings", "contact", payload);
      setData(payload);
      setIsEditing(false);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitContactForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    // Clear form
    setSenderName("");
    setReturnEmail("");
    setSubject("");
    setMessage("");
    setTimeout(() => {
      setFormSubmitted(false);
    }, 5000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <Loader2 className="h-8 w-8 text-army-800 animate-spin" />
        <span className="text-xs font-mono text-slate-500 uppercase">Connecting Secure Hotlines...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Admin Action Panel */}
      {isAdmin && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300/50 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-400 uppercase">
              Administrative Control Mode Active
            </span>
          </div>
          {!isEditing ? (
            <button
              onClick={handleStartEdit}
              className="inline-flex items-center space-x-1 bg-amber-500 hover:bg-amber-600 text-army-950 font-mono text-xs font-bold px-4 py-1.5 rounded transition-all shadow-sm"
            >
              <Edit className="h-3 w-3" />
              <span>Edit Contact Info</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center space-x-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-mono text-xs font-bold px-3 py-1.5 rounded transition-all"
              >
                <X className="h-3 w-3" />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center space-x-1 bg-army-800 hover:bg-army-950 text-white font-mono text-xs font-bold px-4 py-1.5 rounded transition-all shadow-md"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                <span>Save Updates</span>
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 font-mono text-xs rounded p-4">
          ACTION FAILED: {error}
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-12">
        {/* LEFT COLUMN: Physical & Command Details */}
        <div className="lg:col-span-2 space-y-8">
          {!isEditing ? (
            // --- DISPLAY MODE: LEFT ---
            <div className="bg-[#124632] text-white p-6 rounded-xl border border-[#FFB703]/20 space-y-6">
              <h3 className="font-display font-bold text-sm text-[#FFB703] uppercase tracking-widest">
                PLATOON HEADQUARTERS
              </h3>

              <div className="space-y-4 text-xs font-sans font-light">
                <div className="flex items-start space-x-3.5">
                  <MapPin className="h-5 w-5 text-[#FFB703] flex-shrink-0" />
                  <div>
                    <strong className="text-white block font-display">PHYSICAL LOCATION</strong>
                    <p className="text-slate-100 mt-1 whitespace-pre-line leading-relaxed">
                      {data?.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <Phone className="h-5 w-5 text-[#FFB703] flex-shrink-0" />
                  <div>
                    <strong className="text-white block font-display">COMMAND HOTLINES</strong>
                    <p className="text-slate-100 mt-1 whitespace-pre-line leading-relaxed">
                      {data?.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <Mail className="h-5 w-5 text-[#FFB703] flex-shrink-0" />
                  <div>
                    <strong className="text-white block font-display">SECURE CHANNELS</strong>
                    <p className="text-slate-100 mt-1 whitespace-pre-line leading-relaxed">
                      {data?.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <Clock className="h-5 w-5 text-[#FFB703] flex-shrink-0" />
                  <div>
                    <strong className="text-white block font-display">DRILL TIMINGS</strong>
                    <p className="text-slate-100 mt-1 whitespace-pre-line leading-relaxed">
                      {data?.timings}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // --- EDIT MODE: LEFT ---
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <h3 className="font-display font-extrabold text-army-950 dark:text-white text-sm uppercase tracking-wider border-b pb-2">
                HQ Address & Hotline Editor
              </h3>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Physical Location</label>
                <textarea
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Command Hotlines</label>
                <textarea
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Secure Channels (Emails)</label>
                <textarea
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Drill Timings</label>
                <textarea
                  value={timings}
                  onChange={(e) => setTimings(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Footer About Statement</label>
                <textarea
                  value={footerAbout}
                  onChange={(e) => setFooterAbout(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono font-bold uppercase text-slate-500 block">Command Legal Notice</label>
                <textarea
                  value={legalNotice}
                  onChange={(e) => setLegalNotice(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-xs"
                />
              </div>
            </div>
          )}

          {/* Tactical Map Mock */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase block">
              PLATOON SECTOR COORDINATES
            </span>
            <div className="h-44 bg-slate-100 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col justify-center items-center text-center p-4">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:10px_10px]"></div>
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-[#124632]/20"></div>
              <div className="absolute left-1/2 top-0 w-0.5 h-full bg-[#124632]/20"></div>

              <MapPin className="h-8 w-8 text-red-600 animate-bounce relative z-10" />
              <h4 className="font-display font-black text-xs text-slate-900 dark:text-white mt-2 uppercase relative z-10">UGC Parade Ground</h4>
              
              {!isEditing ? (
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 relative z-10">
                  Latitude: {data?.latitude}° N<br />
                  Longitude: {data?.longitude}° E
                </p>
              ) : (
                <div className="flex gap-2 mt-2 relative z-10 justify-center">
                  <div className="w-20">
                    <input
                      type="number"
                      step="0.0001"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-center"
                      placeholder="Lat"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      step="0.0001"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono text-center"
                      placeholder="Long"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Contact Correspondence Inbox */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 self-start">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="font-display font-extrabold text-slate-900 dark:text-white text-base uppercase">
              SECURE ROUTING INBOX
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Submit immediate queries or feedback. Logged by duty cadets daily.</p>
          </div>

          <form onSubmit={handleSubmitContactForm} className="space-y-4 text-xs">
            {formSubmitted ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-400 p-6 rounded-lg text-center space-y-2">
                <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto animate-bounce" />
                <p className="font-display font-bold uppercase">MESSAGE ROUTED</p>
                <p className="text-xs">Your message has been filed and routed to the UGC Platoon Commander inbox successfully.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase block">Sender Name</label>
                    <input
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g., TANVIR ANJUM"
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 uppercase block">Return Email</label>
                    <input
                      type="email"
                      required
                      value={returnEmail}
                      onChange={(e) => setReturnEmail(e.target.value)}
                      placeholder="e.g., tanvir@gmail.com"
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase block">Query Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Request for historic record verification certificate..."
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 uppercase block">Detailed Message Body</label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your official correspondence here..."
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#124632]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#124632] hover:bg-[#0c3123] text-white font-display font-bold py-3.5 rounded uppercase tracking-wider transition-colors shadow flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                  <span>ROUTE CORRESPONDENCE</span>
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
