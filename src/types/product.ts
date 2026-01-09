import type { FieldValue } from "firebase/firestore";

export type ProductMode = "sale" | "trade" | "both";
export type ListingType = "product" | "service";
export type ExchangeType = "money" | "product" | "service" | "exchange_plus_cash" | "giveaway";
export type ProductVisibility = "public" | "community";
export type TimestampLike =
  | Date
  | { toDate: () => Date }
  | string
  | number
  | FieldValue;

export interface Product {
  id?: string;
  sellerId: string;
  title: string;
  description: string;
  /**
   * Precio de venta. Puede ser null/undefined si el producto es solo trueque.
   */
  price?: number | null;
  categoryId: string;
  images: string[];
  status: "active" | "reserved" | "sold" | "deleted";
  condition: "new" | "used" | "like-new";
  location: string;
  createdAt: Date;
  reservedAt?: TimestampLike | null;
  soldAt?: TimestampLike | null;
  /**
   * Modo de publicación:
   * - sale: solo venta
   * - trade: solo trueque
   * - both: venta o trueque
   * Opcional para compatibilidad con publicaciones antiguas.
   */
  mode?: ProductMode;
  /**
   * Lista simple de lo que el vendedor busca a cambio.
   * Opcional para compatibilidad con publicaciones antiguas.
   */
  wanted?: string[];
  /**
   * Descripción específica de productos buscados (para filtrado).
   */
  wantedProducts?: string;
  /**
   * Descripción específica de servicios buscados (para filtrado).
   */
  wantedServices?: string;
  /**
   * Texto libre cuando la categoria elegida es "other".
   */
  otherCategoryLabel?: string | null;
  /**
   * Datos del comprador/reservante (captura opcional).
   */
  reservedForUserId?: string | null;
  reservedForContact?: string | null;
  /**
   * Datos de la operación final (venta/trueque/permuta/donación).
   */
  finalBuyerUserId?: string | null;
  finalBuyerContact?: string | null;
  finalDealPrice?: number | null;
  finalDealItems?: string | null;
  finalizedAt?: TimestampLike | null;
  searchKeywords?: string[];

  // Nuevos campos Release 1.0
  listingType?: ListingType;
  acceptedExchangeTypes?: ExchangeType[];
  exchangeCashDelta?: number | null; // (Deprecated) Diferencia en dinero para permuta; conservado por compatibilidad

  // Comunidad / visibilidad
  visibility?: ProductVisibility;
  communityId?: string | null;
  communityIds?: string[];

  /**
   * Etiquetas de tendencia para curacion manual.
   */
  trendTags?: string[];
  /**
   * Contador de visibilizaciones (vistas únicas por usuario/dispositivo).
   */
  viewCount?: number | null;
}

