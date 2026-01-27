export const CATEGORIES = [
  { id: "electronics", name: "Electronica", icon: "💡" },
  { id: "clothing", name: "Ropa y accesorios", icon: "🧥" },
  { id: "home", name: "Hogar y muebles", icon: "🛋️" },
  { id: "sports", name: "Deportes", icon: "🏀" },
  { id: "toys", name: "Juguetes", icon: "🧸" },
  { id: "books", name: "Libros", icon: "📚" },
  { id: "other", name: "Otros", icon: "✨" },
];

export const CONDITIONS = [
  { id: "new", name: "Nuevo" },
  { id: "like-new", name: "Como nuevo" },
  { id: "used", name: "Usado" },
];

export const DRAFT_KEY = "product_draft";

// Paginación
export const DEFAULT_EXPLORE_PAGE_SIZE =
  Number(process.env.NEXT_PUBLIC_PAGE_SIZE_EXPLORE) || 12;
export const DEFAULT_DASHBOARD_PAGE_SIZE =
  Number(process.env.NEXT_PUBLIC_PAGE_SIZE_DASHBOARD) || 20;
export const PAGE_SIZE_OPTIONS = [10, 12, 20, 50];
