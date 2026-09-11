import { Member, MemberStatus, FormerPUO } from "../types";

/**
 * Checks whether a member is currently Active.
 * Former/Alumni members and Applicants are NOT active.
 * If the member corresponds to a PUO record marked "Former", they are NOT active.
 */
export function isMemberActive(
  member: Member | null | undefined,
  formerPUOs?: FormerPUO[]
): boolean {
  if (!member) return false;

  // Explicit Alumni / Former statuses
  if (member.status === MemberStatus.ALUMNI) return false;
  if ((member as any).status === "Former" || (member as any).status === "former") return false;
  if (member.status === MemberStatus.APPLICANT) return false;

  // Cross-reference with PUO records if provided
  if (formerPUOs && formerPUOs.length > 0) {
    const matchedPuo = formerPUOs.find(
      (p) =>
        p.id === member.id ||
        (p.name && member.fullName && p.name.trim().toLowerCase() === member.fullName.trim().toLowerCase())
    );
    if (matchedPuo && matchedPuo.status === "Former") {
      return false;
    }
  }

  // Active Cadet, Platoon Officer, or verified active member
  if (member.status === MemberStatus.ACTIVE_CADET || member.status === MemberStatus.PLATOON_OFFICER) {
    return true;
  }

  // Fallback check
  return member.verified !== false;
}

/**
 * Returns the effective status of a PUO record.
 * "Existing POUs without a status should be treated as Active."
 */
export function getPUOStatus(puo: FormerPUO | null | undefined): "Active" | "Former" {
  if (!puo) return "Active";
  return puo.status === "Former" ? "Former" : "Active";
}

/**
 * Standard display constant
 */
export const TO_BE_ANNOUNCED = "To Be Announced";

export interface SectionSlotItem {
  slotNumber: 1 | 2 | 3;
  sectionName: string;
  defaultTitle: string;
  roleType: "section_leader" | "section_2ic";
  reference?: any;
  isAssigned: boolean;
}

/**
 * Resolves the standard 3 Section slots for Level 3 (Section Leaders)
 * and Level 4 (2nd in Command / 2IC) according to BNCC platoon doctrine (3 sections per platoon).
 */
export function resolveSectionSlotsWithOverflow(
  references: any[],
  roleType: "section_leader" | "section_2ic"
): { slots: SectionSlotItem[]; extraRefs: any[] } {
  const roleRefs = [...(references || []).filter((r) => r.roleType === roleType)].sort(
    (a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0)
  );

  const slots: SectionSlotItem[] = [
    {
      slotNumber: 1,
      sectionName: "Section 1",
      defaultTitle: roleType === "section_leader" ? "Section 1 Leader" : "Section 1 2IC",
      roleType,
      isAssigned: false,
    },
    {
      slotNumber: 2,
      sectionName: "Section 2",
      defaultTitle: roleType === "section_leader" ? "Section 2 Leader" : "Section 2 2IC",
      roleType,
      isAssigned: false,
    },
    {
      slotNumber: 3,
      sectionName: "Section 3",
      defaultTitle: roleType === "section_leader" ? "Section 3 Leader" : "Section 3 2IC",
      roleType,
      isAssigned: false,
    },
  ];

  const detectSlot = (ref: any): number | null => {
    const pos = (ref.position || "").toLowerCase();
    if (/\b(1|one|alpha)\b/i.test(pos) || pos.includes("section 1") || pos.includes("section-1") || pos.includes("sec 1") || pos.includes("section i\b")) return 1;
    if (/\b(2|two|bravo)\b/i.test(pos) || pos.includes("section 2") || pos.includes("section-2") || pos.includes("sec 2") || pos.includes("section ii\b")) return 2;
    if (/\b(3|three|charlie)\b/i.test(pos) || pos.includes("section 3") || pos.includes("section-3") || pos.includes("sec 3") || pos.includes("section iii\b")) return 3;
    if (ref.displayOrder === 1 || ref.displayOrder === 10) return 1;
    if (ref.displayOrder === 2 || ref.displayOrder === 20) return 2;
    if (ref.displayOrder === 3 || ref.displayOrder === 30) return 3;
    return null;
  };

  const usedRefIds = new Set<string>();

  // 1. Match explicit slot references first
  for (const ref of roleRefs) {
    const detected = detectSlot(ref);
    if (detected && detected >= 1 && detected <= 3 && !slots[detected - 1].isAssigned) {
      slots[detected - 1].reference = ref;
      slots[detected - 1].isAssigned = true;
      usedRefIds.add(ref.id);
    }
  }

  // 2. Sequential assignment for remaining refs
  for (const ref of roleRefs) {
    if (usedRefIds.has(ref.id)) continue;
    const emptySlot = slots.find((s) => !s.isAssigned);
    if (emptySlot) {
      emptySlot.reference = ref;
      emptySlot.isAssigned = true;
      usedRefIds.add(ref.id);
    }
  }

  // 3. Collect any extra references beyond the standard 3 sections
  const extraRefs = roleRefs.filter((r) => !usedRefIds.has(r.id));

  return { slots, extraRefs };
}

export interface CommandPositionOption {
  label: string;
  value: string;
  roleType: "platoon_commander" | "platoon_in_charge" | "section_leader" | "section_2ic";
  defaultOrder: number;
  group: string;
}

export const STANDARD_COMMAND_POSITIONS: CommandPositionOption[] = [
  { label: "Platoon Commander", value: "Platoon Commander", roleType: "platoon_commander", defaultOrder: 1, group: "Level I: Platoon Commander" },
  { label: "Platoon In Charge (CUO)", value: "Platoon In Charge", roleType: "platoon_in_charge", defaultOrder: 2, group: "Level II: Platoon In Charge" },
  { label: "Section 1 Leader", value: "Section 1 Leader", roleType: "section_leader", defaultOrder: 1, group: "Level III: Section Leaders (3 Slots)" },
  { label: "Section 2 Leader", value: "Section 2 Leader", roleType: "section_leader", defaultOrder: 2, group: "Level III: Section Leaders (3 Slots)" },
  { label: "Section 3 Leader", value: "Section 3 Leader", roleType: "section_leader", defaultOrder: 3, group: "Level III: Section Leaders (3 Slots)" },
  { label: "Section 1 2IC", value: "Section 1 2IC", roleType: "section_2ic", defaultOrder: 1, group: "Level IV: 2nd In Command (3 Slots)" },
  { label: "Section 2 2IC", value: "Section 2 2IC", roleType: "section_2ic", defaultOrder: 2, group: "Level IV: 2nd In Command (3 Slots)" },
  { label: "Section 3 2IC", value: "Section 3 2IC", roleType: "section_2ic", defaultOrder: 3, group: "Level IV: 2nd In Command (3 Slots)" },
];
