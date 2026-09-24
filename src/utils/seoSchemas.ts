/**
 * Schema.org JSON-LD Structured Data Generators for UGC BNCC Platoon
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export const PLATOON_ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "GovernmentOrganization",
  "@id": "https://ugcbncc.org/#organization",
  "name": "Uttara Government College BNCC Platoon",
  "alternateName": [
    "UGC BNCC Platoon",
    "UGC BNCC",
    "Uttara Govt College BNCC"
  ],
  "url": "https://ugcbncc.org/",
  "logo": "https://ugcbncc.org/assets/logo.png",
  "description": "Official digital platform and command operations of the Bangladesh National Cadet Corps (BNCC) Platoon of Uttara Government College under 3 Ramna Battalion, Ramna Regiment, established in 2018.",
  "foundingDate": "2018",
  "parentOrganization": {
    "@type": "GovernmentOrganization",
    "name": "Bangladesh National Cadet Corps (BNCC) - 3 Ramna Battalion, Ramna Regiment",
    "alternateName": "Ramna Regiment BNCC"
  },
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Uttara Government College campus, Sector-7",
    "addressLocality": "Uttara",
    "addressRegion": "Dhaka",
    "postalCode": "1230",
    "addressCountry": "BD"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+880-1712-345678",
    "contactType": "Admissions & Platoon Command Hotline",
    "email": "ugc.bncc@gmail.com",
    "availableLanguage": ["Bengali", "English"]
  }
};

export const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://ugcbncc.org/#website",
  "url": "https://ugcbncc.org/",
  "name": "UGC BNCC Digital Platoon Portal",
  "description": "Public records, cadet roster, recruitment portal, event schedule, and training archive for UGC BNCC Platoon.",
  "publisher": {
    "@id": "https://ugcbncc.org/#organization"
  },
  "inLanguage": "en-US"
};

export function generateBreadcrumbSchema(items: BreadcrumbItem[], baseUrl: string = "https://ugcbncc.org") {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => {
      const fullUrl = item.url.startsWith("http")
        ? item.url
        : `${baseUrl}${item.url.startsWith("/") ? "" : "/"}${item.url}`;
      return {
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": fullUrl
      };
    })
  };
}

export function generateEventSchema(event: {
  id?: string;
  name: string;
  date: string;
  time?: string;
  location?: string;
  venue?: string;
  description?: string;
  category?: string;
  eventType?: string;
  photo?: string;
  coverImage?: string;
}, baseUrl: string = "https://ugcbncc.org") {
  // Construct ISO start date
  const isoStartDate = event.date ? `${event.date}T${event.time && event.time.includes(":") ? event.time.padStart(5, "0") : "09:00"}:00+06:00` : new Date().toISOString();

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": event.name,
    "startDate": isoStartDate,
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "eventStatus": "https://schema.org/EventScheduled",
    "location": {
      "@type": "Place",
      "name": event.venue || event.location || "Uttara Government College Parade Ground",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Uttara Government College campus, Sector-7",
        "addressLocality": "Uttara",
        "addressRegion": "Dhaka",
        "postalCode": "1230",
        "addressCountry": "BD"
      }
    },
    "image": event.photo || event.coverImage || `${baseUrl}/assets/og-cover.png`,
    "description": event.description || `Military drill, training parade, and operational event organized by UGC BNCC Platoon.`,
    "organizer": {
      "@id": "https://ugcbncc.org/#organization"
    }
  };
}

export function generateEventsSchema(events: any[], baseUrl: string = "https://ugcbncc.org") {
  return events.slice(0, 10).map((evt) => generateEventSchema(evt, baseUrl));
}
