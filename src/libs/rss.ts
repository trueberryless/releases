import type { RSSFeedItem, RSSOptions } from "@astrojs/rss";

import { SITE_DESCRIPTION, SITE_TITLE } from "./config.ts";
import type { Release } from "./releases.ts";

const RSS_ITEM_LIMIT = 20;
const RSS_LANGUAGE = "en";

export const RSS_PATH = "/rss.xml";

export function getRSSOptions(
  releases: Release[],
  site: URL,
  now: Date = new Date()
): RSSOptions {
  const archives = getRSSArchives(releases, now);
  const rssReleases =
    archives.length === 0 ? releases : getRSSReleases(releases, now);
  const isComplete = rssReleases.length === releases.length;
  const links = getRSSLinks(site, archives, isComplete);

  return getRSSOptionsForReleases(
    rssReleases,
    site,
    getRSSCustomData(links, { complete: isComplete })
  );
}

export function getRSSArchiveOptions(
  releases: Release[],
  site: URL,
  archive: string,
  now: Date = new Date()
): RSSOptions {
  const archives = getRSSArchives(releases, now);
  if (!archives.includes(archive)) {
    throw new Error(`Unknown RSS archive \`${archive}\`.`);
  }

  const archiveReleases = releases.filter(
    (release) => getRSSArchiveKey(release.publishedAt) === archive
  );
  const links = getRSSArchiveLinks(site, archives, archive);

  return getRSSOptionsForReleases(
    archiveReleases,
    site,
    getRSSCustomData(links, { archive: true })
  );
}

/**
 * Returns the monthly archive keys (`YYYY-MM`) of all past months containing at least one release, newest first. The
 * current month is never archived as it can still receive new releases.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc5005#section-4
 */
export function getRSSArchives(
  releases: Release[],
  now: Date = new Date()
): string[] {
  if (releases.length <= RSS_ITEM_LIMIT) return [];

  const currentArchive = getRSSArchiveKey(now);
  const archives = new Set<string>();

  for (const release of releases) {
    const archive = getRSSArchiveKey(release.publishedAt);
    if (archive < currentArchive) archives.add(archive);
  }

  return [...archives].toSorted().toReversed();
}

export function getRSSURL(site: URL): string {
  return new URL(RSS_PATH, site).href;
}

function getRSSReleases(releases: Release[], now: Date): Release[] {
  const currentArchive = getRSSArchiveKey(now);
  const rssReleases = new Set(releases.slice(0, RSS_ITEM_LIMIT));

  // Always include every release of the current month as the current month is not archived yet and these releases
  // would otherwise not be reachable by feed readers.
  for (const release of releases) {
    if (getRSSArchiveKey(release.publishedAt) >= currentArchive) {
      rssReleases.add(release);
    }
  }

  return [...rssReleases];
}

function getRSSOptionsForReleases(
  releases: Release[],
  site: URL,
  customData: string
): RSSOptions {
  return {
    customData,
    description: SITE_DESCRIPTION,
    items: releases.map(releaseToRSSItem),
    site: site.href,
    title: SITE_TITLE,
    // https://datatracker.ietf.org/doc/html/rfc5005#appendix-B
    xmlns: {
      atom: "http://www.w3.org/2005/Atom",
      fh: "http://purl.org/syndication/history/1.0",
    },
  };
}

function releaseToRSSItem(release: Release): RSSFeedItem {
  return {
    categories: [release.repository],
    description: release.summary,
    link: release.url,
    pubDate: new Date(release.publishedAt),
    title: `${release.package} v${release.version}`,
  };
}

function getRSSCustomData(
  links: RSSLink[],
  options: { archive?: boolean; complete?: boolean } = {}
): string {
  const customData = [`<language>${RSS_LANGUAGE}</language>`];

  if (options.archive) customData.push("<fh:archive/>");
  if (options.complete) customData.push("<fh:complete/>");

  customData.push(
    ...links.map(
      (link) =>
        `<atom:link rel="${link.rel}" href="${link.href}" type="application/rss+xml"/>`
    )
  );

  return customData.join("\n");
}

function getRSSLinks(
  site: URL,
  archives: string[],
  isComplete: boolean
): RSSLink[] {
  const links: RSSLink[] = [{ href: getRSSURL(site), rel: "self" }];

  const previousArchive = archives[0];
  if (!isComplete && previousArchive) {
    links.push({
      href: getRSSArchiveURL(site, previousArchive),
      rel: "prev-archive",
    });
  }

  return links;
}

function getRSSArchiveLinks(
  site: URL,
  archives: string[],
  archive: string
): RSSLink[] {
  const archiveIndex = archives.indexOf(archive);
  const previousArchive = archives[archiveIndex + 1];
  const nextArchive = archiveIndex > 0 ? archives[archiveIndex - 1] : undefined;

  const links: RSSLink[] = [
    { href: getRSSURL(site), rel: "current" },
    { href: getRSSArchiveURL(site, archive), rel: "self" },
  ];

  if (previousArchive) {
    links.push({
      href: getRSSArchiveURL(site, previousArchive),
      rel: "prev-archive",
    });
  }

  if (nextArchive) {
    links.push({
      href: getRSSArchiveURL(site, nextArchive),
      rel: "next-archive",
    });
  }

  return links;
}

function getRSSArchiveURL(site: URL, archive: string): string {
  return new URL(`/rss/${archive}.xml`, site).href;
}

function getRSSArchiveKey(_date: Date | string): string {
  const date = new Date(_date);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

interface RSSLink {
  href: string;
  rel: "current" | "next-archive" | "prev-archive" | "self";
}
