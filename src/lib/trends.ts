import { ExchangeType, ListingType } from "@/types/product";

export type TrendFilters = {
  categoryId?: string;
  categoryIds?: string[];
  searchQuery?: string;
  condition?: "new" | "like-new" | "used";
  listingType?: ListingType;
  exchangeTypesAny?: ExchangeType[];
  trendTagsAny?: string[];
};

export type TrendConfig = {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  priority?: number;
  active?: boolean;
  startAt?: string; // YYYY-MM-DD
  endAt?: string; // YYYY-MM-DD (inclusive)
  filters?: TrendFilters;
  productIds?: string[];
};

export const TREND_CONFIG: TrendConfig[] = [
  {
    id: "navidad-2025",
    title: "Regalos navidenos",
    subtitle: "Ideas para sorprender",
    icon: "*",
    priority: 120,
    startAt: "2025-12-01",
    endAt: "2026-01-06",
    filters: {
      categoryIds: ["toys", "electronics", "books", "home", "clothing"],
    },
  },
  {
    id: "ex-gifts",
    title: "Regalos de mi ex",
    subtitle: "Risas y desahogo",
    icon: "X",
    priority: 110,
    filters: {
      categoryId: "ex-gift",
    },
  },
  {
    id: "moving-urgent",
    title: "Mudanza urgente",
    subtitle: "Se va hoy",
    icon: "!",
    priority: 100,
    filters: {
      trendTagsAny: ["moving-urgent"],
    },
  },
  {
    id: "used-once",
    title: "Lo use una vez",
    subtitle: "Como nuevo",
    icon: "1",
    priority: 90,
    filters: {
      condition: "like-new",
    },
  },
  {
    id: "giveaway",
    title: "Gratis hoy",
    subtitle: "Llevatelo ya",
    icon: "0",
    priority: 80,
    filters: {
      exchangeTypesAny: ["giveaway"],
    },
  },
  {
    id: "permuta",
    title: "Permuta con vuelto",
    subtitle: "Objeto + efectivo",
    icon: "+",
    priority: 70,
    filters: {
      exchangeTypesAny: ["exchange_plus_cash"],
    },
  },
  {
    id: "services",
    title: "Trueque de servicios",
    subtitle: "Habilidad por habilidad",
    icon: "S",
    priority: 60,
    filters: {
      listingType: "service",
    },
  },
  {
    id: "impulse",
    title: "Compras impulsivas",
    subtitle: "Mejor que quede aqui",
    icon: "?",
    priority: 50,
    filters: {
      categoryId: "electronics",
    },
  },
];

export function getTrendById(id: string): TrendConfig | undefined {
  return TREND_CONFIG.find((trend) => trend.id === id);
}

export function getActiveTrends(now = new Date()): TrendConfig[] {
  return TREND_CONFIG.filter((trend) => isTrendActive(trend, now))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 8);
}

export function isTrendActive(trend: TrendConfig, now = new Date()): boolean {
  if (trend.active === false) return false;

  const start = parseDateBound(trend.startAt, false);
  if (start && now < start) return false;

  const end = parseDateBound(trend.endAt, true);
  if (end && now > end) return false;

  return true;
}

export function buildTrendHref(trend: TrendConfig): string {
  return `/search?trend=${encodeURIComponent(trend.id)}`;
}

function parseDateBound(dateStr?: string, isEnd?: boolean): Date | null {
  if (!dateStr) return null;
  const time = isEnd ? "23:59:59" : "00:00:00";
  const parsed = new Date(`${dateStr}T${time}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}
