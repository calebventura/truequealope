import type { Metadata } from "next";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

type ProductRouteProps = {
  params: Promise<{ id: string }>;
};

function coerceString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function coerceImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && item.startsWith("http"))
    .slice(0, 4);
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export async function generateMetadata({
  params,
}: ProductRouteProps): Promise<Metadata> {
  const { id } = await params;
  const siteName = "Truequéalope";
  const canonicalPath = `/products/${id}`;

  try {
    const snap = await adminDb.collection("products").doc(id).get();
    if (!snap.exists) {
      return {
        title: `Producto no encontrado | ${siteName}`,
        robots: { index: false, follow: false },
      };
    }

    const data = snap.data() ?? {};
    const title = coerceString(data.title) ?? "Producto";
    const descriptionRaw =
      coerceString(data.description) ?? "Ver producto en Truequéalope.";
    const description = truncate(descriptionRaw, 160);
    const images = coerceImages(data.images);
    const imageUrl = images[0] ?? null;
    const status = coerceString(data.status);
    const price = coerceNumber(data.price);

    const fullTitle = `${title} | ${siteName}`;

    const ogImages = imageUrl
      ? [
          {
            url: imageUrl,
            alt: title,
          },
        ]
      : undefined;

    return {
      title: fullTitle,
      description,
      alternates: { canonical: canonicalPath },
      robots:
        status === "deleted"
          ? { index: false, follow: false }
          : { index: true, follow: true },
      openGraph: {
        type: "website",
        url: canonicalPath,
        siteName,
        title: fullTitle,
        description,
        images: ogImages,
      },
      twitter: {
        card: imageUrl ? "summary_large_image" : "summary",
        title: fullTitle,
        description,
        images: imageUrl ? [imageUrl] : undefined,
      },
      other:
        price != null
          ? {
              "product:price:amount": `${price}`,
              "product:price:currency": "PEN",
            }
          : undefined,
    };
  } catch (error) {
    console.error("generateMetadata failed:", error);
    return {
      title: `Producto | ${siteName}`,
      description: "Ver producto en Truequéalope.",
      alternates: { canonical: canonicalPath },
    };
  }
}

export default function ProductLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
