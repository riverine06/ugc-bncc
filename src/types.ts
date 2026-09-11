/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  PUBLIC_VISITOR = "Public Visitor",
  APPLICANT = "Applicant",
  ACTIVE_CADET = "Active Cadet",
  ALUMNI = "Alumni",
  ADMIN = "Admin",
  SUPER_ADMIN = "Super Admin",
}

export enum MemberStatus {
  APPLICANT = "Applicant",
  ACTIVE_CADET = "Active Cadet",
  ALUMNI = "Alumni",
  PLATOON_OFFICER = "Platoon Officer (PUO)",
  HONORARY_MEMBER = "Honorary Member",
}

export enum BNCCRank {
  RECRUIT = "Recruit",
  CADET = "Cadet",
  LANCE_CORPORAL = "Lance Corporal",
  CORPORAL = "Corporal",
  SERGEANT = "Sergeant",
  CADET_UNDER_OFFICER = "Cadet Under Officer (CUO)",
  PLATOON_UNDER_OFFICER = "Platoon Under Officer (PUO)",
}

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  memberId: string | null;
  createdAt: string;
}

export interface Member {
  id: string; // Member ID, e.g., UGC-2023-001
  userId: string | null;
  fullName: string;
  photoUrl: string;
  rank: BNCCRank;
  department: string;
  session: string; // e.g., 2022-2023
  joiningYear: number;
  graduationYear: number | null;
  bloodGroup: string;
  phone: string;
  email: string;
  biography: string;
  status: MemberStatus;
  verified: boolean;
  currentProfession?: string;
  currentOrganization?: string;
  currentCity?: string;
  cadetIdImage?: string; // Reference image of Cadet ID Card
  hideContactInfo?: boolean;
  isArmyStaff?: boolean;
}

export interface Promotion {
  id: string;
  memberId: string;
  oldRank: BNCCRank;
  newRank: BNCCRank;
  date: string;
  promotedBy: string;
  description?: string;
}

export interface LeadershipPosition {
  id: string;
  memberId: string;
  title: string; // e.g., Platoon Commander, Cadet Adjutant
  startDate: string;
  endDate: string | null;
  current: boolean;
}

export interface Achievement {
  id: string;
  memberId: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  certificateUrl?: string;
  category?: string;
  recipient?: string;
  medalType?: string;
  issuedBy?: string;
}

export interface Certificate {
  id: string;
  memberId: string;
  title: string;
  type: "Camp" | "Achievement" | "Event" | "Service";
  url: string;
  issuedDate: string;
}

export interface Activity {
  id: string;
  memberId: string;
  activityName: string;
  date: string;
  description: string;
  photoUrl?: string;
}

export interface Camp {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface CampParticipant {
  id: string;
  campId: string;
  memberId: string;
  role: string; // e.g., Section Commander, Participant
  awards?: string;
  remarks?: string;
  certificateUrl?: string;
}

export enum EventType {
  IFTAR_MAHFIL = "Iftar Mahfil",
  REUNION = "Reunion",
  CAMP = "Camp",
  BLOOD_DONATION = "Blood Donation",
  COMMUNITY_SERVICE = "Community Service",
  TRAINING = "Training",
  PARADE = "Parade",
  NATIONAL_PROGRAM = "National Program",
  COMPETITION = "Competition",
  PICNIC = "Picnic",
  MEETING = "Meeting",
}

export interface PlatoonEvent {
  id: string;
  name: string;
  description: string;
  eventType: EventType;
  date: string;
  time: string;
  venue: string;
  registrationDeadline: string;
  maxParticipants: number;
  imageUrl: string;
  registrationFee: number;
  eligibilityRequirements: string;
}

export enum RegistrationStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
  WAITLISTED = "Waitlisted",
}

export interface EventRegistration {
  id: string;
  eventId: string;
  memberId: string | null; // null if guest/public visitor
  memberName: string;
  memberIdStr: string; // UGC ID or Guest
  phoneNumber: string;
  notes?: string;
  guestCount: number;
  dietaryRequirements?: string;
  transportationRequirements?: string;
  status: RegistrationStatus;
  registeredAt: string;
}

export enum AttendanceStatus {
  PRESENT = "Present",
  ABSENT = "Absent",
  EXCUSED = "Excused",
}

export interface EventAttendance {
  id: string;
  eventId: string;
  memberId: string;
  status: AttendanceStatus;
  markedAt: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  date?: string;
  createdAt?: string;
  description?: string;
  eventId?: string;
  campId?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  category: "General" | "Recruitment" | "Training" | "Emergency";
  pinned: boolean;
}

export interface ApplicationCampParticipation {
  campId: string;
  campName: string;
  role: string;
  achievements?: string;
}

export interface PlatoonApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  type: "Recruit" | "Cadet" | "Alumni";
  department: string;
  session: string;
  joiningYear: number;
  graduationYear?: number;
  highestRank?: BNCCRank;
  currentProfession?: string;
  currentOrganization?: string;
  currentCity?: string;
  pastAchievements?: string;
  campHistory?: string;
  campsParticipation?: ApplicationCampParticipation[];
  status: "Pending" | "Approved" | "Rejected";
  submittedAt: string;
  address?: string;
  photoUrl?: string;
  bloodGroup?: string;
  cadetId?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  details: string;
}

export interface LeadershipReference {
  id: string;
  memberId: string; // References Cadet ID
  cadetId?: string; // References Cadet ID (Normalized Reference)
  position: string; // e.g. "Platoon Commander", "Platoon Cadet Under Officer", "Platoon Sergeant", "Cadet Corporal", etc.
  displayOrder: number;
  status: "Active" | "Inactive";
  appointmentDate: string;
  endDate?: string;
  roleType: "platoon_commander" | "platoon_in_charge" | "section_leader" | "section_2ic";
}

export interface HomepageSection {
  heroTitle: string;
  heroSubtitle: string;
  heroBgUrl: string;
  heroBgOption: "upload" | "url";
  mottoEnglish: string;
  mottoBengali: string;
  establishedText: string;
  paragraphDescription: string;
  buttonText1: string;
  buttonText2: string;
  welcomeMessage: string;
  heroSlideshowUrls?: string[];
  commanderName?: string;
  commanderRank?: string;
  commanderPhoto?: string;
  commanderMessage?: string;
  statsActiveCadets?: number;
  statsAchievements?: number;
  statsCampsAttended?: number;
  statsBloodUnits?: number;
}

export interface TrashItem {
  id: string;
  type: "cadet" | "event" | "achievement" | "document" | "gallery" | "notice" | "leadership" | "former_puo";
  title: string;
  deletedAt: string;
  data: any;
}

export interface FormerPUO {
  id: string;
  name: string;
  photo: string;
  session: string;
  department: string;
  servicePeriod: string; // e.g., "2018 - 2022" or "2022 - 2025"
  startYear?: number;
  endYear?: number;
  status?: "Active" | "Former";
}
