jest.mock("@/lib/firebaseClient", () => ({ db: {} }));

import { filterVisibleProducts } from "@/lib/communities";
import { Product } from "@/types/product";

const baseProduct: Product = {
  id: "p1",
  sellerId: "seller-1",
  title: "Producto de prueba",
  description: "",
  price: 100,
  categoryId: "electronics",
  images: [],
  status: "active",
  condition: "used",
  location: "Lima",
  createdAt: new Date(),
};

describe("filterVisibleProducts", () => {
  it("devuelve todos los productos sin filtrar por comunidad", () => {
    const products: Product[] = [
      { ...baseProduct, id: "public-1", visibility: "public" },
      { ...baseProduct, id: "comm-1", visibility: "community", communityId: "gamers" },
    ];

    const result = filterVisibleProducts(products);
    expect(result.map((p) => p.id)).toEqual(["public-1", "comm-1"]);
  });
});
