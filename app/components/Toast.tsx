"use client";

import { useEffect, useMemo, useState } from "react";

export type ToastType = "success" | "warning" | "error" | "info";

export type ToastData = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  createdAt?: number;
};

function formatAgo(createdAt: number): string {
  const s = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (s < 5) return "à l’instant";
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  return `il y a ${h}h`;
}

export default function Toast({
  toast,
  onClose,
}: {
  toast: ToastData | null;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const data = useMemo(() => {
    if (!toast) return null;
    return { ...toast, createdAt: toast.createdAt ?? Date.now() };
  }, [toast]);

  useEffect(() => {
    if (!data) return;

    setOpen(true);

    const t = window.setTimeout(() => {
      setOpen(false);
      window.setTimeout(onClose, 180);
    }, 3200);

    return () => window.clearTimeout(t);
  }, [data, onClose]);

  useEffect(() => {
    if (!open) return;
    const i = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(i);
  }, [open]);

  if (!data) return null;

  const typeClass =
    data.type === "success"
      ? "toast--success"
      : data.type === "warning"
      ? "toast--warning"
      : data.type === "error"
      ? "toast--error"
      : "toast--info";

  return (
    <div className={`toast ${typeClass} ${open ? "is-open" : ""}`}>
      <div className="toast__dot" />
      <div className="toast__body">
        <div className="toast__title">{data.title}</div>
        {data.message ? <div className="toast__msg">{data.message}</div> : null}
        <div className="toast__time" aria-live="polite">
          {formatAgo(data.createdAt!)}
          <span style={{ display: "none" }}>{tick}</span>
        </div>
      </div>

      <button
        type="button"
        className="toast__close"
        onClick={() => {
          setOpen(false);
          window.setTimeout(onClose, 180);
        }}
        aria-label="Fermer"
      >
        ×
      </button>
    </div>
  );
}