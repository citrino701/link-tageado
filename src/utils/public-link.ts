import type { LinkRecord } from "../services/store.ts";

const DEFAULT_PUBLIC_LINK_BASE = "https://citrino701.github.io/link-tageado/";

export function buildPublicLink(link: LinkRecord): string {
  const base = window.HUB_CONFIG?.publicLinkBaseUrl || DEFAULT_PUBLIC_LINK_BASE;
  const url = new URL(base);
  url.searchParams.set("id", link.id);
  if (link.source) url.searchParams.set("utm_source", link.source);
  if (link.medium) url.searchParams.set("utm_medium", link.medium);
  if (link.campaign) url.searchParams.set("utm_campaign", link.campaign);
  if (link.content) url.searchParams.set("utm_content", link.content);
  return url.toString();
}
