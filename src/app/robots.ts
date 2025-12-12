import type { MetadataRoute } from "next";

export const runtime = "nodejs";

function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const isVercelProduction =
    !process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production";

  if (!isVercelProduction) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
      sitemap: `${siteUrl}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth", "/activity", "/products/new", "/api"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

