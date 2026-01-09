import { Product } from "@/types/product";

type ContactedProduct = {
  productId: string;
  product: Product | null;
  count: number;
  lastAt: Date;
};

const filterContactedEntries = (
  entries: Array<ContactedProduct | null>
): ContactedProduct[] => {
  return entries.filter(
    (entry): entry is ContactedProduct =>
      Boolean(
        entry &&
          entry.product &&
          (entry.product.status ?? "active") !== "deleted"
      )
  );
};

describe("Activity Contacted list", () => {
  it("omits deleted products and empty entries", () => {
    const activeProduct = {
      id: "p1",
      title: "Activo",
      status: "active",
      sellerId: "u1",
      categoryId: "cat",
      listingType: "product",
      condition: "new",
      createdAt: new Date(),
      visibility: "public",
    } as Product;

    const deletedProduct = {
      ...activeProduct,
      id: "p2",
      title: "Eliminado",
      status: "deleted",
    } as Product;

    const entries: Array<ContactedProduct | null> = [
      {
        productId: "p1",
        product: activeProduct,
        count: 2,
        lastAt: new Date(),
      },
      {
        productId: "p2",
        product: deletedProduct,
        count: 1,
        lastAt: new Date(),
      },
      null,
    ];

    const result = filterContactedEntries(entries);

    expect(result).toHaveLength(1);
    expect(result[0].productId).toBe("p1");
  });
});
