import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  WriteBatch,
  writeBatch
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateEmail,
  updatePassword
} from "firebase/auth";
import { db, auth, handleFirestoreError, OperationType } from "./firebase";
import {
  Member,
  PlatoonEvent,
  PlatoonApplication,
  User,
  UserRole,
  GalleryItem,
  Announcement,
  AuditLog,
  LeadershipReference,
  HomepageSection,
  TrashItem,
  MemberStatus,
  BNCCRank
} from "./types";

// Helper for generating standard IDs if needed
export function generateId(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 11)}`;
}

// -------------------------------------------------------------------------
// DATABASE INITIALIZATION & SEEDING (Auto-runs on fresh DB)
// -------------------------------------------------------------------------
export async function initializeDatabase() {
  const safeWrite = async (op: () => Promise<any>, label: string) => {
    try {
      await op();
    } catch (err: any) {
      if (err?.code === 'permission-denied' || err?.message?.toLowerCase().includes('permission') || err?.message?.toLowerCase().includes('insufficient permissions')) {
        console.debug(`[FirebaseService] Skipper write/delete operation [${label}] due to read-only guest permissions.`);
      } else {
        throw err;
      }
    }
  };

  try {
    console.log("[FirebaseService] Verifying database integrity...");

    // 1. Seed Homepage
    const homeDocRef = doc(db, "homepage", "main");
    const homeSnap = await getDoc(homeDocRef);

    if (!homeSnap.exists()) {
      console.log("[FirebaseService] Seeding default homepage...");
      const defaultHomepage: HomepageSection = {
        heroTitle: "UGC BNCC DIGITAL PLATOON",
        heroSubtitle: "Bangladesh National Cadet Corps Platoon, Uttara Government College",
        heroBgUrl: "",
        heroBgOption: "url",
        mottoEnglish: "Knowledge, Discipline, Unity",
        mottoBengali: "জ্ঞান, শৃঙ্খলা, একতা",
        establishedText: "ESTD 2018",
        paragraphDescription: "Official digital registry and command platform of Uttara Government College Platoon. Moulding young students into disciplined, patriotic, and highly competent future defense and civil leaders.",
        buttonText1: "Apply to Join Platoon",
        buttonText2: "View Cadet Profiles",
        welcomeMessage: "Welcome to the official portal of Uttara Government College BNCC Platoon. Our mission is to raise civic consciousness and volunteer spirit among cadets.",
        heroSlideshowUrls: [],
        commanderName: "PUO Dr. Md. Aminul Islam",
        commanderRank: "Platoon Under Officer",
        commanderPhoto: "",
        commanderMessage: "As the Platoon Commander of Uttara Government College BNCC Platoon, I welcome you to our digital command hub. Our mission is to build highly disciplined, patriotic, and competent future leaders. Through weekly drills, rescue campaigns, and voluntary campaigns, we instill a spirit of selfless service. Stand tall, march forward, and salute the nation.",
        statsActiveCadets: 0,
        statsAchievements: 0,
        statsCampsAttended: 0,
        statsBloodUnits: 0
      };
      await safeWrite(() => setDoc(homeDocRef, defaultHomepage), "Seed Homepage");

      // Force cleanup of any previously seeded demo profile or extra records to ensure a fresh, empty start ONLY on first seed
      const cadetsSnap = await getDocs(collection(db, "cadets"));
      for (const d of cadetsSnap.docs) {
        if (d.id !== "UGC-2018-001" && d.id.toUpperCase() !== "UGC-2018-001") {
          await safeWrite(() => deleteDoc(doc(db, "cadets", d.id)), `Clean cadet ${d.id}`);
        }
      }

      const leadershipSnap = await getDocs(collection(db, "leadership"));
      for (const d of leadershipSnap.docs) {
        if (d.id !== "lr-1") {
          await safeWrite(() => deleteDoc(doc(db, "leadership", d.id)), `Clean leadership ${d.id}`);
        }
      }

      const achievementsSnap = await getDocs(collection(db, "achievements"));
      for (const d of achievementsSnap.docs) {
        await safeWrite(() => deleteDoc(doc(db, "achievements", d.id)), `Clean achievement ${d.id}`);
      }

      const campsSnap = await getDocs(collection(db, "camps"));
      for (const d of campsSnap.docs) {
        await safeWrite(() => deleteDoc(doc(db, "camps", d.id)), `Clean camp ${d.id}`);
      }
    }

    // Ensure the main commander profile always exists (non-destructive check)
    const commSnap = await getDoc(doc(db, "cadets", "UGC-2018-001"));
    if (!commSnap.exists()) {
      await safeWrite(() => setDoc(doc(db, "cadets", "UGC-2018-001"), {
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
        biography: "Appointed Platoon Commander in 2018. Overlooks all administrative, training, and strategic deployments of UGC BNCC Platoon. Awarded Regiment Commendation.",
        status: MemberStatus.ACTIVE_CADET,
        verified: true
      }), "Commander profile");
    }

    const commLeadSnap = await getDoc(doc(db, "leadership", "lr-1"));
    if (!commLeadSnap.exists()) {
      await safeWrite(() => setDoc(doc(db, "leadership", "lr-1"), {
        id: "lr-1",
        memberId: "UGC-2018-001",
        cadetId: "UGC-2018-001",
        position: "Platoon Commander",
        displayOrder: 1,
        status: "Active",
        appointmentDate: "2018-06-01",
        roleType: "platoon_commander"
      }), "Commander leadership record");
    }

    // 2. Seed Settings - About Section
    const aboutDocRef = doc(db, "settings", "about");
    const aboutSnap = await getDoc(aboutDocRef);
    if (!aboutSnap.exists()) {
      console.log("[FirebaseService] Seeding default about settings...");
      const defaultAbout = {
        history: [
          "The Uttara Government College BNCC Platoon was officially established in 2018 to foster discipline, leadership, and voluntary community service among the college student body. Falling under the jurisdiction of the esteemed 3 Ramna Battalion, Ramna Regiment of the Bangladesh National Cadet Corps (BNCC), the platoon has built a pristine legacy of producing exemplary cadets.",
          "From its humble beginnings with 15 recruits, the platoon has consistently maintained high standards in weekly military drill parades, national camp participations, and civilian aid projects. Guided by our founding Platoon Commander, PUO Dr. Md. Aminul Islam, the platoon serves as a training ground for cadets preparing to serve the nation in defense forces and civil services.",
          "Our permanent database includes cadets who have received commissions in the Bangladesh Army, excelled in BCS Administrative Cadres, and established themselves in elite software and corporate organizations. Every cadet who joins the platoon receives a permanent digital profile that remains preserved in our official archive forever."
        ],
        milestones: [
          {
            year: "2018",
            title: "Platoon Establishment",
            details: "Uttara Government College BNCC Platoon was officially raised under Ramna Regiment (3 Ramna Battalion). PUO Dr. Md. Aminul Islam was appointed as Platoon Commander. Enlisted 15 founding cadet recruits."
          },
          {
            year: "2019",
            title: "First Central Camp & Promotion",
            details: "Cadets participated in the Central Camp in Savar training facility. First Cadet Under Officer (CUO) promotion was awarded to Riad Hasan Khan."
          },
          {
            year: "2020",
            title: "Covid-19 Volunteerism",
            details: "During the pandemic, cadets volunteered alongside local administrations for social-distancing maintenance, mask distributions, and food-relief logistics in the Uttara sector."
          },
          {
            year: "2022",
            title: "Expansion to 21 Active Cadets",
            details: "Post-pandemic force expansion. Established structured training pipelines in parade drill, basic firearms mapping, and medical disaster mitigation."
          },
          {
            year: "2024",
            title: "Victory Day Parade Command",
            details: "UGC BNCC Platoon represented Ramna Regiment at the National Victory Day display. CUO Sheikh Sadi awarded Best Regiment Commander."
          },
          {
            year: "2026",
            title: "Digital Service Portal Rollout",
            details: "The Platoon pioneered digital military service record systems for cadets, establishing a permanent searchable archive of alumni and cadets since 2018."
          }
        ],
        objectives: [
          "Develop high moral standards, civic responsibility, and self-discipline among college students.",
          "Train cadets in military drills, tactical navigation, physical endurance, and emergency rescue operations.",
          "Render immediate humanitarian logistics and volunteer support to the national administration during emergencies, floods, and natural disasters.",
          "Provide prerequisite coaching and drill guidance for candidates aspiring to apply for the ISSB and join the Armed Forces of Bangladesh."
        ],
        oath: "We shall uphold the honor of Uttara Government College and the Bangladesh National Cadet Corps. With discipline, patriotism, and selfless service, we stand ready to serve our nation whenever duty calls."
      };
      await safeWrite(() => setDoc(aboutDocRef, defaultAbout), "Seed About");
    }

    // 3. Seed Settings - Contact Section
    const contactDocRef = doc(db, "settings", "contact");
    const contactSnap = await getDoc(contactDocRef);
    if (!contactSnap.exists()) {
      console.log("[FirebaseService] Seeding default contact settings...");
      const defaultContact = {
        location: "UGC BNCC Office Room #204 (2nd Floor)\nAcademic Building 1, Uttara Government College\nSector 7, Uttara, Dhaka-1230, Bangladesh",
        phone: "Platoon Commander: +880 171 234 5678\nCadet Headquarter Duty: +880 181 234 5679",
        email: "aminul.bangla@ugc.edu.bd\nhq@ugcbncc.org",
        timings: "Weekly Parade Drill: Saturdays 07:00 AM - 10:00 AM\nOffice Open: Sun to Wed 11:00 AM - 02:00 PM",
        latitude: 23.8690,
        longitude: 90.3957
      };
      await safeWrite(() => setDoc(contactDocRef, defaultContact), "Seed Contact");
    }

    // 4. Seed Cadets (Initial commanders and members)
    const cadetsCollSnap = await getDocs(collection(db, "cadets"));
    if (cadetsCollSnap.empty) {
      console.log("[FirebaseService] Seeding default cadets...");
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
          biography: "Appointed Platoon Commander in 2018. Overlooks all administrative, training, and strategic deployments of UGC BNCC Platoon. Awarded Regiment Commendation.",
          status: MemberStatus.ACTIVE_CADET,
          verified: true
        }
      ];

      for (const cadet of seedCadets) {
        await safeWrite(() => setDoc(doc(db, "cadets", cadet.id), cadet), `Seed cadet ${cadet.id}`);
      }
    }

    // 5. Seed Leadership References
    const leadershipCollSnap = await getDocs(collection(db, "leadership"));
    if (leadershipCollSnap.empty) {
      console.log("[FirebaseService] Seeding default leadership reference mappings...");
      const seedLeadership: LeadershipReference[] = [
        {
          id: "lr-1",
          memberId: "UGC-2018-001",
          cadetId: "UGC-2018-001",
          position: "Platoon Commander",
          displayOrder: 1,
          status: "Active",
          appointmentDate: "2018-06-01",
          roleType: "platoon_commander"
        }
      ];

      for (const lead of seedLeadership) {
        await safeWrite(() => setDoc(doc(db, "leadership", lead.id), lead), `Seed leadership ${lead.id}`);
      }
    }

    // 6. Seed Achievements
    const achievementsCollSnap = await getDocs(collection(db, "achievements"));
    if (achievementsCollSnap.empty) {
      console.log("[FirebaseService] Seeding default achievements records...");
      const seedAchievements = [
        {
          id: "ach-1",
          title: "Best Regiment Cadet Award 2025",
          category: "Leadership",
          recipient: "CUO Sheikh Sadi",
          recipientId: "UGC-2018-001",
          date: "2025-12-16",
          description: "Awarded top honor across Ramna Regiment for exceptional parade leadership, tactical skill, and command excellence.",
          medalType: "Gold",
          issuedBy: "3 Ramna Battalion Command"
        },
        {
          id: "ach-2",
          title: "Inter-Platoon Squad Shooting Championship",
          category: "Shooting",
          recipient: "Sgt. Riad Hasan Khan",
          recipientId: "UGC-2018-001",
          date: "2025-08-20",
          description: "Secured 1st position in 25-meter rifle firing precision during the Annual firing classification camp.",
          medalType: "Gold",
          issuedBy: "BNCC Headquarters"
        },
        {
          id: "ach-3",
          title: "Central Camp Drill Competition Champion",
          category: "Drill",
          recipient: "UGC Platoon Contingent",
          recipientId: "UGC-2018-001",
          date: "2025-02-14",
          description: "Awarded Best Squad Trophy in synchronized military march drill among 18 college platoons.",
          medalType: "Gold",
          issuedBy: "Ramna Regiment HQ"
        },
        {
          id: "ach-4",
          title: "National Emergency Rescue Commendation",
          category: "Community Service",
          recipient: "Cpl. Tanvir Ahmed & Team",
          recipientId: "UGC-2018-001",
          date: "2024-09-05",
          description: "Recognized for outstanding civilian flood relief logistics and medical rescue deployment in eastern districts.",
          medalType: "Honor",
          issuedBy: "Ministry of Disaster Management"
        }
      ];
      for (const ach of seedAchievements) {
        await safeWrite(() => setDoc(doc(db, "achievements", ach.id), ach), `Seed achievement ${ach.id}`);
      }
    }

    // 7. Seed Gallery
    const galleryCollSnap = await getDocs(collection(db, "gallery"));
    if (galleryCollSnap.empty) {
      console.log("[FirebaseService] Seeding default gallery records...");
      const seedGallery: GalleryItem[] = [
        {
          id: "gal_1",
          title: "Annual Victory Day Parade 2025",
          category: "Parade",
          imageUrl: "",
          description: "UGC BNCC Contingent marching at the National Parade Ground under Ramna Regiment command.",
          date: "2025-12-16"
        },
        {
          id: "gal_2",
          title: "Winter Regiment Training Camp",
          category: "Camp",
          imageUrl: "",
          description: "Cadets participating in tactical field maneuvers and night navigation exercises during central camp.",
          date: "2025-01-20"
        },
        {
          id: "gal_3",
          title: "Voluntary Blood Donation Drive",
          category: "Social Activity",
          imageUrl: "",
          description: "Platoon cadets organized a voluntary blood donation drive collecting 120+ units for emergency hospital supplies.",
          date: "2025-11-20"
        },
        {
          id: "gal_4",
          title: "Infantry Drill & Arms Training",
          category: "Drill",
          imageUrl: "",
          description: "Cadets undergoing rigorous weapon handling SOP and synchronized squad drill at campus grounds.",
          date: "2025-09-10"
        },
        {
          id: "gal_5",
          title: "Leadership & First Aid Workshop",
          category: "Training",
          imageUrl: "",
          description: "Emergency disaster rescue, CPR certification, and battlefield first aid training conducted by Battalion medical officers.",
          date: "2025-05-18"
        },
        {
          id: "gal_6",
          title: "National Independence Day Ceremony",
          category: "National Events",
          imageUrl: "",
          description: "Color Guard squad presenting ceremonial arms and national flag salute at college premises.",
          date: "2025-03-26"
        }
      ];

      for (const gal of seedGallery) {
        await safeWrite(() => setDoc(doc(db, "gallery", gal.id), gal), `Seed gallery ${gal.id}`);
      }
    }

    console.log("[FirebaseService] Database integrity check & seeding completed.");
  } catch (error) {
    console.error("[FirebaseService] Error during DB integrity check:", error);
  }
}

// Sync cadet rank changes to all their related achievements
export async function syncCadetRankInAchievements(cadetId: string, newRank: string, fullName?: string) {
  try {
    const achsSnap = await getDocs(collection(db, "achievements"));
    for (const achDoc of achsSnap.docs) {
      const ach = achDoc.data();
      if (ach.memberId === cadetId || ach.recipientId === cadetId || ach.cadetId === cadetId) {
        let nameToUse = fullName;
        if (!nameToUse) {
          try {
            const cadetDocSnap = await getDoc(doc(db, "cadets", cadetId));
            if (cadetDocSnap.exists()) {
              nameToUse = cadetDocSnap.data().fullName;
            }
          } catch (e) {
            // fallback
          }
        }
        const updatedRecipient = nameToUse ? `${newRank} ${nameToUse}`.trim() : `${newRank} Cadet`;
        await updateDoc(doc(db, "achievements", achDoc.id), {
          recipient: updatedRecipient,
        }).catch((e) => console.warn("[syncCadetRankInAchievements] Error updating doc:", e));
      }
    }
  } catch (err) {
    console.warn("[syncCadetRankInAchievements] Error querying achievements:", err);
  }
}

// Remove or soft-delete achievements associated with a cadet
export async function removeCadetAchievements(
  cadetId: string,
  isSoftDelete: boolean = true,
  userEmail: string = "admin@ugcbncc.org",
  userId: string = "admin"
) {
  try {
    const achsSnap = await getDocs(collection(db, "achievements"));
    for (const achDoc of achsSnap.docs) {
      const ach = achDoc.data();
      if (ach.memberId === cadetId || ach.recipientId === cadetId || ach.cadetId === cadetId) {
        if (isSoftDelete) {
          await softDeleteRecord("achievements", achDoc.id, ach.title || "Related Achievement", ach, userEmail, userId);
        } else {
          await deleteDoc(doc(db, "achievements", achDoc.id)).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn("[removeCadetAchievements] Error removing achievements:", err);
  }
}

// -------------------------------------------------------------------------
// SOFT DELETE ENGINE (TRASH MODULE)
// -------------------------------------------------------------------------
export async function softDeleteRecord(
  collectionName: string,
  recordId: string,
  title: string,
  data: any,
  userEmail: string,
  userId: string
) {
  const path = `trash/${recordId}`;
  try {
    const trashId = generateId("tr");
    const trashItem: TrashItem = {
      id: trashId,
      type: collectionName as any,
      title: title || "Unnamed Record",
      deletedAt: new Date().toISOString(),
      data: { ...data, id: recordId }
    };

    // 1. Write to Trash collection
    await setDoc(doc(db, "trash", trashId), trashItem);

    // 2. Delete original document
    await deleteDoc(doc(db, collectionName, recordId));

    // 3. If deleting a cadet/member, soft-delete all related achievements as well
    if (collectionName === "cadets" || collectionName === "members") {
      await removeCadetAchievements(recordId, true, userEmail, userId);
    }

    // 4. Log Audit Activity
    await logActivity(
      userId,
      userEmail,
      "Soft Delete Record",
      collectionName,
      recordId,
      `Soft-deleted ${collectionName} item: "${title}"`
    );

    return trashId;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function restoreRecordFromTrash(trashId: string, userEmail: string, userId: string) {
  const path = `trash/${trashId}`;
  try {
    const trashDocRef = doc(db, "trash", trashId);
    const trashSnap = await getDoc(trashDocRef);

    if (!trashSnap.exists()) {
      throw new Error("Target trash record no longer exists.");
    }

    const trashItem = trashSnap.data() as TrashItem;
    const { type, data } = trashItem;
    const originalId = data.id || generateId("rec");

    // 1. Restore to original collection
    await setDoc(doc(db, type, originalId), data);

    // 2. Remove from Trash
    await deleteDoc(trashDocRef);

    // 3. If restoring a cadet, also restore any soft-deleted achievements belonging to this cadet
    if ((type as string) === "cadets" || (type as string) === "cadet" || (type as string) === "members") {
      try {
        const trashSnapAll = await getDocs(collection(db, "trash"));
        for (const trDoc of trashSnapAll.docs) {
          const item = trDoc.data();
          if (item.type === "achievements" && item.data) {
            const achData = item.data;
            if (achData.memberId === originalId || achData.recipientId === originalId || achData.cadetId === originalId) {
              await restoreRecordFromTrash(trDoc.id, userEmail, userId).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn("Failed restoring cadet achievements from trash:", err);
      }
    }

    // 4. Log Audit Activity
    await logActivity(
      userId,
      userEmail,
      "Restore Record",
      type,
      originalId,
      `Restored ${type} item: "${trashItem.title}" from Recycle Bin`
    );

    return originalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function permanentPurgeRecord(trashId: string, userEmail: string, userId: string) {
  const path = `trash/${trashId}`;
  try {
    const trashDocRef = doc(db, "trash", trashId);
    let trashItem: TrashItem | null = null;
    try {
      const trashSnap = await getDoc(trashDocRef);
      if (trashSnap.exists()) {
        trashItem = trashSnap.data() as TrashItem;
      }
    } catch (getErr) {
      console.warn(`[FirebaseService] Error reading trash doc prior to purge:`, getErr);
    }

    // Always unconditionally delete from Firestore trash collection
    await deleteDoc(trashDocRef);

    // If purging a cadet, also purge any related achievement trash items
    if (trashItem && ((trashItem.type as string) === "cadets" || (trashItem.type as string) === "cadet" || (trashItem.type as string) === "members")) {
      const cadetId = trashItem.data?.id;
      if (cadetId) {
        try {
          const trashSnapAll = await getDocs(collection(db, "trash"));
          for (const trDoc of trashSnapAll.docs) {
            const item = trDoc.data();
            if (item.type === "achievements" && item.data) {
              const achData = item.data;
              if (achData.memberId === cadetId || achData.recipientId === cadetId || achData.cadetId === cadetId) {
                await deleteDoc(doc(db, "trash", trDoc.id)).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.warn("Failed purging cadet related achievement trash items:", e);
        }
      }
    }

    // Log Audit Activity safely
    const itemTitle = trashItem?.title || trashId;
    const itemType = trashItem?.type || "Trash";
    const targetDocId = trashItem?.data?.id || trashId;

    await logActivity(
      userId,
      userEmail,
      "Permanent Purge",
      itemType,
      targetDocId,
      `Permanently purged ${itemType} item: "${itemTitle}" from physical memory`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// -------------------------------------------------------------------------
// STATS ENGINE (REAL-TIME COMPUTATION OVER DISK READS)
// -------------------------------------------------------------------------
export async function getLiveStats() {
  let totalMembers = 0;
  let activeCadets = 0;
  let alumni = 0;
  let totalEvents = 0;
  let campsCount = 0;
  let pendingApprovals = 0;
  let totalAwards = 0;

  try {
    const cadetSnap = await getDocs(collection(db, "cadets"));
    const cadets = cadetSnap.docs.map(d => d.data());
    totalMembers = cadets.length;
    activeCadets = cadets.filter(c => c.status === MemberStatus.ACTIVE_CADET && c.rank !== BNCCRank.PLATOON_UNDER_OFFICER).length;
    alumni = cadets.filter(c => c.status === MemberStatus.ALUMNI).length;
  } catch (error) {
    console.warn("[FirebaseService] Stats: Failed to fetch cadets (possibly insufficient permissions):", error);
  }

  try {
    const eventSnap = await getDocs(collection(db, "events"));
    totalEvents = eventSnap.docs.length;
  } catch (error) {
    console.warn("[FirebaseService] Stats: Failed to fetch events:", error);
  }

  try {
    const appSnap = await getDocs(collection(db, "applications"));
    pendingApprovals = appSnap.docs.map(d => d.data()).filter(a => a.status === "Pending").length;
  } catch (error) {
    // Expected for non-admin visitors who cannot read the applications collection
    console.log("[FirebaseService] Stats: Applications fetch bypassed for non-admin user.");
  }

  try {
    const achSnap = await getDocs(collection(db, "achievements"));
    totalAwards = achSnap.docs.length;
  } catch (error) {
    console.warn("[FirebaseService] Stats: Failed to fetch achievements:", error);
  }

  try {
    const campSnap = await getDocs(collection(db, "camps"));
    campsCount = campSnap.docs.length;
  } catch (error) {
    console.warn("[FirebaseService] Stats: Failed to fetch camps:", error);
  }

  return {
    totalMembers,
    activeCadets,
    alumni,
    events: totalEvents,
    camps: campsCount,
    pendingApprovals,
    totalAwards
  };
}

// -------------------------------------------------------------------------
// AUDIT LOGGING SERVICE
// -------------------------------------------------------------------------
export async function logActivity(
  userId: string,
  userEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  details: string
) {
  const logId = generateId("log");
  const path = `activityLogs/${logId}`;
  try {
    const logItem: AuditLog = {
      id: logId,
      userId: userId || "guest",
      userEmail: userEmail || "guest@ugcbncc.org",
      action,
      targetType,
      targetId,
      timestamp: new Date().toISOString(),
      details
    };
    await setDoc(doc(db, "activityLogs", logId), logItem);
  } catch (error) {
    console.error("[FirebaseService] Failed to record audit trail log:", error);
  }
}

// -------------------------------------------------------------------------
// REAL-TIME FIRESTORE EVENT LISTENERS
// -------------------------------------------------------------------------
export function subscribeToCollection<T>(collectionName: string, callback: (items: T[]) => void) {
  const colRef = collection(db, collectionName);
  // Default ordering of notices or event logs
  let q = query(colRef);
  if (collectionName === "activityLogs") {
    q = query(colRef, orderBy("timestamp", "desc"));
  } else if (collectionName === "notices" || collectionName === "news") {
    q = query(colRef, orderBy("date", "desc"));
  }
  
  return onSnapshot(
    q,
    (snapshot) => {
      const items: T[] = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id
      } as any));
      callback(items);
    },
    (error) => {
      const isPermissionErr =
        error?.code === "permission-denied" ||
        error?.message?.toLowerCase().includes("permission") ||
        error?.message?.toLowerCase().includes("insufficient");
      if (isPermissionErr) {
        console.warn(`[FirebaseService] Restricted collection subscription on '${collectionName}' (insufficient permissions). Defaulting to empty collection.`);
        callback([]);
      } else {
        console.error(`[FirebaseService] Subscription error on ${collectionName}:`, error);
      }
    }
  );
}

// -------------------------------------------------------------------------
// CRUD OPERATION ENGINE FOR MODULE CMS PANELS WITH AUTO-RETRY LOGIC
// -------------------------------------------------------------------------
async function runWithRetry<T>(fn: () => Promise<T>, retries: number = 3, delayMs: number = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message?.toLowerCase() || "";
      if (
        errMsg.includes("permission-denied") || 
        errMsg.includes("permission") || 
        errMsg.includes("insufficient permissions") ||
        err?.code === "permission-denied"
      ) {
        throw err;
      }
      console.warn(`[FirebaseService] Operation transient failure. Retrying (${i + 1}/${retries}) in ${delayMs * (i + 1)}ms...`, err);
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

export async function createDocument(collectionName: string, data: any, id?: string) {
  const docId = id || data.id || generateId(collectionName.substring(0, 3));
  const path = `${collectionName}/${docId}`;
  try {
    const finalData = { ...data, id: docId };
    return await runWithRetry(async () => {
      await setDoc(doc(db, collectionName, docId), finalData);
      return docId;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDocument(collectionName: string, id: string, data: any) {
  const path = `${collectionName}/${id}`;
  try {
    await runWithRetry(async () => {
      await updateDoc(doc(db, collectionName, id), data);
    });

    // If updating rank for a cadet/member, sync new rank to all their achievements
    if ((collectionName === "cadets" || collectionName === "members") && data.rank) {
      await syncCadetRankInAchievements(id, data.rank, data.fullName);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDocument(collectionName: string, id: string) {
  const path = `${collectionName}/${id}`;
  try {
    await runWithRetry(async () => {
      await deleteDoc(doc(db, collectionName, id));
    });

    // If deleting a cadet/member, hard delete all related achievements
    if (collectionName === "cadets" || collectionName === "members") {
      await removeCadetAchievements(id, false);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getSingleDocument(collectionName: string, id: string) {
  const docRef = doc(db, collectionName, id);
  const path = `${collectionName}/${id}`;
  try {
    return await runWithRetry(async () => {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function setSingleDocument(collectionName: string, id: string, data: any) {
  const path = `${collectionName}/${id}`;
  try {
    await runWithRetry(async () => {
      await setDoc(doc(db, collectionName, id), data, { merge: true });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function cleanUpDuplicateCampAndAchievements() {
  try {
    // 1. Clean up duplicate campParticipants
    const campPartsSnap = await getDocs(collection(db, "campParticipants"));
    if (!campPartsSnap.empty) {
      const seenCpKeys = new Set<string>();
      for (const docSnap of campPartsSnap.docs) {
        const data = docSnap.data();
        const memberId = data.memberId || "";
        const campId = data.campId || "";
        const campName = data.campName || "";
        const key = `${memberId}_${campId || campName.toLowerCase().trim()}`;
        if (seenCpKeys.has(key)) {
          // Duplicate document found, delete it from Firestore
          await deleteDoc(doc(db, "campParticipants", docSnap.id)).catch(() => {});
        } else {
          seenCpKeys.add(key);
        }
      }
    }

    // Load cadets list for backfilling missing recipient info
    const cadetsSnap = await getDocs(collection(db, "cadets"));
    const cadetsList = cadetsSnap.empty ? [] : cadetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    // 2. Clean up duplicate achievements & backfill missing recipient/issuedBy
    const achsSnap = await getDocs(collection(db, "achievements"));
    if (!achsSnap.empty) {
      const seenAchKeys = new Set<string>();
      for (const docSnap of achsSnap.docs) {
        const data = docSnap.data();
        const memberId = data.memberId || data.recipientId || data.cadetId || "";
        const title = (data.title || "").toLowerCase().trim();
        const key = `${memberId}_${title}`;
        if (seenAchKeys.has(key)) {
          // Duplicate document found, delete it from Firestore
          await deleteDoc(doc(db, "achievements", docSnap.id)).catch(() => {});
        } else {
          seenAchKeys.add(key);

          // Backfill recipient or issuedBy if missing/blank
          const updates: Record<string, any> = {};
          if (!data.recipient || data.recipient === "★" || !data.recipient.trim()) {
            if (memberId) {
              const match = cadetsList.find((c) => c.id === memberId || c.id.toUpperCase() === memberId.toUpperCase());
              if (match) {
                updates.recipient = `${match.rank || 'Cadet'} ${match.fullName}`.trim();
                updates.recipientId = memberId;
              }
            }
          }
          if (!data.issuedBy || !data.issuedBy.trim()) {
            updates.issuedBy = data.campName || (data.category === "Camp Honor" ? "3 Ramna Battalion Command" : "UGC Platoon Command");
          }
          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, "achievements", docSnap.id), updates).catch(() => {});
          }
        }
      }
    }

    // 3. Clean up homepage hero background and slideshow URLs if they contain casual party/unwanted images
    const homeRef = doc(db, "homepage", "main");
    const homeSnap = await getDoc(homeRef);
    if (homeSnap.exists()) {
      const hData = homeSnap.data();
      const updates: Record<string, any> = {};

      const isUnsplashUrl = (u: string) => u && (u.includes("unsplash.com") || u.includes("photo-1507003211169") || u.includes("photo-1506794778202"));

      if (hData.heroBgUrl && isUnsplashUrl(hData.heroBgUrl)) {
        updates.heroBgUrl = "";
      }

      if (Array.isArray(hData.heroSlideshowUrls)) {
        const cleanedSlides = hData.heroSlideshowUrls.filter((u: string) => !isUnsplashUrl(u));
        if (cleanedSlides.length !== hData.heroSlideshowUrls.length) {
          updates.heroSlideshowUrls = cleanedSlides;
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(homeRef, updates).catch(() => {});
      }
    }
  } catch (err) {
    console.debug("[cleanUpDuplicateCampAndAchievements] Skipped cleanup:", err);
  }
}

export async function autoSyncApplicationsWithCadets() {
  try {
    // First run cleanup on any existing duplicate documents in database
    await cleanUpDuplicateCampAndAchievements();

    const appsSnap = await getDocs(collection(db, "applications"));
    if (appsSnap.empty) return;

    const cadetsSnap = await getDocs(collection(db, "cadets"));
    if (cadetsSnap.empty) return;

    const cadetsList = cadetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Member));
    const campPartsSnap = await getDocs(collection(db, "campParticipants"));
    const existingCampParts = campPartsSnap.docs.map((d) => d.data());
    const achsSnap = await getDocs(collection(db, "achievements"));
    const existingAchs = achsSnap.docs.map((d) => d.data());

    for (const appDoc of appsSnap.docs) {
      const app = appDoc.data() as PlatoonApplication;
      if (!app.email && !app.cadetId) continue;

      // Find matching cadet in cadets collection
      const matchedCadet = cadetsList.find(
        (c) =>
          (app.cadetId && c.id.toUpperCase() === app.cadetId.toUpperCase()) ||
          (app.email && c.email && c.email.toLowerCase().trim() === app.email.toLowerCase().trim()) ||
          (app.phone && c.phone && c.phone.trim() === app.phone.trim())
      );

      if (!matchedCadet) continue;
      const memberId = matchedCadet.id;
      const recipientName = `${matchedCadet.rank || 'Cadet'} ${matchedCadet.fullName}`.trim();

      // 1. Sync campsParticipation
      if (app.campsParticipation && Array.isArray(app.campsParticipation)) {
        for (const cp of app.campsParticipation) {
          const exists = existingCampParts.some(
            (ecp: any) => ecp.memberId === memberId && (ecp.campId === cp.campId || ecp.campName?.toLowerCase() === cp.campName?.toLowerCase())
          );
          if (!exists) {
            const cpId = generateId("cp");
            await setDoc(doc(db, "campParticipants", cpId), {
              id: cpId,
              campId: cp.campId,
              memberId: memberId,
              role: cp.role || "Participant",
              awards: cp.achievements || "",
              remarks: "Auto-synced from application"
            });
            existingCampParts.push({ memberId, campId: cp.campId, campName: cp.campName });
          }

          if (cp.achievements && cp.achievements.trim()) {
            const achExists = existingAchs.some(
              (ea: any) => ea.memberId === memberId && ea.title?.trim().toLowerCase() === cp.achievements?.trim().toLowerCase()
            );
            if (!achExists) {
              const achId = generateId("ach");
              await setDoc(doc(db, "achievements", achId), {
                id: achId,
                memberId: memberId,
                recipientId: memberId,
                cadetId: memberId,
                recipient: recipientName,
                title: cp.achievements.trim(),
                description: `Earned award "${cp.achievements.trim()}" during ${cp.campName || "Battalion Camp"}.`,
                date: new Date().toISOString().split("T")[0],
                category: "Camp Honor",
                issuedBy: cp.campName || "3 Ramna Battalion Command",
                campName: cp.campName || "Battalion Camp"
              });
              existingAchs.push({ memberId, title: cp.achievements.trim() });
            }
          }
        }
      }

      // 2. Sync pastAchievements
      if (app.pastAchievements && app.pastAchievements.trim()) {
        const achExists = existingAchs.some(
          (ea: any) => ea.memberId === memberId && ea.title?.trim().toLowerCase() === app.pastAchievements?.trim().toLowerCase()
        );
        if (!achExists) {
          const achId = generateId("ach");
          await setDoc(doc(db, "achievements", achId), {
            id: achId,
            memberId: memberId,
            recipientId: memberId,
            cadetId: memberId,
            recipient: recipientName,
            title: app.pastAchievements.trim(),
            description: "Historical achievement listed during platoon application.",
            date: matchedCadet.joiningYear ? `${matchedCadet.joiningYear}-01-01` : new Date().toISOString().split("T")[0],
            category: "Past Honor",
            issuedBy: "UGC Platoon Command"
          });
          existingAchs.push({ memberId, title: app.pastAchievements.trim() });
        }
      }
    }
  } catch (err) {
    console.debug("[autoSyncApplicationsWithCadets] Skipped auto-sync:", err);
  }
}
