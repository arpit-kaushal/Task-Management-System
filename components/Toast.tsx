"use client";

import { useCallback, useMemo, useState } from "react";
import styles from "./Toast.module.css";

export type ToastKind = "success" | "error";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
};

function newId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((kind: ToastKind, message: string) => {
    const id = newId();
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return useMemo(() => ({ toasts, addToast, removeToast }), [toasts, addToast, removeToast]);
}

export default function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss?: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.host} aria-live="polite" aria-relevant="additions removals">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${t.kind === "success" ? styles.success : styles.error}`}
          role="status"
        >
          <div className={styles.message}>{t.message}</div>
          {onDismiss ? (
            <button className={styles.close} onClick={() => onDismiss(t.id)} type="button">
              ×
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

