import type { MetadataRoute } from "next";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    value != null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return new Date();
    }
  }
  return new Date();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const urls: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now },
    { url: `${siteUrl}/search`, lastModified: now },
  ];

  try {
    const snap = await adminDb
      .collection("products")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    for (const doc of snap.docs) {
      const data = doc.data() ?? {};
      const status = typeof data.status === "string" ? data.status : "active";
      if (status !== "active") continue;
      urls.push({
        url: `${siteUrl}/products/${doc.id}`,
        lastModified: toDate((data as { createdAt?: unknown }).createdAt),
      });
    }
  } catch (error) {
    console.error("sitemap failed:", error);
  }

  return urls;
}

