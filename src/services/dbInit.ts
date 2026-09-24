import { doc, getDoc, setDoc, getDocs, collection, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Member, BNCCRank, MemberStatus, LeadershipReference, GalleryItem, HomepageSection, PlatoonDocument } from "../types";

/**
 * System Initialization Metadata Document
 * Located at: system/initialization
 * Ensures the platform maintains a persistent initialization lock.
 * Once initialized, automatic routines will NEVER re-seed or override production data.
 */
export interface SystemInitMeta {
  initialized: boolean;
  initializedAt: string;
  version: number;
  environment: string;
  lastVerifiedAt?: string;
  schemaVersion?: string;
}

export interface MigrationReport {
  dryRun: boolean;
  totalScanned: number;
  recordsMigrated: number;
  recordsSkipped: number;
  targetVersion: string;
  timestamp: string;
  details: string[];
}

export async function getSystemInitMeta(): Promise<SystemInitMeta | null> {
  try {
    const initRef = doc(db, "system", "initialization");
    const initSnap = await getDoc(initRef);
    if (initSnap.exists()) {
      return initSnap.data() as SystemInitMeta;
    }
    return null;
  } catch (err) {
    console.warn("[DBInit] Failed to load sentinel meta:", err);
    return null;
  }
}

export interface DatabaseStatusReport {
  isInitialized: boolean;
  initializedAt: string | null;
  counts: {
    cadets: number;
    leadership: number;
    achievements: number;
    gallery: number;
    documents: number;
    events: number;
    notices: number;
  };
  singletons: {
    homepage: boolean;
    about: boolean;
    contact: boolean;
  };
}

/**
 * Non-destructive status check of the production Firestore database.
 * Does not write, modify, or delete any data.
 */
export async function getDatabaseStatus(): Promise<DatabaseStatusReport> {
  const initRef = doc(db, "system", "initialization");
  const initSnap = await getDoc(initRef);
  const initData = initSnap.exists() ? (initSnap.data() as SystemInitMeta) : null;

  const [
    homeSnap,
    aboutSnap,
    contactSnap,
    cadetsSnap,
    leadershipSnap,
    achievementsSnap,
    gallerySnap,
    docsSnap,
    eventsSnap,
    noticesSnap,
  ] = await Promise.all([
    getDoc(doc(db, "homepage", "main")).catch(() => null),
    getDoc(doc(db, "settings", "about")).catch(() => null),
    getDoc(doc(db, "settings", "contact")).catch(() => null),
    getDocs(collection(db, "cadets")).catch(() => ({ size: 0 })),
    getDocs(collection(db, "leadership")).catch(() => ({ size: 0 })),
    getDocs(collection(db, "achievements")).catch(() => ({ size: 0 })),
    getDocs(collection(db, "gallery")).catch(() => ({ size: 0 })),
    getDocs(collection(db, "documents")).catch(() => ({ size: 0 })),
    getDocs(collection(db, "events")).catch(() => ({ size: 0 })),
    getDocs(collection(db, "notices")).catch(() => ({ size: 0 })),
  ]);

  return {
    isInitialized: !!initData?.initialized,
    initializedAt: initData?.initializedAt || null,
    counts: {
      cadets: (cadetsSnap as any)?.size || 0,
      leadership: (leadershipSnap as any)?.size || 0,
      achievements: (achievementsSnap as any)?.size || 0,
      gallery: (gallerySnap as any)?.size || 0,
      documents: (docsSnap as any)?.size || 0,
      events: (eventsSnap as any)?.size || 0,
      notices: (noticesSnap as any)?.size || 0,
    },
    singletons: {
      homepage: !!homeSnap?.exists(),
      about: !!aboutSnap?.exists(),
      contact: !!contactSnap?.exists(),
    },
  };
}

/**
 * SAFE INITIALIZATION
 *
 * Rules:
 * 1. Checks system sentinel document (system/initialization). If initialized, exits immediately.
 * 2. Only seeds baseline configurations (homepage, about, contact) if the specific document does NOT exist.
 * 3. Only seeds initial records (cadets, leadership, achievements, gallery) if the collection is completely EMPTY.
 * 4. NEVER deletes collections or records.
 * 5. NEVER overwrites existing records or custom user edits.
 * 6. Sets the persistent sentinel lock to prevent subsequent re-seeding.
 */
