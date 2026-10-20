import type { LinkRecord } from "../services/store.ts";

const DEFAULT_PUBLIC_LINK_BASE = "https://citrino701.github.io/link-tageado/";
const LONG_PUBLIC_LINK_BASE = "https://citrino701.github.io/link-tageado/";

export type PublicLinkFormat = "short" | "long";

export function buildPublicLink(link: LinkRecord, format: PublicLinkFormat = "short"): string {
  const base = format === "long"
    ? LONG_PUBLIC_LINK_BASE
    : window.HUB_CONFIG?.publicLinkBaseUrl || DEFAULT_PUBLIC_LINK_BASE;
  const url = new URL(base);
  // Campaign tags are resolved by the registry in short mode. The long format
  // includes them in the URL for services that reject bare redirect links.
  url.searchParams.set("id", link.id);
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "origem") url.searchParams.delete(key);
  }
  if (format === "long") {
    if (link.source) url.searchParams.set("utm_source", link.source);
    if (link.medium) url.searchParams.set("utm_medium", link.medium);
    if (link.campaign) url.searchParams.set("utm_campaign", link.campaign);
    if (link.content) url.searchParams.set("utm_content", link.content);
  }
  return url.toString();
}

export function displayPublicLink(link: LinkRecord, format: PublicLinkFormat = "short"): string {
  return buildPublicLink(link, format).replace(/^https?:\/\//, "");
}
