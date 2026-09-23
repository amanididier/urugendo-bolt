import type { MetadataRoute } from "next";

const SITE_URL = "https://urugendo-v0.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/splash", "/search"],
        disallow: [
          "/api/",
          "/agent/",
          "/agency/",
          "/manager/",
          "/founder/",
          "/permissions",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
