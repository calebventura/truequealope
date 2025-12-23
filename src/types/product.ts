export type ProductMode = "sale" | "trade" | "both";

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
  searchKeywords?: string[];
}

