"use client";

import { Button } from "./Button";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmClasses =
    tone === "destructive"
      ? "bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500"
      : "bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500";

  const badgeClasses =
    tone === "destructive"
      ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100"
      : "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeClasses}`}>
            Aviso
          </span>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          {description}
        </p>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/30"
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            className={confirmClasses}
            disabled={loading}
          >
            {loading ? "Procesando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