export async function initializeDatabase(options?: { force?: boolean }): Promise<{
  success: boolean;
  message: string;
  alreadyInitialized?: boolean;
}> {
  try {
    const initRef = doc(db, "system", "initialization");
    const initSnap = await getDoc(initRef);

    if (initSnap.exists() && initSnap.data()?.initialized && !options?.force) {
      console.log("[DBInit] Database has already been initialized. Skipping to preserve production data.");
      return {
        success: true,
        alreadyInitialized: true,
        message: "Database already initialized and locked. Production data preserved.",
      };
    }

    console.log("[DBInit] Starting non-destructive database initialization...");

    // Helper for safe non-destructive write (only if authorized)
    const safeWrite = async (op: () => Promise<any>, label: string) => {
      try {
        await op();
      } catch (err: any) {
        if (
          err?.code === "permission-denied" ||
          err?.message?.toLowerCase().includes("permission") ||
          err?.message?.toLowerCase().includes("insufficient")
        ) {
          console.debug(`[DBInit] Skipped write operation [${label}] due to permission constraints.`);
        } else {
          console.warn(`[DBInit] Warning during [${label}]:`, err);
        }
      }
    };

    // 1. Seed Homepage (if not present)
    const homeDocRef = doc(db, "homepage", "main");
    const homeSnap = await getDoc(homeDocRef);
    if (!homeSnap.exists()) {
      const defaultHomepage: HomepageSection = {
        heroTitle: "UGC BNCC DIGITAL PLATOON",
        heroSubtitle: "Bangladesh National Cadet Corps Platoon, Uttara Government College",
        heroBgUrl: "",
        heroBgOption: "url",
        mottoEnglish: "Knowledge, Discipline, Unity",
        mottoBengali: "জ্ঞান, শৃঙ্খলা, একতা",
        establishedText: "ESTD 2018",
        paragraphDescription:
          "Official digital registry and command platform of Uttara Government College Platoon. Moulding young students into disciplined, patriotic, and highly competent future defense and civil leaders.",
        buttonText1: "Apply to Join Platoon",
        buttonText2: "View Cadet Profiles",
        welcomeMessage:
          "Welcome to the official portal of Uttara Government College BNCC Platoon. Our mission is to raise civic consciousness and volunteer spirit among cadets.",
        heroSlideshowUrls: [],
        commanderName: "PUO Dr. Md. Aminul Islam",
        commanderRank: "Platoon Under Officer",
        commanderPhoto: "",
        commanderMessage:
          "As the Platoon Commander of Uttara Government College BNCC Platoon, I welcome you to our digital command hub. Our mission is to build highly disciplined, patriotic, and competent future leaders. Through weekly drills, rescue campaigns, and voluntary campaigns, we instill a spirit of selfless service. Stand tall, march forward, and salute the nation.",
        statsActiveCadets: 0,
        statsAchievements: 0,
        statsCampsAttended: 0,
        statsBloodUnits: 0,
      };
      await safeWrite(() => setDoc(homeDocRef, defaultHomepage), "Seed Homepage");
    }

    // 2. Seed Settings - About (if not present)
    const aboutDocRef = doc(db, "settings", "about");
    const aboutSnap = await getDoc(aboutDocRef);
    if (!aboutSnap.exists()) {
      const defaultAbout = {
        history: [
          "The Uttara Government College BNCC Platoon was officially established in 2018 to foster discipline, leadership, and voluntary community service among the college student body. Falling under the jurisdiction of the esteemed 3 Ramna Battalion, Ramna Regiment of the Bangladesh National Cadet Corps (BNCC), the platoon has built a pristine legacy of producing exemplary cadets.",
          "From its humble beginnings with 15 recruits, the platoon has consistently maintained high standards in weekly military drill parades, national camp participations, and civilian aid projects. Guided by our founding Platoon Commander, PUO Dr. Md. Aminul Islam, the platoon serves as a training ground for cadets preparing to serve the nation in defense forces and civil services.",
          "Our permanent database includes cadets who have received commissions in the Bangladesh Army, excelled in BCS Administrative Cadres, and established themselves in elite software and corporate organizations. Every cadet who joins the platoon receives a permanent digital profile that remains preserved in our official archive forever.",
        ],
        milestones: [
          {
            year: "2018",
            title: "Platoon Establishment",
            details:
              "Uttara Government College BNCC Platoon was officially raised under Ramna Regiment (3 Ramna Battalion). PUO Dr. Md. Aminul Islam was appointed as Platoon Commander. Enlisted 15 founding cadet recruits.",
          },
          {
            year: "2019",
            title: "First Central Camp & Promotion",
            details:
              "Cadets participated in the Central Camp in Savar training facility. First Cadet Under Officer (CUO) promotion was awarded to Riad Hasan Khan.",
          },
          {
            year: "2020",
            title: "Covid-19 Volunteerism",
            details:
              "During the pandemic, cadets volunteered alongside local administrations for social-distancing maintenance, mask distributions, and food-relief logistics in the Uttara sector.",
          },
          {
            year: "2022",
            title: "Expansion to 21 Active Cadets",
            details:
              "Post-pandemic force expansion. Established structured training pipelines in parade drill, basic firearms mapping, and medical disaster mitigation.",
          },
          {
            year: "2024",
            title: "Victory Day Parade Command",
            details:
              "UGC BNCC Platoon represented Ramna Regiment at the National Victory Day display. CUO Sheikh Sadi awarded Best Regiment Commander.",
          },
          {
            year: "2026",
            title: "Digital Service Portal Rollout",
            details:
              "The Platoon pioneered digital military service record systems for cadets, establishing a permanent searchable archive of alumni and cadets since 2018.",
          },
        ],
        objectives: [
          "Develop high moral standards, civic responsibility, and self-discipline among college students.",
          "Train cadets in military drills, tactical navigation, physical endurance, and emergency rescue operations.",
          "Render immediate humanitarian logistics and volunteer support to the national administration during emergencies, floods, and natural disasters.",
          "Provide prerequisite coaching and drill guidance for candidates aspiring to apply for the ISSB and join the Armed Forces of Bangladesh.",
        ],
        oath: "We shall uphold the honor of Uttara Government College and the Bangladesh National Cadet Corps. With discipline, patriotism, and selfless service, we stand ready to serve our nation whenever duty calls.",
      };
      await safeWrite(() => setDoc(aboutDocRef, defaultAbout), "Seed About");
    }

    // 3. Seed Settings - Contact (if not present)
    const contactDocRef = doc(db, "settings", "contact");
    const contactSnap = await getDoc(contactDocRef);
    if (!contactSnap.exists()) {
      const defaultContact = {
        location:
          "UGC BNCC Office Room #204 (2nd Floor)\nAcademic Building 1, Uttara Government College\nSector 7, Uttara, Dhaka-1230, Bangladesh",
        phone: "Platoon Commander: +880 171 234 5678\nCadet Headquarter Duty: +880 181 234 5679",
        email: "aminul.bangla@ugc.edu.bd\nhq@ugcbncc.org",
        timings:
          "Weekly Parade Drill: Saturdays 07:00 AM - 10:00 AM\nOffice Open: Sun to Wed 11:00 AM - 02:00 PM",
        latitude: 23.869,
        longitude: 90.3957,
      };
      await safeWrite(() => setDoc(contactDocRef, defaultContact), "Seed Contact");
    }

    // 4. Seed Cadets - ONLY if collection is completely empty
    const cadetsCollSnap = await getDocs(collection(db, "cadets"));
    if (cadetsCollSnap.empty) {
      console.log("[DBInit] Cadets collection is empty. Seeding initial baseline commander...");
      const seedCadets: Member[] = [
        {
          id: "UGC-2018-001",
          userId: "u_admin",
          fullName: "PUO Dr. Md. Aminul Islam",
          photoUrl: "",
          rank: BNCCRank.PLATOON_UNDER_OFFICER,
          department: "Associate Professor, Bangla",
          session: "2018-2019",
          joiningYear: 2018,
          graduationYear: null,
          bloodGroup: "B+",
          phone: "+880 171 234 5678",
          email: "aminul.bangla@ugc.edu.bd",
          biography:
            "Appointed Platoon Commander in 2018. Overlooks all administrative, training, and strategic deployments of UGC BNCC Platoon. Awarded Regiment Commendation.",
          status: MemberStatus.ACTIVE_CADET,
          verified: true,
        },
      ];
      for (const cadet of seedCadets) {
        await safeWrite(() => setDoc(doc(db, "cadets", cadet.id), cadet), `Seed cadet ${cadet.id}`);
      }
    }

    // 5. Seed Leadership - ONLY if collection is completely empty
    const leadershipCollSnap = await getDocs(collection(db, "leadership"));
    if (leadershipCollSnap.empty) {
      console.log("[DBInit] Leadership collection is empty. Seeding initial baseline leadership...");
      const seedLeadership: LeadershipReference[] = [
        {
          id: "lr-1",
          memberId: "UGC-2018-001",
          cadetId: "UGC-2018-001",
          position: "Platoon Commander",
          displayOrder: 1,
          status: "Active",
          appointmentDate: "2018-06-01",
          roleType: "platoon_commander",
        },
      ];
      for (const lead of seedLeadership) {
        await safeWrite(() => setDoc(doc(db, "leadership", lead.id), lead), `Seed leadership ${lead.id}`);
      }
    }

    // 6. Seed Achievements - ONLY if collection is completely empty
    const achievementsCollSnap = await getDocs(collection(db, "achievements"));
    if (achievementsCollSnap.empty) {
      console.log("[DBInit] Achievements collection is empty. Seeding baseline honors...");
      const seedAchievements = [
        {
          id: "ach-1",
          title: "Best Regiment Cadet Award 2025",
          category: "Leadership",
          recipient: "CUO Sheikh Sadi",
          recipientId: "UGC-2018-001",
          date: "2025-12-16",
          description:
            "Awarded top honor across Ramna Regiment for exceptional parade leadership, tactical skill, and command excellence.",
          medalType: "Gold",
          issuedBy: "3 Ramna Battalion Command",
        },
        {
          id: "ach-2",
          title: "Inter-Platoon Squad Shooting Championship",
          category: "Shooting",
          recipient: "Sgt. Riad Hasan Khan",
          recipientId: "UGC-2018-001",
          date: "2025-08-20",
          description:
            "Secured 1st position in 25-meter rifle firing precision during the Annual firing classification camp.",
          medalType: "Gold",
          issuedBy: "BNCC Headquarters",
        },
        {
          id: "ach-3",
          title: "Central Camp Drill Competition Champion",
          category: "Drill",
          recipient: "UGC Platoon Contingent",
          recipientId: "UGC-2018-001",
          date: "2025-02-14",
          description:
            "Awarded Best Squad Trophy in synchronized military march drill among 18 college platoons.",
          medalType: "Gold",
          issuedBy: "Ramna Regiment HQ",
        },
      ];
      for (const ach of seedAchievements) {
        await safeWrite(() => setDoc(doc(db, "achievements", ach.id), ach), `Seed achievement ${ach.id}`);
      }
    }

    // 7. Seed Gallery - ONLY if collection is completely empty
    const galleryCollSnap = await getDocs(collection(db, "gallery"));
    if (galleryCollSnap.empty) {
      console.log("[DBInit] Gallery collection is empty. Seeding baseline gallery...");
      const seedGallery: GalleryItem[] = [
        {
          id: "gal_1",
          title: "Annual Victory Day Parade 2025",
          category: "Parade",
          imageUrl: "",
          description: "UGC BNCC Contingent marching at the National Parade Ground under Ramna Regiment command.",
          date: "2025-12-16",
        },
        {
          id: "gal_2",
          title: "Winter Regiment Training Camp",
          category: "Camp",
          imageUrl: "",
          description: "Cadets participating in tactical field maneuvers and night navigation exercises during central camp.",
          date: "2025-01-20",
        },
      ];
      for (const gal of seedGallery) {
        await safeWrite(() => setDoc(doc(db, "gallery", gal.id), gal), `Seed gallery ${gal.id}`);
      }
    }

    // 8. Write Sentinel Initialization Record
    await safeWrite(
      () =>
        setDoc(initRef, {
          initialized: true,
          initializedAt: new Date().toISOString(),
          version: 1,
          environment: "production",
          lastVerifiedAt: new Date().toISOString(),
        } satisfies SystemInitMeta),
      "Set System Initialization Sentinel"
    );

    console.log("[DBInit] Database non-destructive initialization completed successfully.");
    return {
      success: true,
      message: "Database baseline verified & non-destructively initialized.",
    };
  } catch (error: any) {
    console.error("[DBInit] Error during database initialization:", error);
    return {
      success: false,
      message: error?.message || "Failed to initialize database.",
    };
  }
}

