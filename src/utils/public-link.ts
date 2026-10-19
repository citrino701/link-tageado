import type { LinkRecord } from "../services/store.ts";

const DEFAULT_PUBLIC_LINK_BASE = "https://citrino701.github.io/link-tageado/";

export function buildPublicLink(link: LinkRecord): string {
  const base = window.HUB_CONFIG?.publicLinkBaseUrl || DEFAULT_PUBLIC_LINK_BASE;
  const url = new URL(base);
  // Tags are stored in the registry and resolved by the public tracker using this ID.
  // Keep the copied address compact even for campaigns with long names/content.
  url.searchParams.set("id", link.id);
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('utm_') || key === 'origem') url.searchParams.delete(key);
  }
  return url.toString();
}

export function displayPublicLink(link: LinkRecord): string {
  return buildPublicLink(link).replace(/^https?:\/\//, '');
}

