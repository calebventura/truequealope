import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types/product";
import { getAcceptedExchangeTypes } from "@/lib/productFilters";
import { ImageCarousel } from "@/components/ui/ImageCarousel";

type ProductCardProps = {
  product: Product;
  href: string;
  currentUserId?: string | null;
  nowTimestamp?: number;
  className?: string;
};

const NEW_BADGE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function ProductCard({
  product,
  href,
  currentUserId,
  nowTimestamp = Date.now(),
  className = "",
}: ProductCardProps) {
  const acceptedTypes = getAcceptedExchangeTypes(product);
  const isGiveaway = acceptedTypes.includes("giveaway");
  const isPermuta = acceptedTypes.includes("exchange_plus_cash");
  const acceptsMoney = acceptedTypes.includes("money");
  const isOwn = Boolean(currentUserId && product.sellerId === currentUserId);
  const isNew =
    product.status !== "sold" &&
    nowTimestamp - product.createdAt.getTime() < NEW_BADGE_WINDOW_MS;
  const acceptsTrade =
    acceptedTypes.includes("product") ||
    acceptedTypes.includes("service") ||
    acceptedTypes.includes("exchange_plus_cash");
  const wantedText =
    product.wanted && product.wanted.length > 0
      ? product.wanted.slice(0, 2).join(", ")
      : null;

  let modeBadge: string | null = null;
  if (isGiveaway) modeBadge = "Regalo";
  else if (isPermuta) modeBadge = "Permuta";
  else if (acceptsMoney && acceptsTrade) modeBadge = "Venta / Trueque";
  else if (acceptsMoney) modeBadge = "Venta";
  else if (acceptsTrade) modeBadge = "Trueque";

  return (
    <Link href={href} className={`group ${className}`}>
      <div
        className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 h-full flex flex-col border ${
          isOwn
            ? "border-indigo-200 dark:border-indigo-900 ring-1 ring-indigo-200/60 dark:ring-indigo-900/60"
            : "border-transparent dark:border-gray-800"
        }`}
      >
        <div className="relative aspect-square w-full bg-gray-200 dark:bg-gray-800">
          <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
            {isOwn && (
              <span className="bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                Tu publicacion
              </span>
            )}
            {isNew && (
              <span className="bg-yellow-100 dark:bg-yellow-900/80 text-yellow-800 dark:text-yellow-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                Nuevo
              </span>
            )}
            {modeBadge && (
              <span className="bg-indigo-100 dark:bg-indigo-900/80 text-indigo-800 dark:text-indigo-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
                {modeBadge}
              </span>
            )}
          </div>
          {product.status === "reserved" && (
            <div className="absolute top-2 right-2 z-10 bg-yellow-100 dark:bg-yellow-900/80 text-yellow-800 dark:text-yellow-100 text-xs font-bold px-2 py-1 rounded-full uppercase shadow-sm">
              Reservado
            </div>
          )}
          {product.images && product.images.length > 0 ? (
            product.images.length > 1 ? (
              <ImageCarousel images={product.images} alt={product.title} />
            ) : (
              <Image
                src={product.images[0]}
                alt={product.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
              Sin imagen
            </div>
          )}
        </div>

        <div className="p-4 space-y-2 flex-1 flex flex-col">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {product.condition === "like-new"
                ? "Como nuevo"
                : product.condition === "new"
                ? "Nuevo"
                : "Usado"}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
            {product.title}
          </h2>

          {(() => {
            const referentialPrice =
              typeof product.price === "number" ? product.price : null;

            if (isGiveaway) {
              return (
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                    Regalo
                  </p>
                  {referentialPrice !== null && (
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                      Valor referencial: S/. {referentialPrice.toLocaleString("es-PE")}
                    </p>
                  )}
                </div>
              );
            }

            if (isPermuta && referentialPrice !== null) {
              return (
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    S/. {referentialPrice.toLocaleString("es-PE")}
                  </p>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    Precio referencial total
                  </p>
                </div>
              );
            }

            if (acceptsMoney && referentialPrice !== null) {
              return (
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  S/. {referentialPrice.toLocaleString("es-PE")}
                </p>
              );
            }

            if (referentialPrice !== null) {
              return (
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Valor referencial: S/. {referentialPrice.toLocaleString("es-PE")}
                </p>
              );
            }

            return (
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {acceptsTrade ? "Solo trueque/intercambio" : "Consultar precio"}
              </p>
            );
          })()}

          {wantedText && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
              Busco: {wantedText}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-auto">
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 11c1.657 0 3-1.567 3-3.5S13.657 4 12 4s-3 1.567-3 3.5S10.343 11 12 11z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19.5 8.5c0 7-7.5 11.5-7.5 11.5S4.5 15.5 4.5 8.5A7.5 7.5 0 1119.5 8.5z"
                />
              </svg>
              {product.location}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {product.viewCount ?? 0}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
