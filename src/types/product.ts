export type ProductMode = "sale" | "trade" | "both";
export type ListingType = "product" | "service";
export type ExchangeType = "money" | "product" | "service" | "exchange_plus_cash" | "giveaway";
export type ProductVisibility = "public" | "community";

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
  reservedAt?: any; // Using any for flexibility with Firestore Timestamp vs Date, or import Timestamp
  soldAt?: any;
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
  searchKeywords?: string[];

  // Nuevos campos Release 1.0
  listingType?: ListingType;
  acceptedExchangeTypes?: ExchangeType[];
  exchangeCashDelta?: number | null; // (Deprecated) Diferencia en dinero para permuta; conservado por compatibilidad

  // Comunidad / visibilidad
  visibility?: ProductVisibility;
  communityId?: string | null;
}

