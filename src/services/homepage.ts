import { getSingleDocument, setSingleDocument } from "../firebaseService";
import { HomepageSection } from "../types";

export const homepageService = {
  getHomepageConfig: async (): Promise<HomepageSection | null> => {
    return (await getSingleDocument("homepage", "main")) as HomepageSection | null;
  },

  updateHomepageConfig: async (data: Partial<HomepageSection>): Promise<void> => {
    return setSingleDocument("homepage", "main", data);
  }
};
