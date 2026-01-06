"use client";

import { Button } from "./Button";

type AlertTone = "info" | "error" | "success";

export type AlertModalProps = {
  open: boolean;
  title: string;
  description: string;
  tone?: AlertTone;
  primaryLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
};

const toneStyles: Record<AlertTone, { badge: string; text: string }> = {
  info: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
    text: "text-blue-800 dark:text-blue-100",
  },
  success: {
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
    text: "text-emerald-800 dark:text-emerald-100",
  },
  error: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
    text: "text-red-800 dark:text-red-100",
  },
};

export function AlertModal({
  open,
  title,
  description,
  tone = "info",
  primaryLabel = "Cerrar",
  onClose,
  onConfirm,
}: AlertModalProps) {
  if (!open) return null;

  const styles = toneStyles[tone];

  const handlePrimary = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles.badge}`}
          >
            {tone === "error"
              ? "Error"
              : tone === "success"
              ? "Listo"
              : "Aviso"}
          </span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
        <p
          className={`text-sm leading-relaxed text-gray-700 dark:text-gray-200 ${styles.text}`}
        >
          {description}
        </p>
        <div className="flex justify-end">
          <Button variant="primary" onClick={handlePrimary}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
