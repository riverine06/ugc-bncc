import { getSingleDocument, setSingleDocument } from "./firestore";
import { HomepageSection } from "../../types";

export async function getSettings(settingId: string): Promise<any | null> {
  return getSingleDocument("settings", settingId);
}

export async function updateSettings(settingId: string, data: any): Promise<void> {
  return setSingleDocument("settings", settingId, data);
}

export async function getHomepageConfig(): Promise<HomepageSection | null> {
  return (await getSingleDocument("homepage", "main")) as HomepageSection | null;
}

export async function updateHomepageConfig(data: Partial<HomepageSection>): Promise<void> {
  return setSingleDocument("homepage", "main", data);
}

export const settingsService = {
  getSettings,
  updateSettings,
  getHomepageConfig,
  updateHomepageConfig,
};
