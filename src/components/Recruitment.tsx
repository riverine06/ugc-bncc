/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion } from "motion/react";
import {
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  MapPin,
  CheckCircle,
  FileText,
  Clock,
  Briefcase,
  AlertTriangle,
  UploadCloud,
  User,
  Phone,
  Mail,
  Home,
  BookOpen,
  Calendar,
  Award,
  Compass,
  Loader2,
} from "lucide-react";
import { BNCCRank, Camp, ApplicationCampParticipation } from "../types";
import { generateId, createDocument, subscribeToCollection } from "../firebaseService";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { processAndUploadImage } from "../utils/imageUtils";

export default function Recruitment() {
  const [formType, setFormType] = React.useState<"recruit" | "cadet" | "alumni">("recruit");

  // Form Fields State
  const [formData, setFormData] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    address: "",
    department: "",
    session: "",
    joiningYear: new Date().getFullYear().toString(),
    graduationYear: "",
    highestRank: "Recruit",
    currentProfession: "",
    currentOrganization: "",
    currentCity: "",
    pastAchievements: "",
    campHistory: "",
    photoUrl: "",
    bloodGroup: "O+",
    cadetId: "",
  });

  const [loading, setLoading] = React.useState(false);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const [success, setSuccess] = React.useState<"recruit" | "cadet" | "alumni" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);

  // Admin-registered Camps & Applicant Selections
  const [availableCamps, setAvailableCamps] = React.useState<Camp[]>([]);
  const [selectedCamps, setSelectedCamps] = React.useState<Record<string, ApplicationCampParticipation>>({});

  React.useEffect(() => {
    const unsub = subscribeToCollection<Camp>("camps", (data) => {
      setAvailableCamps(data);
    });
    return () => unsub();
  }, []);

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (file && file.type.startsWith("image/")) {
      try {
        setPhotoUploading(true);
        setError(null);
        const photoUrl = await processAndUploadImage(file, "applications", 600, 0.75);
        setFormData((prev) => ({ ...prev, photoUrl }));
      } catch (err: any) {
        alert("Failed to process photo: " + (err?.message || err));
      } finally {
        setPhotoUploading(false);
      }
    } else {
      alert("Invalid file type. Please upload a JPEG, PNG, or WEBP image.");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const emailClean = formData.email.trim().toLowerCase();
    const phoneClean = formData.phone.trim();
    const fullNameClean = formData.fullName.trim().toUpperCase();

    // Build payload without undefined properties to avoid Firestore serialization errors
    const payload: any = {
      fullName: fullNameClean,
      email: emailClean,
      phone: phoneClean,
      address: formData.address || "",
      department: formData.department || "",
      session: formData.session || "",
      joiningYear: Number(formData.joiningYear || new Date().getFullYear()),
      highestRank: formData.highestRank || "Recruit",
      currentProfession: formData.currentProfession || "",
      currentOrganization: formData.currentOrganization || "",
      currentCity: formData.currentCity || "",
      pastAchievements: formData.pastAchievements || "",
      campHistory: formData.campHistory || "",
      photoUrl: formData.photoUrl || "",
      bloodGroup: formData.bloodGroup || "O+",
      type: formType === "recruit" ? "Recruit" : (formType === "cadet" ? "Cadet" : "Alumni"),
    };

    if (formType === "cadet" && formData.cadetId) {
      payload.cadetId = formData.cadetId.trim();
    }

    if (formType === "alumni" && formData.graduationYear) {
      payload.graduationYear = Number(formData.graduationYear);
    }

    // Process Camp Participation Selection for Cadet & Alumni forms
    if (formType === "cadet" || formType === "alumni") {
      const campList: ApplicationCampParticipation[] = Object.values(selectedCamps);
      for (const c of campList) {
        if (!c.role || !c.role.trim()) {
          throw new Error(`Please specify your role for the selected camp: "${c.campName}".`);
        }
      }
      if (campList.length > 0) {
        payload.campsParticipation = campList;
        const campSummary = campList
          .map((c) => `${c.campName} (Role: ${c.role}${c.achievements ? `, Award: ${c.achievements}` : ""})`)
          .join("; ");
        if (formData.campHistory) {
          payload.campHistory = `${formData.campHistory}\n[Registered Camps]: ${campSummary}`;
        } else {
          payload.campHistory = campSummary;
        }
      }
    }

    try {
      setError(null);

      // 1. Mandatory client-side field validation
      if (!fullNameClean) {
        throw new Error("Full name is strictly required and cannot be empty.");
      }
      if (!emailClean) {
        throw new Error("Primary email address is strictly required.");
      }
      if (!phoneClean) {
        throw new Error("Phone contact number is strictly required.");
      }
      if (!formData.photoUrl) {
        throw new Error("Official profile photograph file upload is strictly required.");
      }

      // 2. Prevent duplicate applications by email in active applications queue (if authenticated)
      if (auth.currentUser) {
        try {
          const appEmailQuery = query(collection(db, "applications"), where("email", "==", emailClean));
          const appEmailSnap = await getDocs(appEmailQuery);
          if (!appEmailSnap.empty) {
            throw new Error("A pending platoon join application has already been submitted with this email address.");
          }
        } catch (err: any) {
          if (err?.message?.includes("already been submitted")) {
            throw err;
          }
          // Bypassed if permission denied for guest applicants
        }

        // 3. Prevent duplicate applications by phone in active applications queue (if authenticated)
        try {
          const appPhoneQuery = query(collection(db, "applications"), where("phone", "==", phoneClean));
          const appPhoneSnap = await getDocs(appPhoneQuery);
          if (!appPhoneSnap.empty) {
            throw new Error("A pending platoon join application has already been submitted with this phone number.");
          }
        } catch (err: any) {
          if (err?.message?.includes("already been submitted")) {
            throw err;
          }
          // Bypassed if permission denied for guest applicants
        }
      }

      // 4. Prevent duplicate registration of existing active cadets by email
      const cadetEmailQuery = query(collection(db, "cadets"), where("email", "==", emailClean));
      const cadetEmailSnap = await getDocs(cadetEmailQuery);
      if (!cadetEmailSnap.empty) {
        throw new Error("This email is already registered to an active cadet in the official platoon roster.");
      }

      // 5. Prevent duplicate registration of existing active cadets by phone
      const cadetPhoneQuery = query(collection(db, "cadets"), where("phone", "==", phoneClean));
      const cadetPhoneSnap = await getDocs(cadetPhoneQuery);
      if (!cadetPhoneSnap.empty) {
        throw new Error("This phone contact number is already registered to an active cadet in the official platoon roster.");
      }

      // 6. If active cadet form, check if cadetId already exists in roster
      if (formType === "cadet" && formData.cadetId) {
        const cadetIdClean = formData.cadetId.trim();
        const cadetIdQuery = query(collection(db, "cadets"), where("id", "==", cadetIdClean));
        const cadetIdSnap = await getDocs(cadetIdQuery);
        if (!cadetIdSnap.empty) {
          throw new Error(`A cadet profile with ID "${cadetIdClean}" is already registered in the platoon roster.`);
        }
      }

      const id = generateId("app");
      const appData = {
        id,
        ...payload,
        status: "Pending",
        submittedAt: new Date().toISOString()
      };
      await createDocument("applications", appData, id);
      setSuccess(formType);
      setLoading(false);
      // Reset Form Data
      setSelectedCamps({});
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        department: "",
        session: "",
        joiningYear: new Date().getFullYear().toString(),
        graduationYear: "",
        highestRank: "Recruit",
        currentProfession: "",
        currentOrganization: "",
        currentCity: "",
        pastAchievements: "",
        campHistory: "",
        photoUrl: "",
        bloodGroup: "O+",
        cadetId: "",
      });
    } catch (err: any) {
      setError(err.message || "An error occurred while submitting your application.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-5 gap-8">
      {/* LEFT COLUMN (Lg: col-span-2): Standards & Process Pipelines */}
      <div className="lg:col-span-2 space-y-6 self-start">
        {/* Eligibility Standards */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-army-950 dark:text-amber-400">
            <ShieldAlert className="h-5 w-5 text-army-700 dark:text-amber-500" />
            <h3 className="font-display font-extrabold uppercase text-sm tracking-wide">
              ELIGIBILITY STANDARDS
            </h3>
          </div>
          <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
            <div>
              <strong className="text-slate-900 dark:text-slate-100 block">1. Academic Parameters:</strong>
              <p>Must be currently enrolled in Uttara Government College (Intermediate, Degree, or Honors program).</p>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-slate-100 block">2. Physical Heights:</strong>
              <ul className="list-disc list-inside pl-1 space-y-1 mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                <li>Male Cadets: Min 5 ft 6 inches</li>
                <li>Female Cadets: Min 5 ft 2 inches</li>
              </ul>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-slate-100 block">3. Health Standard:</strong>
              <p>Excellent physical stamina, clear medical files, and unwavering dedication to parade ground training sessions.</p>
            </div>
          </div>
        </div>

        {/* Joining Procedure */}
        <div className="bg-army-900 text-white p-6 rounded-xl border border-amber-500/20 space-y-4">
          <h3 className="font-display font-bold text-sm text-amber-400 uppercase tracking-wide">
            JOINING PROCEDURE PIPELINE
          </h3>
          <div className="space-y-4 font-mono text-[11px] text-army-100">
            <div className="flex items-start space-x-3">
              <span className="bg-amber-500 text-army-950 rounded-full h-5 w-5 flex items-center justify-center font-bold flex-shrink-0">
                1
              </span>
              <div>
                <strong className="text-white block uppercase">Digital Registration</strong>
                <span className="text-[10px] text-army-300">Submit the adjacent form based on your status (Recruit, Running Cadet, or Alumni).</span>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <span className="bg-amber-500 text-army-950 rounded-full h-5 w-5 flex items-center justify-center font-bold flex-shrink-0">
                2
              </span>
              <div>
                <strong className="text-white block uppercase">Physical Screening</strong>
                <span className="text-[10px] text-army-300">Report to the college parade ground for physical fitness and endurance evaluation.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <span className="bg-amber-500 text-army-950 rounded-full h-5 w-5 flex items-center justify-center font-bold flex-shrink-0">
                3
              </span>
              <div>
                <strong className="text-white block uppercase">Viva & Clearance</strong>
                <span className="text-[10px] text-army-300">Oral examination panel conducted by PUO and senior Regiment leadership.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN (Lg: col-span-3): Form Controls */}
      <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        {/* Toggle form type */}
        <div className="flex flex-col space-y-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <h3 className="font-display font-extrabold text-army-950 dark:text-slate-100 text-base uppercase">
              PLATOON REGISTRATION DESK
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Submit your registration request. All entries require platoon administrative clearance.
            </p>
          </div>

          <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded font-mono text-xs font-bold border border-slate-200 dark:border-slate-800 flex w-full">
            <button
              type="button"
              onClick={() => {
                setFormType("recruit");
                setSelectedCamps({});
                setSuccess(null);
                setError(null);
              }}
              className={`flex-1 text-center py-2.5 rounded transition-all cursor-pointer font-bold ${
                formType === "recruit"
                  ? "bg-army-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Recruit
            </button>
            <button
              type="button"
              onClick={() => {
                setFormType("cadet");
                setSelectedCamps({});
                setSuccess(null);
                setError(null);
              }}
              className={`flex-1 text-center py-2.5 rounded transition-all cursor-pointer font-bold ${
                formType === "cadet"
                  ? "bg-army-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Running Cadet
            </button>
            <button
              type="button"
              onClick={() => {
                setFormType("alumni");
                setSelectedCamps({});
                setSuccess(null);
                setError(null);
              }}
              className={`flex-1 text-center py-2.5 rounded transition-all cursor-pointer font-bold ${
                formType === "alumni"
                  ? "bg-army-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              Alumni
            </button>
          </div>
        </div>

        {/* Dynamic Forms Submission Panel */}
        {success ? (
          <div>
            {success === "recruit" && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-6 md:p-8 rounded-lg text-center space-y-4 shadow-sm">
                <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
                <h4 className="font-display font-black uppercase text-base tracking-wider">RECRUIT JOIN REGISTRATION RECEIVED</h4>
                <p className="text-xs leading-relaxed max-w-md mx-auto">
                  Your registration has been logged in the platoon recruitment database system.
                </p>
                <div className="bg-white dark:bg-slate-900/80 p-5 rounded border border-emerald-100 dark:border-emerald-950/80 text-left space-y-3 max-w-lg mx-auto shadow-sm">
                  <span className="font-mono text-[10px] text-amber-500 dark:text-amber-400 uppercase font-bold block tracking-wider">
                    ⚠️ MANDATORY NEXT STEPS
                  </span>
                  <p className="font-sans text-xs text-slate-700 dark:text-slate-300">
                    Please contact the <strong>Uttara Government College Platoon headquarters (Room 204)</strong> directly with the following physical documents:
                  </p>
                  <ul className="list-disc list-inside text-xs font-mono text-slate-600 dark:text-slate-400 pl-1 space-y-1.5">
                    <li>Original Birth Certificate</li>
                    <li>National ID Card (NID) of Parents</li>
                    <li>2 copies of passport-sized photographs</li>
                    <li>College Admission Slip (Proof of Student Enrollment)</li>
                  </ul>
                </div>
                <button
                  onClick={() => setSuccess(null)}
                  className="mt-2 text-xs font-mono font-bold uppercase underline text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Submit Another Application
                </button>
              </div>
            )}

            {success === "cadet" && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-6 md:p-8 rounded-lg text-center space-y-4 shadow-sm">
                <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
                <h4 className="font-display font-black uppercase text-base tracking-wider">CADET PROFILE SUBMITTED</h4>
                <p className="text-xs leading-relaxed max-w-md mx-auto">
                  Your active cadet registration request is now pending record validation.
                </p>
                <div className="bg-white dark:bg-slate-900/80 p-5 rounded border border-emerald-100 dark:border-emerald-950/80 text-left space-y-2 max-w-lg mx-auto shadow-sm">
                  <span className="font-mono text-[10px] text-amber-500 dark:text-amber-400 uppercase font-bold block tracking-wider">
                    PLATOON HEADQUARTERS QUEUE
                  </span>
                  <p className="font-sans text-xs text-slate-700 dark:text-slate-300">
                    Please report to Platoon HQ for record validation with your Cadet ID card or recruitment files.
                  </p>
                  <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Once verified by the platoon commander, you will be assigned a user login to manage your official achievements, track attendance logs, view rank promotions, and print verified certificates.
                  </p>
                </div>
                <button
                  onClick={() => setSuccess(null)}
                  className="mt-2 text-xs font-mono font-bold uppercase underline text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Submit Another Application
                </button>
              </div>
            )}

            {success === "alumni" && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-6 md:p-8 rounded-lg text-center space-y-4 shadow-sm">
                <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400 mx-auto animate-bounce" />
                <h4 className="font-display font-black uppercase text-base tracking-wider">ALUMNI CLAIM RECORD SUBMITTED</h4>
                <p className="text-xs leading-relaxed max-w-md mx-auto">
                  Your historical claim file has been transmitted to our archives desk.
                </p>
                <div className="bg-white dark:bg-slate-900/80 p-5 rounded border border-emerald-100 dark:border-emerald-950/80 text-left space-y-2 max-w-lg mx-auto shadow-sm">
                  <span className="font-mono text-[10px] text-amber-500 dark:text-amber-400 uppercase font-bold block tracking-wider">
                    ALUMNI VERIFICATION CYCLE
                  </span>
                  <p className="font-sans text-xs text-slate-700 dark:text-slate-300">
                    Your achievements, graduation timeline, and ranks will be cross-referenced with the physical platoon record books.
                  </p>
                  <p className="font-sans text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Upon approval by the Platoon Commander or PUO, your record will be fully verified, and your digital profile will appear in the public Alumni Directory.
                  </p>
                </div>
                <button
                  onClick={() => setSuccess(null)}
                  className="mt-2 text-xs font-mono font-bold uppercase underline text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                >
                  Submit Another Claim
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded-md flex items-start space-x-2 shadow-sm font-sans">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-mono text-[10px] text-red-600 dark:text-red-400 uppercase font-bold block tracking-wider">
                    TRANSMISSION FAILURE
                  </span>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            )}

            {/* PHOTO UPLOADER WITH DRAG AND DROP & CLICK (Universal for all three forms) */}
            <div className="space-y-1">
              <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block font-bold">
                Profile photograph (Official Cadet Profile Picture) <span className="text-red-500">*</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-5 text-center transition-all cursor-pointer ${
                  dragActive
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:border-slate-400 dark:hover:border-slate-600"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                {photoUploading ? (
                  <div className="flex flex-col items-center justify-center space-y-2 py-3">
                    <Loader2 className="h-6 w-6 text-amber-500 animate-spin" />
                    <p className="text-[10px] text-amber-500 font-mono font-bold uppercase tracking-wider">
                      PROCESSING & COMPRESSING PHOTO...
                    </p>
                  </div>
                ) : formData.photoUrl ? (
                  <div className="flex flex-col items-center space-y-2">
                    <img
                      src={formData.photoUrl}
                      alt="Cadet Preview"
                      className="h-20 w-20 rounded-full object-cover border-2 border-amber-500 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center justify-center">
                      <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-500" /> PHOTO LOADED SECURELY
                    </p>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, photoUrl: "" }))}
                      className="text-[10px] font-mono font-bold text-red-500 hover:text-red-600 uppercase underline cursor-pointer"
                    >
                      Remove & Upload Different Photo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto h-8 w-8 text-slate-400 dark:text-slate-600 flex items-center justify-center">
                      <UploadCloud className="h-8 w-8" />
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-xs">
                      <label className="relative cursor-pointer bg-white dark:bg-slate-800 rounded px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm">
                        <span>Select Photo file</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="sr-only"
                          required
                        />
                      </label>
                      <span className="pl-2">or drag and drop photo here</span>
                    </div>
                    <p className="text-[10px] text-slate-400">PNG, JPG or WEBP formats accepted</p>
                  </div>
                )}
              </div>
            </div>

            {/* General Common Fields: Name, Email, Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block font-bold">
                  Full Name (Capital Letters) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g., SHEIKH SADI"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-9 pr-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block font-bold">
                  Primary Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g., cadet@gmail.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-9 pr-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block font-bold">
                  Phone Contact Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g., +8801712345679"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-9 pr-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block font-bold">
                  Blood Group <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-700 dark:text-slate-200 focus:outline-none font-mono"
                >
                  <option value="A+">A+ (A Positive)</option>
                  <option value="A-">A- (A Negative)</option>
                  <option value="B+">B+ (B Positive)</option>
                  <option value="B-">B- (B Negative)</option>
                  <option value="O+">O+ (O Positive)</option>
                  <option value="O-">O- (O Negative)</option>
                  <option value="AB+">AB+ (AB Positive)</option>
                  <option value="AB-">AB- (AB Negative)</option>
                </select>
              </div>
            </div>

            {/* HSC Group and session */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block font-bold">
                  HSC Group <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <select
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-9 pr-3 w-full text-slate-700 dark:text-slate-200 focus:outline-none focus:border-army-500 font-mono"
                  >
                    <option value="">Select HSC Group</option>
                    <option value="Science">Science</option>
                    <option value="Humanities">Humanities</option>
                    <option value="Business Studies">Business Studies</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-slate-500 dark:text-slate-400 uppercase block font-bold">
                  Academic Session <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g., 2024-2025"
                    value={formData.session}
                    onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded py-2 pl-9 pr-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none focus:border-army-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* FORM SPECIFIC: RECRUIT */}
            {formType === "recruit" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <span className="font-mono text-[9px] text-amber-500 dark:text-amber-400 uppercase block font-bold">
                  // RECRUIT RESIDENTIAL DETAILS
                </span>
                <div className="space-y-1">
                  <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                    PRESENT RESIDENTIAL ADDRESS <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Home className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g., Sector 10, Road 12, House 4, Uttara, Dhaka"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 pl-9 pr-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">PHYSICAL HEIGHT STATUS</label>
                    <select className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-700 dark:text-slate-300 focus:outline-none font-mono">
                      <option>Complies with physical min height limits</option>
                      <option>Below standard (Requires PUO exemption)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">COLLEGE ROLL NUMBER</label>
                    <input
                      type="text"
                      placeholder="e.g., UGC-240112"
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* FORM SPECIFIC: RUNNING CADET */}
            {formType === "cadet" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <span className="font-mono text-[9px] text-amber-500 dark:text-amber-400 uppercase block font-bold">
                  // ACTIVE CADET IDENTIFICATION SCHEMA
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Platoon Joining Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.joiningYear}
                      onChange={(e) => setFormData({ ...formData, joiningYear: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Current Rank in Platoon <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.highestRank}
                      onChange={(e) => setFormData({ ...formData, highestRank: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-700 dark:text-slate-300 focus:outline-none font-mono"
                    >
                      <option value={BNCCRank.RECRUIT}>Recruit</option>
                      <option value={BNCCRank.CADET}>Cadet</option>
                      <option value={BNCCRank.LANCE_CORPORAL}>Lance Corporal</option>
                      <option value={BNCCRank.CORPORAL}>Corporal</option>
                      <option value={BNCCRank.SERGEANT}>Sergeant</option>
                      <option value={BNCCRank.CADET_UNDER_OFFICER}>Cadet Under Officer (CUO)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Assigned Cadet ID (If any)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., UGC-2022-004"
                      value={formData.cadetId}
                      onChange={(e) => setFormData({ ...formData, cadetId: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none uppercase font-mono"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* FORM SPECIFIC: ALUMNI */}
            {formType === "alumni" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <span className="font-mono text-[9px] text-amber-500 dark:text-amber-400 uppercase block font-bold">
                  // ALUMNI HISTORICAL ARCHIVE CREDENTIALS
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Platoon Joining Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.joiningYear}
                      onChange={(e) => setFormData({ ...formData, joiningYear: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Platoon Graduation Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g., 2021"
                      value={formData.graduationYear}
                      onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Highest Rank Achieved <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.highestRank}
                      onChange={(e) => setFormData({ ...formData, highestRank: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-700 dark:text-slate-300 focus:outline-none font-mono"
                    >
                      <option value={BNCCRank.RECRUIT}>Recruit</option>
                      <option value={BNCCRank.CADET}>Cadet</option>
                      <option value={BNCCRank.LANCE_CORPORAL}>Lance Corporal</option>
                      <option value={BNCCRank.CORPORAL}>Corporal</option>
                      <option value={BNCCRank.SERGEANT}>Sergeant</option>
                      <option value={BNCCRank.CADET_UNDER_OFFICER}>Cadet Under Officer (CUO)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Current Profession <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Software Engineer / Captain"
                      value={formData.currentProfession}
                      onChange={(e) => setFormData({ ...formData, currentProfession: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Current Organization <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Tech Corp / Bangladesh Army"
                      value={formData.currentOrganization}
                      onChange={(e) => setFormData({ ...formData, currentOrganization: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                      Current City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Dhaka / Chattogram"
                      value={formData.currentCity}
                      onChange={(e) => setFormData({ ...formData, currentCity: e.target.value })}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-slate-500 dark:text-slate-400 block font-bold">
                    Past Platoon Achievements (Honors / Ranks / Roles)
                  </label>
                  <textarea
                    placeholder="e.g., Best Cadet Award 2020, Regiment parade lead commander..."
                    value={formData.pastAchievements}
                    onChange={(e) => setFormData({ ...formData, pastAchievements: e.target.value })}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-2 px-3 w-full h-16 text-slate-900 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </motion.div>
            )}

            {/* CAMP PARTICIPATION CHECKBOX SECTION FOR CADET & ALUMNI */}
            {(formType === "cadet" || formType === "alumni") && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="font-mono text-[9px] text-amber-500 dark:text-amber-400 uppercase block font-bold">
                    // BATTALION CAMP PARTICIPATION CHECKBOXES
                  </span>
                  <span className="font-mono text-[9px] text-slate-400 font-bold uppercase">
                    {Object.keys(selectedCamps).length} Selected
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                  Select registered camps you participated in and specify your assigned role and achievements for each camp:
                </p>

                {availableCamps.length === 0 ? (
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-slate-500 text-xs font-mono text-center">
                    No registered camp records found in the official database.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableCamps.map((camp) => {
                      const isSelected = !!selectedCamps[camp.id];
                      return (
                        <div
                          key={camp.id}
                          className={`p-3.5 rounded border transition-colors ${
                            isSelected
                              ? "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/50"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <label className="flex items-start space-x-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCamps((prev) => ({
                                    ...prev,
                                    [camp.id]: {
                                      campId: camp.id,
                                      campName: camp.name,
                                      role: prev[camp.id]?.role || "",
                                      achievements: prev[camp.id]?.achievements || "",
                                    },
                                  }));
                                } else {
                                  setSelectedCamps((prev) => {
                                    const copy = { ...prev };
                                    delete copy[camp.id];
                                    return copy;
                                  });
                                }
                              }}
                              className="mt-1 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                            />
                            <div className="flex-1">
                              <span className="font-display font-bold text-xs text-slate-900 dark:text-slate-100 block">
                                {camp.name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block">
                                Venue: {camp.location} | Dates: {camp.startDate} to {camp.endDate}
                              </span>
                            </div>
                          </label>

                          {/* Role and Achievement input fields when camp is selected */}
                          {isSelected && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 pl-7">
                              <div className="space-y-1">
                                <label className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block font-bold">
                                  Your Role in Camp <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g., Participant, Section Commander, Squad Lead"
                                  value={selectedCamps[camp.id]?.role || ""}
                                  onChange={(e) =>
                                    setSelectedCamps((prev) => ({
                                      ...prev,
                                      [camp.id]: {
                                        ...prev[camp.id],
                                        role: e.target.value,
                                      },
                                    }))
                                  }
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2.5 w-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-mono text-[10px] text-slate-500 dark:text-slate-400 block font-bold">
                                  Camp Achievements (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g., Best Firing Award, 1st Position Squad Drill"
                                  value={selectedCamps[camp.id]?.achievements || ""}
                                  onChange={(e) =>
                                    setSelectedCamps((prev) => ({
                                      ...prev,
                                      [camp.id]: {
                                        ...prev[camp.id],
                                        achievements: e.target.value,
                                      },
                                    }))
                                  }
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded py-1.5 px-2.5 w-full text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-army-900 hover:bg-army-850 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-display font-bold py-3.5 rounded uppercase tracking-wider transition-colors shadow-lg mt-4 cursor-pointer"
            >
              {loading ? "TRANSMITTING TO OFFICIAL DATABASE..." : `TRANSMIT ${formType.toUpperCase()} REGISTRATION`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
