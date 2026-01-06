"use client";

import { useEffect, useMemo, useState } from "react";
import { ExchangeFilter, ListingFilter } from "@/lib/productFilters";

type FilterPill = {
  key: string;
  label: string;
  onClear: () => void;
};

type FilterOption = {
  id: string;
  name: string;
  icon?: string;
};

type TrendOption = {
  id: string;
  title: string;
  icon?: string;
};

type FiltersPanelProps = {
  title?: string;
  activeCount: number;
  pills: FilterPill[];
  onClearAll: () => void;
  category: {
    values: string[];
    options: FilterOption[];
    onApply: (values: string[]) => void;
  };
  trend: {
    values: string[];
    options: TrendOption[];
    onApply: (values: string[]) => void;
  };
  community: {
    values: string[];
    options: FilterOption[];
    onApply: (values: string[]) => void;
  };
  exchange: {
    values: ExchangeFilter[];
    labels: Record<ExchangeFilter, string>;
    onApply: (values: ExchangeFilter[]) => void;
  };
  listing: {
    values: ListingFilter[];
    labels: Record<ListingFilter, string>;
    onApply: (values: ListingFilter[]) => void;
  };
  emptyLabel?: string;
};

const toggleValue = <T,>(items: T[], value: T) => {
  if (items.includes(value)) {
    return items.filter((item) => item !== value);
  }
  return [...items, value];
};

export function FiltersPanel({
  title,
  activeCount,
  pills,
  onClearAll,
  category,
  trend,
  community,
  exchange,
  listing,
  emptyLabel = "",
}: FiltersPanelProps) {
  const [open, setOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState<string[]>([]);
  const [draftTrend, setDraftTrend] = useState<string[]>([]);
  const [draftCommunity, setDraftCommunity] = useState<string[]>([]);
  const [draftExchange, setDraftExchange] = useState<ExchangeFilter[]>([]);
  const [draftListing, setDraftListing] = useState<ListingFilter[]>([]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const showClearAll = activeCount > 0;
  const categorySelected = draftCategory.length > 0;
  const trendSelected = draftTrend.length > 0;
  const communitySelected = draftCommunity.length > 0;
  const exchangeSelected = draftExchange.length > 0;
  const listingSelected = draftListing.length > 0;

  const exchangeKeys = useMemo(
    () =>
      (Object.keys(exchange.labels) as ExchangeFilter[]).filter(
        (key) => key !== "all"
      ),
    [exchange.labels]
  );
  const listingKeys = useMemo(
    () =>
      (Object.keys(listing.labels) as ListingFilter[]).filter(
        (key) => key !== "all"
      ),
    [listing.labels]
  );

  const clearDraft = () => {
    setDraftCategory([]);
    setDraftTrend([]);
    setDraftCommunity([]);
    setDraftExchange([]);
    setDraftListing([]);
  };

  const applyDraft = () => {
    category.onApply(draftCategory);
    trend.onApply(draftTrend);
    community.onApply(draftCommunity);
    exchange.onApply(draftExchange);
    listing.onApply(draftListing);
    setOpen(false);
  };
  const openPanel = () => {
    setDraftCategory([...category.values]);
    setDraftTrend([...trend.values]);
    setDraftCommunity([...community.values]);
    setDraftExchange([...exchange.values]);
    setDraftListing([...listing.values]);
    setOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {title ? (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-3">
          {showClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={openPanel}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100 shadow-sm hover:border-indigo-400 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h18M6 12h12M10 20h4"
              />
            </svg>
            Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {pills.length > 0
          ? pills.map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={pill.onClear}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-200"
              >
                {pill.label}
                <span className="text-sm leading-none">x</span>
              </button>
            ))
          : emptyLabel && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {emptyLabel}
              </span>
            )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 md:top-0 md:right-0 md:left-auto md:bottom-0 md:w-[380px] bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-none md:rounded-l-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[85vh] md:max-h-none">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Filtros
                </p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Refina tu busqueda
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-gray-200 dark:border-gray-700 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Categoria
                  </h4>
                  {categorySelected && (
                    <button
                      type="button"
                      onClick={() => setDraftCategory([])}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftCategory([])}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                      draftCategory.length === 0
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    <span className="text-lg">#</span>
                    <span>Todas</span>
                  </button>
                  {category.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setDraftCategory(toggleValue(draftCategory, option.id))
                      }
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                        draftCategory.includes(option.id)
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                          : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {option.icon && <span className="text-lg">{option.icon}</span>}
                      <span className="line-clamp-1">{option.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Tendencia
                  </h4>
                  {trendSelected && (
                    <button
                      type="button"
                      onClick={() => setDraftTrend([])}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftTrend([])}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      draftTrend.length === 0
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    Todas
                  </button>
                  {trend.options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDraftTrend(toggleValue(draftTrend, option.id))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        draftTrend.includes(option.id)
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                          : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      <span className="mr-1">{option.icon ?? "#"}</span>
                      {option.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Comunidad
                  </h4>
                  {communitySelected && (
                    <button
                      type="button"
                      onClick={() => setDraftCommunity([])}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {community.options.map((option) => {
                    const isSelected = draftCommunity.includes(option.id);
                    if (option.id === "all") {
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setDraftCommunity([])}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            draftCommunity.length === 0
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                              : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                          }`}
                        >
                          {option.name}
                        </button>
                      );
                    }
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setDraftCommunity(toggleValue(draftCommunity, option.id))
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                            : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {option.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Tipo de intercambio
                  </h4>
                  {exchangeSelected && (
                    <button
                      type="button"
                      onClick={() => setDraftExchange([])}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftExchange([])}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      draftExchange.length === 0
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {exchange.labels.all}
                  </button>
                  {exchangeKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDraftExchange(toggleValue(draftExchange, key))
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        draftExchange.includes(key)
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                          : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {exchange.labels[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Tipo de publicacion
                  </h4>
                  {listingSelected && (
                    <button
                      type="button"
                      onClick={() => setDraftListing([])}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDraftListing([])}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      draftListing.length === 0
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                        : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {listing.labels.all}
                  </button>
                  {listingKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setDraftListing(toggleValue(draftListing, key))
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                        draftListing.includes(key)
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200"
                          : "border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      {listing.labels[key]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 px-5 py-4 flex items-center justify-between">
              <button
                type="button"
                onClick={clearDraft}
                className="text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={applyDraft}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
