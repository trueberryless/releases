import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

import { getRecentReleases } from "../../libs/data";
import { getRSSArchiveOptions, getRSSArchives } from "../../libs/rss";

export function getStaticPaths() {
  return getRSSArchives(getRecentReleases()).map((archive) => ({
    params: { archive },
  }));
}

export const GET: APIRoute = ({ params, site }) => {
  if (!site)
    throw new Error(
      "The Astro `site` option is required to generate the RSS feed."
    );
  if (!params["archive"])
    throw new Error(
      "Missing RSS `archive` parameter to generate the RSS archive feed."
    );

  return rss(
    getRSSArchiveOptions(getRecentReleases(), site, params["archive"])
  );
};
