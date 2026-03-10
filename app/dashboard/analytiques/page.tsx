"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";
import { useRole } from "@/lib/useRole";

type SaleRow = {
  id: string;
  client_id: string | null;
  amount: number | null;
  created_at: string | null;
};
type ClientRow = {
  id: string;
  email: string | null;
  prenom: string | null;
  nom: string | null;
  birthdate: string | null;
};

function formatEUR(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v);
  } catch {
    return `${v.toFixed(2)} €`;
  }
}

function moneyToNumberAny(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, "").replace(/€/g, "").replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const hasComma = lastComma !== -1;
  const hasDot = lastDot !== -1;
  if (hasComma && hasDot) {
    const decimalIsComma = lastComma > lastDot;
    const decimalSep = decimalIsComma ? "," : ".";
    const thousandSep = decimalIsComma ? "." : ",";
    s = s.replace(new RegExp("\\" + thousandSep, "g"), "");
    s = s.replace(decimalSep, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  const sep = hasComma ? "," : hasDot ? "." : "";
  if (!sep) { const n = Number(s); return Number.isFinite(n) ? n : 0; }
  const idx = s.lastIndexOf(sep);
  const digitsAfter = s.length - idx - 1;
  if (digitsAfter >= 1 && digitsAfter <= 2) {
    s = s.replace(sep, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  s = s.replace(new RegExp("\\" + sep, "g"), "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toISODate(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

type Period = "7d" | "30d" | "90d" | "12m" | "custom";

function getPeriodDates(period: Period, customFrom: string, customTo: string): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  if (period === "custom") {
    return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
  }
  const from = new Date();
  if (period === "7d") from.setDate(from.getDate() - 6);
  else if (period === "30d") from.setDate(from.getDate() - 29);
  else if (period === "90d") from.setDate(from.getDate() - 89);
  else if (period === "12m") from.setMonth(from.getMonth() - 11);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function buildChartData(sales: SaleRow[], from: Date, to: Date, period: Period) {
  const isMonthly = period === "12m";
  const buckets = new Map<string, number>();
  if (isMonthly) {
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cur <= to) {
      const key = `${cur.getFullYear()}-${pad2(cur.getMonth() + 1)}`;
      buckets.set(key, 0);
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    const cur = new Date(from);
    while (cur <= to) {
      buckets.set(toISODate(cur), 0);
      cur.setDate(cur.getDate() + 1);
    }
  }
  for (const s of sales) {
    if (!s.created_at) continue;
    const d = new Date(s.created_at);
    if (d < from || d > to) continue;
    const key = isMonthly ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}` : toISODate(d);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + moneyToNumberAny(s.amount));
  }
  const months = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
  return Array.from(buckets.entries()).map(([key, value]) => {
    let label = key;
    if (isMonthly) {
      const [, m] = key.split("-");
      label = months[parseInt(m) - 1];
    } else {
      const [, m, d] = key.split("-");
      label = `${d}/${m}`;
    }
    return { key, label, value };
  });
}

function getUpcomingBirthdays(clients: ClientRow[], days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const results: { client: ClientRow; daysUntil: number; dateStr: string }[] = [];
  for (const c of clients) {
    if (!c.birthdate) continue;
    const [year, month, day] = c.birthdate.split("-").map(Number);
    if (!year || !month || !day) continue;
    let nextBirthday = new Date(today.getFullYear(), month - 1, day);
    nextBirthday.setHours(0, 0, 0, 0);
    if (nextBirthday < today) nextBirthday = new Date(today.getFullYear() + 1, month - 1, day);
    const diffMs = nextBirthday.getTime() - today.getTime();
    const daysUntil = Math.round(diffMs / 86400000);
    if (daysUntil <= days) {
      const age = nextBirthday.getFullYear() - year;
      const dateStr = `${pad2(day)}/${pad2(month)} · ${age} ans`;
      results.push({ client: c, daysUntil, dateStr });
    }
  }
  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

function clientName(c: ClientRow) {
  const name = `${c.prenom ?? ""} ${c.nom ?? ""}`.trim();
  return name || c.email || "Client";
}

function clientInitials(c: ClientRow) {
  const p = c.prenom?.[0]?.toUpperCase() ?? "";
  const n = c.nom?.[0]?.toUpperCase() ?? "";
  return (p + n) || (c.email?.[0]?.toUpperCase() ?? "?");
}

function MiniCalendar({ value, onChange, max }: { value: string; onChange: (v: string) => void; max?: string }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const todayIso = toISODate(new Date());
  const maxIso = max ?? todayIso;
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const monthLabel = `${monthNames[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: { iso: string; day: number; inMonth: boolean; disabled: boolean }[] = [];
  const prev = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  const prevDim = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 0).getDate();
  for (let i = 0; i < mondayOffset; i++) {
    const day = prevDim - (mondayOffset - 1 - i);
    cells.push({ iso: toISODate(new Date(prev.getFullYear(), prev.getMonth(), day)), day, inMonth: false, disabled: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISODate(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    cells.push({ iso, day: d, inMonth: true, disabled: iso > maxIso });
  }
  let nd = 1;
  while (cells.length < 42) {
    const iso = toISODate(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, nd));
    cells.push({ iso, day: nd, inMonth: false, disabled: true });
    nd++;
  }
  const displayValue = value ? (() => { const [y,m,d] = value.split("-"); return `${d}/${m}/${y}`; })() : "Choisir";
  return (
    <>
      <style>{`
        @keyframes calSlideIn {
          from { opacity: 0; transform: translateX(-8px) translateY(-50%) scale(0.97); }
          to   { opacity: 1; transform: translateX(0) translateY(-50%) scale(1); }
        }
        .cal-dropdown { animation: calSlideIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
      <div ref={ref} style={{ position: "relative" }}>
        <button type="button" onClick={() => setOpen(v => !v)}
          style={{ height: 38, borderRadius: 10, padding: "0 12px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 13, cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ opacity: 0.6 }}>📅</span> {displayValue}
        </button>
        {open && (
          <div className="cal-dropdown" style={{
            position: "absolute", top: "50%", left: "calc(100% + 12px)", transform: "translateY(-50%)",
            zIndex: 99999, width: 280, borderRadius: 14, padding: 14,
            background: "rgba(18,20,28,0.99)", border: "1px solid rgba(120,160,255,0.18)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(120,160,255,0.06) inset",
            backdropFilter: "blur(20px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>←</button>
              <span style={{ fontWeight: 800, fontSize: 13, color: "rgba(255,255,255,0.92)" }}>{monthLabel}</span>
              <button type="button" onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "rgba(255,255,255,0.8)", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>→</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {["L","M","M","J","V","S","D"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, opacity: 0.4, color: "rgba(255,255,255,0.9)", padding: "2px 0" }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {cells.map((c, i) => {
                const isActive = c.iso === value;
                const isToday = c.iso === todayIso;
                return (
                  <button key={i} type="button" disabled={c.disabled || !c.inMonth}
                    onClick={() => { onChange(c.iso); setOpen(false); }}
                    style={{ height: 30, borderRadius: 8, border: "none", background: isActive ? "rgba(120,160,255,0.25)" : isToday ? "rgba(255,255,255,0.06)" : "transparent", color: !c.inMonth ? "transparent" : c.disabled ? "rgba(255,255,255,0.2)" : isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.80)", fontWeight: isActive ? 900 : isToday ? 700 : 500, fontSize: 12, cursor: c.disabled || !c.inMonth ? "default" : "pointer", outline: isToday && !isActive ? "1px solid rgba(120,160,255,0.3)" : "none", transition: "background 100ms" }}>
                    {c.inMonth ? c.day : ""}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between" }}>
              <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", background: "none", border: "none", cursor: "pointer" }}>Effacer</button>
              <button type="button" onClick={() => { onChange(todayIso); setOpen(false); }}
                style={{ fontSize: 12, color: "rgba(120,160,255,0.9)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Aujourd'hui</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);
  const W = 900; const H = 200; const PX = 40; const PY = 16;
  const TOOLTIP_W = 140;
  const max = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  const points = useMemo(() => {
    if (data.length === 0) return [];
    return data.map((d, i) => {
      const x = PX + (i / Math.max(data.length - 1, 1)) * (W - PX * 2);
      const y = PY + (1 - d.value / max) * (H - PY * 2);
      return { x, y, label: d.label, value: d.value };
    });
  }, [data, max]);
  const pathD = useMemo(() => {
    if (points.length < 2) return "";
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]; const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
    }
    return d;
  }, [points]);
  const areaD = useMemo(() => {
    if (points.length < 2) return "";
    const bottom = H - PY;
    let d = `M ${points[0].x} ${bottom} L ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]; const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
    }
    d += ` L ${points[points.length - 1].x} ${bottom} Z`;
    return d;
  }, [points]);
  const labelStep = Math.max(1, Math.floor(data.length / 7));
  const labelIndices = new Set(data.map((_, i) => i).filter((i) => i % labelStep === 0 || i === data.length - 1));
  const tooltipLeft = useMemo(() => {
    if (!tooltip || !containerRef.current) return tooltip?.x ?? 0;
    const containerW = containerRef.current.offsetWidth;
    const half = TOOLTIP_W / 2;
    return Math.min(Math.max(tooltip.x, half + 8), containerW - half - 8);
  }, [tooltip]);
  if (data.length === 0) return <div className="an-chart-empty">Aucune donnée.</div>;
  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", overflowX: "auto" }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: "100%", height: 200, display: "block" }}
        onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(120,160,255,0.30)" />
            <stop offset="100%" stopColor="rgba(120,160,255,0.00)" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PY + t * (H - PY * 2);
          return <line key={t} x1={PX} x2={W - PX} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
        })}
        <path d={areaD} fill="url(#areaGrad)" />
        <path d={pathD} fill="none" stroke="rgba(120,160,255,0.9)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={16} fill="transparent" style={{ cursor: "crosshair" }}
            onMouseEnter={() => {
              const rect = svgRef.current!.getBoundingClientRect();
              setTooltip({ x: (p.x / W) * rect.width, y: (p.y / H) * rect.height, label: p.label, value: p.value });
            }} />
        ))}
        {points.map((p, i) => labelIndices.has(i) ? (
          <text key={i} x={p.x} y={H - 2} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={11}>{p.label}</text>
        ) : null)}
        {tooltip && points.map((p, i) =>
          Math.abs(p.x - (tooltip.x / (svgRef.current?.getBoundingClientRect().width ?? W)) * W) < 20 ? (
            <circle key={`dot-${i}`} cx={p.x} cy={p.y} r={5} fill="rgba(120,160,255,1)" stroke="white" strokeWidth={2} />
          ) : null
        )}
      </svg>
      {tooltip && (
        <div style={{
          position: "absolute", left: tooltipLeft, top: Math.max(tooltip.y - 52, 4),
          transform: "translateX(-50%)", background: "rgba(20,24,34,0.98)",
          border: "1px solid rgba(120,160,255,0.3)", borderRadius: 8, padding: "6px 10px",
          fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.95)",
          whiteSpace: "nowrap", pointerEvents: "none", zIndex: 20,
          width: TOOLTIP_W, textAlign: "center",
        }}>
          <div style={{ opacity: 0.6, fontWeight: 600, marginBottom: 2 }}>{tooltip.label}</div>
          {formatEUR(tooltip.value)}
        </div>
      )}
    </div>
  );
}

