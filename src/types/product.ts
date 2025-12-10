export interface Product {
  id?: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  categoryId: string;
  images: string[];
  status: "active" | "reserved" | "sold" | "deleted";
  condition: "new" | "used" | "like-new";
  location: string;
  createdAt: Date;
  searchKeywords?: string[];
}
