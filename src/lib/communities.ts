import { Community } from "@/types/community";
import { Product, ProductVisibility } from "@/types/product";

export const COMMUNITIES: Community[] = [
  { id: "rimac", name: "Comunidad Rimac" },
  { id: "parents", name: "Padres/Madres" },
  { id: "phillips-chu-joy", name: "Phillips chu joy" },
  { id: "gamers", name: "Gamers" },
  { id: "students", name: "Estudiantes" },
];

export const COMMUNITY_MAP: Record<string, Community> = COMMUNITIES.reduce(
  (acc, community) => {
    acc[community.id] = community;
    return acc;
  },
  {} as Record<string, Community>
);

export const DEFAULT_VISIBILITY: ProductVisibility = "public";

export const getCommunityById = (id: string | null | undefined) =>
  id ? COMMUNITY_MAP[id] : undefined;

export function filterVisibleProducts(products: Product[]) {
  // Con el modelo actual todas las publicaciones son públicas.
  return products;
}
