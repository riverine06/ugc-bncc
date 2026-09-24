import React from "react";
import { BreadcrumbItem, generateBreadcrumbSchema } from "../utils/seoSchemas";

export interface SEOProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: "website" | "article" | "profile";
  ogImage?: string;
  noIndex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  jsonLd?: Record<string, any> | Record<string, any>[];
  structuredData?: Record<string, any> | Record<string, any>[];
}

const DEFAULT_SITE_NAME = "Uttara Government College BNCC Platoon";
const DEFAULT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=1200&auto=format&fit=crop";

export default function SEO({
  title,
  description,
  canonicalPath,
  ogType = "website",
  ogImage,
  noIndex = false,
  breadcrumbs,
  jsonLd,
  structuredData,
}: SEOProps) {
  const activeJsonLd = structuredData || jsonLd;
  const breadcrumbsStr = React.useMemo(() => JSON.stringify(breadcrumbs || []), [breadcrumbs]);
  const jsonLdStr = React.useMemo(() => JSON.stringify(activeJsonLd || null), [activeJsonLd]);

  React.useEffect(() => {
    // 1. Update Document Title
    const formattedTitle = title.includes("BNCC") ? title : `${title} | ${DEFAULT_SITE_NAME}`;
    document.title = formattedTitle;

    // Helper to set or create meta tag
    const setMetaTag = (attrName: "name" | "property", attrValue: string, content: string) => {
      let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Helper to set or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!element) {
        element = document.createElement("link");
        element.setAttribute("rel", rel);
        document.head.appendChild(element);
      }
      element.setAttribute("href", href);
    };

    // 2. Canonical URL Resolution
    const origin = typeof window !== "undefined" ? window.location.origin : "https://ugcbncc.org";
    const path = canonicalPath || (typeof window !== "undefined" ? window.location.pathname : "/");
    const canonicalUrl = `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
    setLinkTag("canonical", canonicalUrl);

    // 3. Primary Meta Tags
    setMetaTag("name", "description", description);
    setMetaTag("name", "robots", noIndex ? "noindex, nofollow, noarchive" : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");

    // 4. OpenGraph Tags
    const resolvedImage = ogImage || DEFAULT_FALLBACK_IMAGE;
    setMetaTag("property", "og:site_name", DEFAULT_SITE_NAME);
    setMetaTag("property", "og:type", ogType);
    setMetaTag("property", "og:title", formattedTitle);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:url", canonicalUrl);
    setMetaTag("property", "og:image", resolvedImage);
    setMetaTag("property", "og:locale", "en_US");

    // 5. Twitter / X Cards
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", formattedTitle);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", resolvedImage);

    // 6. JSON-LD Structured Data
    const structuredDataPayloads: any[] = [];

    if (breadcrumbs && breadcrumbs.length > 0) {
      structuredDataPayloads.push(generateBreadcrumbSchema(breadcrumbs, origin));
    }

    if (activeJsonLd) {
      if (Array.isArray(activeJsonLd)) {
        structuredDataPayloads.push(...activeJsonLd);
      } else {
        structuredDataPayloads.push(activeJsonLd);
      }
    }

    let scriptElement = document.getElementById("page-structured-data") as HTMLScriptElement | null;
    if (structuredDataPayloads.length > 0) {
      if (!scriptElement) {
        scriptElement = document.createElement("script");
        scriptElement.id = "page-structured-data";
        scriptElement.type = "application/ld+json";
        document.head.appendChild(scriptElement);
      }
      scriptElement.textContent = JSON.stringify(
        structuredDataPayloads.length === 1 ? structuredDataPayloads[0] : structuredDataPayloads
      );
    } else if (scriptElement) {
      scriptElement.remove();
    }
  }, [title, description, canonicalPath, ogType, ogImage, noIndex, breadcrumbsStr, jsonLdStr]);

  return null;
}
