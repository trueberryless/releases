import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

import { getRecentReleases } from "../libs/data";
import { getRSSOptions } from "../libs/rss";

export const GET: APIRoute = ({ site }) => {
  if (!site)
    throw new Error(
      "The Astro `site` option is required to generate the RSS feed."
    );

  return rss(getRSSOptions(getRecentReleases(), site));
};
