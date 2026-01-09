import { Product } from "@/types/product";
import { getCommunityById } from "@/lib/communities";

// helper similar to product detail rendering logic
const buildCommunityLabels = (product: Product) => {
  const ids = Array.from(
    new Set([product.communityId, ...(product.communityIds ?? [])].filter((id): id is string => Boolean(id)))
  );
  if (ids.length === 0) return ["Público"];
  return ids.map((id) => getCommunityById(id)?.name ?? "Comunidad");
};

describe("Product community multiselect support", () => {
  it("renders all community labels when multiple are assigned", () => {
    const product: Product = {
      id: "prod1",
      sellerId: "user1",
      title: "Producto multi comunidad",
      description: "desc",
      categoryId: "other",
      images: [],
      status: "active",
      condition: "new",
      location: "Lima",
      createdAt: new Date(),
      listingType: "product",
      communityIds: ["tech", "pets"],
      visibility: "community",
    };

    const labels = buildCommunityLabels(product);
    expect(labels).toContain(getCommunityById("tech")?.name ?? "Comunidad");
    expect(labels).toContain(getCommunityById("pets")?.name ?? "Comunidad");
  });

  it("falls back to Público when no communities are set", () => {
    const product: Product = {
      id: "prod2",
      sellerId: "user1",
      title: "Producto sin comunidad",
      description: "desc",
      categoryId: "other",
      images: [],
      status: "active",
      condition: "new",
      location: "Lima",
      createdAt: new Date(),
      listingType: "product",
    };

    const labels = buildCommunityLabels(product);
    expect(labels).toEqual(["Público"]);
  });
});
