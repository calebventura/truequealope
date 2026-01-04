import { ExchangeType, ListingType, Product } from "@/types/product";

export type ExchangeFilter = "all" | "sale" | "trade" | "permuta" | "giveaway";
export type ListingFilter = "all" | "product" | "service";

export function getAcceptedExchangeTypes(product: Product): ExchangeType[] {
  if (product.acceptedExchangeTypes && product.acceptedExchangeTypes.length > 0) {
    return product.acceptedExchangeTypes;
  }

  const mode = product.mode ?? "sale";
  if (mode === "sale" && product.price === 0) return ["giveaway"];
  if (mode === "trade") return ["product"];
  if (mode === "both") return ["money", "product"];
  return ["money"];
}

export function matchesExchangeFilter(
  product: Product,
  filter: ExchangeFilter
): boolean {
  if (filter === "all") return true;

  const accepted = getAcceptedExchangeTypes(product);
  const isGiveaway = accepted.includes("giveaway");
  const isPermuta = accepted.includes("exchange_plus_cash");
  const isSale = accepted.includes("money");
  const isTrade = accepted.includes("product") || accepted.includes("service");

  if (filter === "sale") return isSale && !isPermuta && !isGiveaway;
  if (filter === "trade") return isTrade && !isPermuta;
  if (filter === "permuta") return isPermuta;
  if (filter === "giveaway") return isGiveaway;
  return true;
}

export function matchesListingFilter(
  product: Product,
  filter: ListingFilter
): boolean {
  if (filter === "all") return true;
  return (product.listingType ?? "product") === filter;
}

export function getListingType(product: Product): ListingType {
  return product.listingType ?? "product";
}