/**
 * SAFE CONTROLLED SCHEMA MIGRATION
 *
 * Backfills missing attributes without deleting any fields, documents, or collections.
 * Backward Compatibility Guarantee:
 * - Preserves all legacy field names (cadetId, memberId, downloadUrl, fileUrl, campsParticipation, etc.).
 * - Safe Dry-Run mode available to preview changes before applying them.
 */
export async function runControlledSchemaMigration(
  optionsOrDryRun: boolean | { dryRun?: boolean; executedBy?: string } = true
): Promise<MigrationReport> {
  const dryRun = typeof optionsOrDryRun === "boolean" ? optionsOrDryRun : optionsOrDryRun.dryRun !== false;
  const executedBy = typeof optionsOrDryRun === "object" ? optionsOrDryRun.executedBy : undefined;
  const details: string[] = [];
  let updatesCount = 0;
  let docsChecked = 0;

  try {
    // 1. Check achievements for missing recipientId or issuedBy
    const achsSnap = await getDocs(collection(db, "achievements"));
    const cadetsSnap = await getDocs(collection(db, "cadets"));
    const cadetsList = cadetsSnap.empty ? [] : cadetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    docsChecked += achsSnap.size;

    for (const docSnap of achsSnap.docs) {
      const data = docSnap.data();
      const updates: Record<string, any> = {};

      const memberId = data.memberId || data.recipientId || data.cadetId;

      if (!data.recipientId && memberId) {
        updates.recipientId = memberId;
      }
      if (!data.cadetId && memberId) {
        updates.cadetId = memberId; // Preserve legacy compatibility
      }
      if (!data.recipient || data.recipient === "★" || !data.recipient.trim()) {
        if (memberId) {
          const match = cadetsList.find(
            (c) => c.id === memberId || c.id.toUpperCase() === memberId.toUpperCase()
          );
          if (match) {
            updates.recipient = `${match.rank || "Cadet"} ${match.fullName}`.trim();
          }
        }
      }
      if (!data.issuedBy || !data.issuedBy.trim()) {
        updates.issuedBy =
          data.campName ||
          (data.category === "Camp Honor" ? "3 Ramna Battalion Command" : "UGC Platoon Command");
      }

      if (Object.keys(updates).length > 0) {
        updatesCount++;
        details.push(
          `Achievement [${docSnap.id}] "${data.title || "Untitled"}": Backfill ${Object.keys(updates).join(", ")}`
        );
        if (!dryRun) {
          await updateDoc(doc(db, "achievements", docSnap.id), updates).catch((err) =>
            console.warn(`Failed updating achievement ${docSnap.id}:`, err)
          );
        }
      }
    }

    // 2. Check documents for isInternal boolean definition
    const docsSnap = await getDocs(collection(db, "documents"));
    docsChecked += docsSnap.size;

    for (const docSnap of docsSnap.docs) {
      const data = docSnap.data();
      if (typeof data.isInternal !== "boolean") {
        updatesCount++;
        const isInternalVal = data.category === "Internal" || data.category === "Confidential";
        details.push(
          `Document [${docSnap.id}] "${data.title || "Untitled"}": Set isInternal=${isInternalVal}`
        );
        if (!dryRun) {
          await updateDoc(doc(db, "documents", docSnap.id), { isInternal: isInternalVal }).catch((err) =>
            console.warn(`Failed updating document ${docSnap.id}:`, err)
          );
        }
      }
    }

    if (!dryRun && executedBy) {
      // Update sentinel schemaVersion upon successful execution
      await updateDoc(doc(db, "system", "initialization"), {
        schemaVersion: "v1.1 (Standardized)",
        lastVerifiedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    return {
      dryRun,
      totalScanned: docsChecked,
      recordsMigrated: updatesCount,
      recordsSkipped: Math.max(0, docsChecked - updatesCount),
      targetVersion: "v1.1 (Backward-Compatible)",
      timestamp: new Date().toLocaleString(),
      details,
    };
  } catch (err: any) {
    console.error("[Migration] Error in controlled migration:", err);
    throw new Error(`Controlled migration failed: ${err.message || err}`);
  }
}
