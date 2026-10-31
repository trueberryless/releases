import { describe, expect, test } from "vitest";

import type { Release } from "../../src/libs/releases";
import {
  getRSSArchiveOptions,
  getRSSArchives,
  getRSSOptions,
} from "../../src/libs/rss";

const site = new URL("https://example.com");
const now = new Date("2024-03-15T12:00:00Z");

describe("getRSSOptions", () => {
  test("includes release items", () => {
    const { items } = getRSSOptions([createRelease("1", "2024-03-01")], site, now);

    expect(items).toEqual([
      {
        categories: ["repo"],
        description: "Summary 1",
        link: "https://github.com/org/repo/releases/tag/1",
        pubDate: new Date("2024-03-01T00:00:00Z"),
        title: "pkg v1.0.0",
      },
    ]);
  });

  test("uses the site as the channel link", () => {
    expect(getRSSOptions([], site, now).site).toBe("https://example.com/");
  });

  test("includes the RFC 5005 namespaces", () => {
    expect(getRSSOptions([], site, now).xmlns).toEqual({
      atom: "http://www.w3.org/2005/Atom",
      fh: "http://purl.org/syndication/history/1.0",
    });
  });

  test("marks small feeds as complete", () => {
    const releases = createReleases(5, "2024-01-10");

    const options = getRSSOptions(releases, site, now);

    expect(options.items).toHaveLength(5);
    expect(options.customData).toContain("<fh:complete/>");
    expect(options.customData).toContain(
      '<atom:link rel="self" href="https://example.com/rss.xml" type="application/rss+xml"/>'
    );
    expect(options.customData).not.toContain("prev-archive");
  });

  test("limits large feeds and links to the previous archive", () => {
    const releases = createReleases(25, "2024-02-10");

    const options = getRSSOptions(releases, site, now);

    expect(options.items).toHaveLength(20);
    expect(options.customData).not.toContain("<fh:complete/>");
    expect(options.customData).toContain(
      '<atom:link rel="prev-archive" href="https://example.com/rss/2024-02.xml" type="application/rss+xml"/>'
    );
  });

  test("includes all releases of the current month even past the limit", () => {
    const releases = [
      ...createReleases(25, "2024-03-10"),
      ...createReleases(5, "2024-02-10", 25),
    ];

    expect(getRSSOptions(releases, site, now).items).toHaveLength(25);
  });
});

describe("getRSSArchives", () => {
  test("returns no archives for small feeds", () => {
    expect(getRSSArchives(createReleases(20, "2024-01-10"), now)).toEqual([]);
  });

  test("returns past months newest first", () => {
    const releases = [
      ...createReleases(10, "2024-03-10"),
      ...createReleases(10, "2024-02-10", 10),
      ...createReleases(10, "2023-12-10", 20),
    ];

    expect(getRSSArchives(releases, now)).toEqual(["2024-02", "2023-12"]);
  });
});

describe("getRSSArchiveOptions", () => {
  const releases = [
    ...createReleases(10, "2024-02-10"),
    ...createReleases(10, "2024-01-10", 10),
    ...createReleases(10, "2023-12-10", 20),
  ];

  test("includes only releases from the archive period", () => {
    const options = getRSSArchiveOptions(releases, site, "2024-01", now);

    expect(options.items).toHaveLength(10);
    expect(options.customData).toContain("<fh:archive/>");
  });

  test("links to the current feed, itself and adjacent archives", () => {
    const { customData } = getRSSArchiveOptions(releases, site, "2024-01", now);

    expect(customData).toContain(
      '<atom:link rel="current" href="https://example.com/rss.xml" type="application/rss+xml"/>'
    );
    expect(customData).toContain(
      '<atom:link rel="self" href="https://example.com/rss/2024-01.xml" type="application/rss+xml"/>'
    );
    expect(customData).toContain(
      '<atom:link rel="prev-archive" href="https://example.com/rss/2023-12.xml" type="application/rss+xml"/>'
    );
    expect(customData).toContain(
      '<atom:link rel="next-archive" href="https://example.com/rss/2024-02.xml" type="application/rss+xml"/>'
    );
  });

  test("does not link the newest archive to a newer archive", () => {
    const { customData } = getRSSArchiveOptions(releases, site, "2024-02", now);

    expect(customData).not.toContain('rel="next-archive"');
  });

  test("does not link the oldest archive to an older archive", () => {
    const { customData } = getRSSArchiveOptions(releases, site, "2023-12", now);

    expect(customData).not.toContain('rel="prev-archive"');
  });

  test("throws for unknown archives", () => {
    expect(() =>
      getRSSArchiveOptions(releases, site, "2020-01", now)
    ).toThrow("Unknown RSS archive `2020-01`.");
  });
});

function createReleases(count: number, date: string, offset = 0): Release[] {
  return Array.from({ length: count }, (_, index) =>
    createRelease(String(offset + index), date)
  );
}

function createRelease(id: string, date: string): Release {
  return {
    id,
    package: "pkg",
    publishedAt: `${date}T00:00:00Z`,
    repository: "repo",
    summary: `Summary ${id}`,
    url: `https://github.com/org/repo/releases/tag/${id}`,
    version: "1.0.0",
  };
}