export default function AnalytiquesPage() {
  const { activeWorkspace } = useWorkspace();
  const { can, loading: roleLoading } = useRole();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [customFrom, setCustomFrom] = useState(toISODate(new Date(Date.now() - 29 * 86400000)));
  const [customTo, setCustomTo] = useState(toISODate(new Date()));
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => { if (!roleLoading && can.viewAnalytiques) fetchAll(); }, [activeWorkspace?.id, roleLoading]);

  async function fetchAll() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      if (!activeWorkspace) { setClients([]); setSales([]); setLoading(false); return; }

      const [{ data: cData, error: cErr }, { data: sData, error: sErr }] = await Promise.all([
        supabase.from("clients").select("id,email,prenom,nom").eq("workspace_id", activeWorkspace.id).limit(1000),
        supabase.from("sales").select("id,client_id,amount,created_at").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(5000),
      ]);
      if (cErr) throw cErr;
      if (sErr) throw sErr;

      const baseClients = (cData ?? []) as ClientRow[];
      let clientsWithBirthdate: ClientRow[] = baseClients;
      try {
        const { data: bData, error: bErr } = await supabase.from("clients").select("id,birthdate").eq("workspace_id", activeWorkspace.id).limit(1000);
        if (!bErr && bData) {
          const bdMap = new Map((bData as { id: string; birthdate: string | null }[]).map(r => [r.id, r.birthdate]));
          clientsWithBirthdate = baseClients.map(c => ({ ...c, birthdate: bdMap.get(c.id) ?? null }));
        }
      } catch {}

      setClients(clientsWithBirthdate);
      setSales((sData ?? []) as SaleRow[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const { from, to } = useMemo(() => getPeriodDates(period, customFrom, customTo), [period, customFrom, customTo]);
  const chartData = useMemo(() => buildChartData(sales, from, to, period), [sales, from, to, period]);
  const chartTotal = useMemo(() => chartData.reduce((acc, d) => acc + d.value, 0), [chartData]);

  const top10 = useMemo(() => {
    const caTotal = sales.reduce((acc, s) => acc + moneyToNumberAny(s.amount), 0);
    const map = new Map<string, number>();
    for (const s of sales) { if (!s.client_id) continue; map.set(s.client_id, (map.get(s.client_id) ?? 0) + moneyToNumberAny(s.amount)); }
    const clientById = new Map(clients.map((c) => [c.id, c]));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, total]) => ({ client: clientById.get(id), total, pct: caTotal > 0 ? (total / caTotal) * 100 : 0 })).filter((x) => x.client);
  }, [sales, clients]);

  const recentSales = useMemo(() => {
    const clientById = new Map(clients.map((c) => [c.id, c]));
    return sales.slice(0, 8).map((s) => ({ ...s, client: s.client_id ? clientById.get(s.client_id) ?? null : null }));
  }, [sales, clients]);

  const upcomingBirthdays = useMemo(() => getUpcomingBirthdays(clients, 30), [clients]);

  const periods: { key: Period; label: string }[] = [
    { key: "7d", label: "7 jours" },
    { key: "30d", label: "30 jours" },
    { key: "90d", label: "90 jours" },
    { key: "12m", label: "12 mois" },
    { key: "custom", label: "Personnalisé" },
  ];

  if (roleLoading) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Analytiques</div>
      <h1 className="ds-title">Analytiques</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
    </div>
  );

  if (!can.viewAnalytiques) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Analytiques</div>
      <h1 className="ds-title">Analytiques</h1>
      <div style={{ padding: "60px 0", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Accès réservé au propriétaire</div>
        <div style={{ fontSize: 13, marginTop: 6, color: "rgba(255,255,255,0.4)" }}>Seul l'owner peut consulter les analytiques.</div>
      </div>
    </div>
  );

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Analytiques</div>
      <h1 className="ds-title">Analytiques</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>▲</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Analytiques</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Analytiques</h1>
          <p className="ds-subtitle">Vue d'ensemble — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></p>
          {errorMsg && <p className="an-error">Erreur : {errorMsg}</p>}
        </div>
        <div className="ds-right-tools">
          <button className="ds-btn ds-btn-ghost" type="button" onClick={fetchAll} disabled={loading}>
            {loading ? "Chargement..." : "Actualiser"}
          </button>
        </div>
      </div>

      <div className="ds-card an-chart-card">
        <div className="an-chart-head">
          <div>
            <div className="ds-card-title">Chiffre d'affaires</div>
            <div className="an-chart-total">{formatEUR(chartTotal)}</div>
          </div>
          <div className="an-period-row">
            {periods.map((p) => (
              <button key={p.key} type="button"
                className={`an-period-btn ${period === p.key ? "isOn" : ""}`}
                onClick={() => { setPeriod(p.key); setShowCustom(p.key === "custom"); }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {showCustom && (
          <div className="an-custom-dates">
            <div className="an-custom-label">Du</div>
            <MiniCalendar value={customFrom} onChange={setCustomFrom} max={customTo} />
            <div className="an-custom-label">au</div>
            <MiniCalendar value={customTo} onChange={setCustomTo} max={toISODate(new Date())} />
          </div>
        )}
        {loading ? <div className="an-chart-empty">Chargement…</div> : <LineChart data={chartData} />}
      </div>

      <div className="an-grid-2">
        <div className="ds-card">
          <div className="ds-card-title" style={{ marginBottom: 16 }}>Top 10 clients</div>
          {loading ? <div className="an-empty">Chargement…</div> : top10.length === 0 ? (
            <div className="an-empty">Aucune vente client enregistrée.</div>
          ) : (
            <div className="an-top-list">
              {top10.map((item, i) => (
                <div key={item.client!.id} className="an-top-row">
                  <div className="an-top-rank">#{i + 1}</div>
                  <div className="an-top-info">
                    <div className="an-top-name">{clientName(item.client!)}</div>
                    <div className="an-top-bar-wrap"><div className="an-top-bar" style={{ width: `${item.pct}%` }} /></div>
                  </div>
                  <div className="an-top-right">
                    <div className="an-top-amount">{formatEUR(item.total)}</div>
                    <div className="an-top-pct">{item.pct.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ds-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div className="ds-card-title">🎂 Anniversaires dans 30 jours</div>
            {upcomingBirthdays.length > 0 && (
              <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,180,80,0.9)", background: "rgba(255,180,80,0.08)", border: "1px solid rgba(255,180,80,0.2)", borderRadius: 999, padding: "3px 10px" }}>
                {upcomingBirthdays.length}
              </div>
            )}
          </div>
          {loading ? (
            <div className="an-empty">Chargement…</div>
          ) : upcomingBirthdays.length === 0 ? (
            <div className="an-empty">Aucun anniversaire dans les 30 prochains jours.</div>
          ) : (
            <div className="an-birth-list">
              {upcomingBirthdays.map(({ client, daysUntil, dateStr }) => {
                const isToday = daysUntil === 0;
                const isSoon = daysUntil <= 7 && !isToday;
                return (
                  <div key={client.id} className="an-birth-row">
                    <div className="an-birth-avatar">{clientInitials(client)}</div>
                    <div className="an-birth-info">
                      <div className="an-birth-name">{clientName(client)}</div>
                      <div className="an-birth-sub">{dateStr}</div>
                    </div>
                    <div className={`an-birth-days ${isToday ? "isToday" : isSoon ? "isSoon" : ""}`}>
                      {isToday ? "🎉 Aujourd'hui !" : `J-${daysUntil}`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="ds-card">
        <div className="ds-card-title" style={{ marginBottom: 16 }}>Ventes récentes</div>
        {loading ? <div className="an-empty">Chargement…</div> : recentSales.length === 0 ? (
          <div className="an-empty">Aucune vente enregistrée.</div>
        ) : (
          <div className="ds-table-wrap">
            <table className="ds-table">
              <thead><tr><th>Date</th><th>Client</th><th className="ds-right">Montant</th></tr></thead>
              <tbody>
                {recentSales.map((s) => {
                  const d = s.created_at ? new Date(s.created_at) : null;
                  const dateStr = d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : "—";
                  return (
                    <tr key={s.id}>
                      <td className="ds-mono">{dateStr}</td>
                      <td>{s.client ? clientName(s.client) : "Vente anonyme"}</td>
                      <td className="ds-right">{formatEUR(moneyToNumberAny(s.amount))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        .an-error { margin-top: 8px; color: rgba(255,120,120,0.95); font-weight: 800; }
        .an-chart-card { padding-bottom: 20px; overflow: visible; }
        .an-chart-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
        .an-chart-total { font-size: 28px; font-weight: 900; margin-top: 4px; color: rgba(255,255,255,0.95); }
        .an-period-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .an-period-btn { border-radius: 999px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.80); padding: 8px 14px; font-weight: 750; font-size: 13px; cursor: pointer; transition: background 120ms, border-color 120ms; }
        .an-period-btn:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.18); }
        .an-period-btn.isOn { background: rgba(120,160,255,0.16); border-color: rgba(120,160,255,0.45); color: rgba(255,255,255,0.95); }
        .an-custom-dates { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; position: relative; z-index: 10; }
        .an-custom-label { font-size: 13px; opacity: 0.7; color: rgba(255,255,255,0.9); }
        .an-chart-empty { padding: 40px 0; text-align: center; opacity: 0.5; color: rgba(255,255,255,0.85); }
        .an-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 860px) { .an-grid-2 { grid-template-columns: 1fr; } }
        .an-top-list { display: flex; flex-direction: column; gap: 12px; }
        .an-top-row { display: flex; align-items: center; gap: 12px; }
        .an-top-rank { font-size: 12px; font-weight: 900; opacity: 0.45; width: 24px; text-align: right; color: rgba(255,255,255,0.9); flex-shrink: 0; }
        .an-top-info { flex: 1; min-width: 0; }
        .an-top-name { font-weight: 800; font-size: 14px; color: rgba(255,255,255,0.92); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px; }
        .an-top-bar-wrap { height: 4px; border-radius: 999px; background: rgba(255,255,255,0.06); overflow: hidden; }
        .an-top-bar { height: 100%; border-radius: 999px; background: linear-gradient(90deg, rgba(120,160,255,0.8), rgba(160,120,255,0.6)); transition: width 600ms cubic-bezier(0.34,1.56,0.64,1); }
        .an-top-right { text-align: right; flex-shrink: 0; }
        .an-top-amount { font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.92); }
        .an-top-pct { font-size: 12px; opacity: 0.55; color: rgba(255,255,255,0.9); margin-top: 2px; }
        .an-birth-list { display: flex; flex-direction: column; gap: 10px; }
        .an-birth-row { display: flex; align-items: center; gap: 12px; }
        .an-birth-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; background: linear-gradient(135deg, rgba(120,160,255,0.2), rgba(160,120,255,0.2)); border: 1px solid rgba(120,160,255,0.25); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; color: rgba(255,255,255,0.85); }
        .an-birth-info { flex: 1; min-width: 0; }
        .an-birth-name { font-weight: 800; font-size: 14px; color: rgba(255,255,255,0.92); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-birth-sub { font-size: 12px; opacity: 0.55; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .an-birth-days { font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.6); border-radius: 999px; padding: 4px 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); white-space: nowrap; flex-shrink: 0; }
        .an-birth-days.isSoon { color: rgba(255,180,80,0.95); background: rgba(255,180,80,0.08); border-color: rgba(255,180,80,0.2); }
        .an-birth-days.isToday { color: rgba(120,220,120,0.95); background: rgba(120,220,120,0.08); border-color: rgba(120,220,120,0.2); }
        .an-empty { padding: 24px 0; text-align: center; opacity: 0.45; font-size: 14px; color: rgba(255,255,255,0.85); }
      `}</style>
    </div>
  );
}