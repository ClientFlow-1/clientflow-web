"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspace } from "@/lib/workspaceContext";

type StatusOverride = "vip" | "regular" | "inactive" | "new" | null;
type ClientRow = { id: string; email: string | null; prenom: string | null; nom: string | null; created_at: string | null; status_override?: StatusOverride; };
type SaleRow = { id: string; client_id: string | null; amount: number | null; created_at: string | null; };

function formatEUR(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v); } catch { return `${v.toFixed(2)} €`; }
}
function moneyToNumberAny(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/\s/g, "").replace(/€/g, "").replace(",", ".");
  const n = Number(s); return Number.isFinite(n) ? n : 0;
}
function pad2(n: number) { return String(n).padStart(2, "0"); }
function toFRDate(iso: string) { const [y, m, d] = iso.split("T")[0].split("-"); return `${d}/${m}/${y}`; }
function daysSince(isoDate: string) {
  const d = new Date(isoDate); if (isNaN(d.getTime())) return 9999;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
function downloadCSV(filename: string, rows: string[][]) {
  const content = rows.map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

type Segment = "vip" | "regulier" | "inactif" | "nouveau" | "jamais";
const SEGMENTS: { key: Segment; label: string; emoji: string; color: string; bg: string; desc: string }[] = [
  { key: "vip",      label: "VIP",        emoji: "👑", color: "rgba(255,200,80,0.95)",  bg: "rgba(255,200,80,0.10)",  desc: "Top clients · CA élevé" },
  { key: "regulier", label: "Réguliers",  emoji: "⭐", color: "rgba(120,160,255,0.95)", bg: "rgba(120,160,255,0.10)", desc: "Achats récents et fréquents" },
  { key: "inactif",  label: "Inactifs",   emoji: "😴", color: "rgba(255,140,80,0.95)",  bg: "rgba(255,140,80,0.10)",  desc: "N'ont pas acheté depuis longtemps" },
  { key: "nouveau",  label: "Nouveaux",   emoji: "✨", color: "rgba(120,220,140,0.95)", bg: "rgba(120,220,140,0.10)", desc: "Inscrits récemment, peu d'achats" },
  { key: "jamais",   label: "Sans achat", emoji: "🔕", color: "rgba(180,180,200,0.70)", bg: "rgba(180,180,200,0.06)", desc: "Jamais effectué d'achat" },
];
const STATUS_OPTIONS: { value: StatusOverride; label: string; emoji: string; color: string; bg: string; border: string }[] = [
  { value: null,       label: "Auto",     emoji: "🔄", color: "rgba(238,238,245,0.6)",  bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)" },
  { value: "vip",      label: "VIP",      emoji: "👑", color: "rgba(255,200,80,0.95)",  bg: "rgba(255,200,80,0.10)",  border: "rgba(255,200,80,0.35)" },
  { value: "regular",  label: "Régulier", emoji: "⭐", color: "rgba(120,160,255,0.95)", bg: "rgba(120,160,255,0.10)", border: "rgba(120,160,255,0.35)" },
  { value: "inactive", label: "Inactif",  emoji: "😴", color: "rgba(255,140,80,0.95)",  bg: "rgba(255,140,80,0.10)",  border: "rgba(255,140,80,0.35)" },
  { value: "new",      label: "Nouveau",  emoji: "✨", color: "rgba(120,220,140,0.95)", bg: "rgba(120,220,140,0.10)", border: "rgba(120,220,140,0.35)" },
];
const STATUS_OVERRIDE_TO_SEGMENT: Record<NonNullable<StatusOverride>, Segment> = {
  vip: "vip", regular: "regulier", inactive: "inactif", new: "nouveau",
};

// ── Templates email par segment ──────────────────────────────────────────────
const DEFAULT_TEMPLATES: Record<Segment | "all", { subject: string; body: string }> = {
  all: {
    subject: "Un message de notre part 💌",
    body: `Bonjour,\n\nNous espérons que vous allez bien.\n\nNous tenions à vous remercier de votre fidélité et à vous informer de nos dernières nouveautés.\n\nN'hésitez pas à nous rendre visite !\n\nCordialement,\nL'équipe`,
  },
  vip: {
    subject: "👑 Un avantage exclusif pour vous",
    body: `Bonjour,\n\nEn tant que client VIP, vous bénéficiez d'avantages exclusifs.\n\nNous avons préparé une offre spéciale rien que pour vous. Venez nous rendre visite pour en profiter.\n\nMerci pour votre confiance,\nL'équipe`,
  },
  regulier: {
    subject: "⭐ Merci pour votre fidélité !",
    body: `Bonjour,\n\nVous faites partie de nos clients les plus fidèles et nous tenions à vous en remercier.\n\nDécouvrez nos nouveautés et profitez d'une attention particulière à votre prochaine visite.\n\nÀ très bientôt,\nL'équipe`,
  },
  inactif: {
    subject: "😴 Vous nous manquez !",
    body: `Bonjour,\n\nCela fait un moment que nous ne vous avons pas vu et vous nous manquez !\n\nNous avons de nouvelles offres qui pourraient vous intéresser. N'hésitez pas à repasser nous voir.\n\nÀ bientôt,\nL'équipe`,
  },
  nouveau: {
    subject: "✨ Bienvenue parmi nous !",
    body: `Bonjour,\n\nNous sommes ravis de vous compter parmi nos nouveaux clients !\n\nPour vous souhaiter la bienvenue, nous vous réservons une surprise lors de votre prochaine visite.\n\nÀ très bientôt,\nL'équipe`,
  },
  jamais: {
    subject: "🎁 Une offre pour vous découvrir",
    body: `Bonjour,\n\nNous serions ravis de vous accueillir pour la première fois !\n\nVenez découvrir nos services et profitez d'une offre de bienvenue spéciale.\n\nN'hésitez pas à nous contacter pour plus d'informations.\n\nCordialement,\nL'équipe`,
  },
};

// ── Email Modal ───────────────────────────────────────────────────────────────
function EmailModal({
  segment, segmentLabel, segmentEmoji, segmentColor, segmentBg,
  emailList, onClose,
}: {
  segment: Segment | "all";
  segmentLabel: string;
  segmentEmoji: string;
  segmentColor: string;
  segmentBg: string;
  emailList: string[];
  onClose: () => void;
}) {
  const def = DEFAULT_TEMPLATES[segment];
  const [subject, setSubject] = useState(def.subject);
  const [body, setBody] = useState(def.body);
  const [copied, setCopied] = useState(false);

  const validEmails = emailList.filter(Boolean);
  const noEmails = validEmails.length === 0;

  function openMailto() {
    const to = validEmails.join(",");
    const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  }

  function copyEmails() {
    navigator.clipboard.writeText(validEmails.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetTemplate() {
    setSubject(def.subject);
    setBody(def.body);
  }

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", overflowY: "auto" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ width: 580, maxWidth: "100%", borderRadius: 20, padding: 26, background: "linear-gradient(180deg, rgba(20,22,30,0.99), rgba(12,13,18,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 90px rgba(0,0,0,0.7)", margin: "auto", display: "flex", flexDirection: "column", gap: 18 }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>✉ Relance email</span>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 11px", borderRadius: 999, background: segmentBg, border: `1px solid ${segmentColor.replace("0.95","0.30")}`, color: segmentColor }}>
                {segmentEmoji} {segmentLabel}
              </span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.50, marginTop: 2 }}>
              {noEmails
                ? "⚠️ Aucun email disponible dans ce segment"
                : `${validEmails.length} destinataire${validEmails.length > 1 ? "s" : ""} · Modifie le template puis ouvre dans ta messagerie`}
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, color: "rgba(255,255,255,0.7)", padding: "8px 14px", cursor: "pointer", fontWeight: 750, flexShrink: 0 }}>Fermer</button>
        </div>

        {/* Destinataires */}
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, opacity: 0.55, letterSpacing: 0.8, textTransform: "uppercase" }}>Destinataires ({validEmails.length})</span>
            {validEmails.length > 0 && (
              <button type="button" onClick={copyEmails}
                style={{ height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: copied ? "rgba(80,210,140,0.12)" : "rgba(255,255,255,0.04)", color: copied ? "rgba(80,210,140,0.9)" : "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {copied ? "✓ Copié !" : "📋 Copier les emails"}
              </button>
            )}
          </div>
          {noEmails ? (
            <div style={{ fontSize: 13, opacity: 0.4 }}>Aucun client avec un email dans ce segment.</div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.8, maxHeight: 72, overflowY: "auto", wordBreak: "break-all" }}>
              {validEmails.join(", ")}
            </div>
          )}
        </div>

        {/* Objet */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, marginBottom: 8, color: "rgba(255,255,255,0.92)" }}>Objet</div>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 14 }}
          />
        </div>

        {/* Corps */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.75, color: "rgba(255,255,255,0.92)" }}>Message</div>
            <button type="button" onClick={resetTemplate}
              style={{ height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              ↺ Réinitialiser
            </button>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={9}
            style={{ width: "100%", borderRadius: 12, padding: "12px 14px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.12)", outline: "none", fontSize: 13, lineHeight: 1.7, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        {/* Note mailto */}
        <div style={{ fontSize: 12, opacity: 0.38, lineHeight: 1.6 }}>
          ℹ️ Le bouton ci-dessous ouvre ta messagerie (Mail, Outlook, Gmail…) avec tous les destinataires en copie cachée (BCC). Certains clients de messagerie limitent le nombre de destinataires par email.
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button type="button" onClick={onClose}
            style={{ height: 42, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", fontWeight: 750, cursor: "pointer" }}>Annuler</button>
          <button type="button" onClick={openMailto} disabled={noEmails}
            style={{ height: 42, padding: "0 22px", borderRadius: 999, border: `1px solid ${noEmails ? "rgba(255,255,255,0.10)" : "rgba(120,160,255,0.40)"}`, background: noEmails ? "rgba(255,255,255,0.03)" : "rgba(120,160,255,0.16)", color: noEmails ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.95)", fontWeight: 800, cursor: noEmails ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
            ✉ Ouvrir dans ma messagerie
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Status Picker Dropdown (desktop) ────────────────────────────────────────
function StatusPickerDropdown({ client, computedSegment, onStatusChanged }: {
  client: ClientRow; computedSegment: Segment; onStatusChanged: (clientId: string, newStatus: StatusOverride) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = { current: null as HTMLButtonElement | null };
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const dropH = 280;
    setPos({ top: spaceBelow < dropH ? r.top - dropH - 4 : r.bottom + 4, left: r.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function applyStatus(newStatus: StatusOverride) {
    setSaving(true);
    const { error } = await supabase.from("clients").update({ status_override: newStatus }).eq("id", client.id);
    setSaving(false);
    if (!error) { onStatusChanged(client.id, newStatus); setOpen(false); }
  }

  const isAuto = !client.status_override;
  const seg = SEGMENTS.find(s => s.key === computedSegment)!;
  const manualOpt = STATUS_OPTIONS.find(o => o.value === client.status_override);

  const displayColor = isAuto ? seg.color : manualOpt!.color;
  const displayBg = isAuto ? seg.bg : manualOpt!.bg;
  const displayBorder = isAuto ? seg.color.replace("0.95", "0.25") : manualOpt!.border;
  const displayEmoji = isAuto ? seg.emoji : manualOpt!.emoji;
  const displayLabel = isAuto ? seg.label : manualOpt!.label;

  return (
    <>
      <button
        ref={el => { buttonRef.current = el; }}
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: displayBg, border: `1px solid ${displayBorder}`, color: displayColor, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        {displayEmoji} {displayLabel}
        {isAuto && <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 600 }}>(auto)</span>}
        <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
      </button>

      {open && mounted && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 99999, width: 240, borderRadius: 14, padding: 8, background: "linear-gradient(180deg, rgba(18,20,28,0.99), rgba(10,11,16,0.99))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 20px 60px rgba(0,0,0,0.7)", backdropFilter: "blur(20px)" }}
        >
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.1, opacity: 0.4, padding: "4px 10px 8px", textTransform: "uppercase" }}>Forcer le statut</div>
          {STATUS_OPTIONS.map(opt => {
            const isActive = client.status_override === opt.value;
            const isCurrentAuto = opt.value === null && isAuto;
            return (
              <button key={String(opt.value)} type="button" onClick={() => applyStatus(opt.value)} disabled={saving}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: "none", background: isActive || isCurrentAuto ? (opt.value === null ? seg.bg : opt.bg) : "transparent", color: isActive || isCurrentAuto ? (opt.value === null ? seg.color : opt.color) : "rgba(255,255,255,0.80)", fontSize: 13, fontWeight: isActive || isCurrentAuto ? 800 : 500, cursor: saving ? "not-allowed" : "pointer", marginBottom: 2, textAlign: "left", opacity: saving ? 0.6 : 1 }}>
                <span style={{ fontSize: 16 }}>{opt.value === null ? "🔄" : opt.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div>{opt.label}</div>
                  {opt.value === null && <div style={{ fontSize: 10, opacity: 0.5, marginTop: 1 }}>Actuellement : {seg.emoji} {seg.label}</div>}
                </div>
                {(isActive || isCurrentAuto) && <span style={{ fontSize: 12 }}>✓</span>}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Mobile Relance Card ──────────────────────────────────────────────────────
function MobileRelanceCard({ client, caTotal, nbVentes, lastSaleDate, daysSinceLast, segment, onStatusChanged }: {
  client: ClientRow; caTotal: number; nbVentes: number; lastSaleDate: string | null;
  daysSinceLast: number | null; segment: Segment; onStatusChanged: (clientId: string, newStatus: StatusOverride) => void;
}) {
  const [open, setOpen] = useState(false);
  const [statusMode, setStatusMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const seg = SEGMENTS.find(s => s.key === segment)!;
  const inactifAlert = segment === "inactif";
  const hasOverride = !!client.status_override;
  const name = `${client.prenom ?? ""} ${client.nom ?? ""}`.trim() || client.email || "Client";

  async function applyStatus(newStatus: StatusOverride) {
    setSaving(true);
    const { error } = await supabase.from("clients").update({ status_override: newStatus }).eq("id", client.id);
    setSaving(false);
    if (!error) { onStatusChanged(client.id, newStatus); setStatusMode(false); }
  }

  function handleClose() { setOpen(false); setStatusMode(false); }

  return (
    <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", gap: 10 }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: seg.bg, border: `1px solid ${seg.color.replace("0.95","0.30")}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: seg.color }}>
        {(client.prenom?.[0] ?? client.email?.[0] ?? "?").toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          {hasOverride && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 5, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.25)", color: "rgba(120,160,255,0.8)", flexShrink: 0 }}>Manuel</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: seg.bg, border: `1px solid ${seg.color.replace("0.95","0.25")}`, color: seg.color, flexShrink: 0 }}>
            {seg.emoji} {seg.label}{!hasOverride && <span style={{ opacity: 0.55, fontWeight: 600 }}> (auto)</span>}
          </span>
          {daysSinceLast !== null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: inactifAlert ? "rgba(255,140,80,0.95)" : "rgba(255,255,255,0.40)" }}>
              {inactifAlert ? "⚠ " : ""}{daysSinceLast}j
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>{formatEUR(caTotal)}</span>
        <button type="button" onClick={() => { setOpen(true); setStatusMode(false); }}
          style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>···</button>
      </div>

      {open && mounted && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
          onMouseDown={e => { if (e.target === e.currentTarget) handleClose(); }}>
          <div style={{ width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0", background: "linear-gradient(180deg, rgba(22,24,34,0.99), rgba(12,13,18,0.99))", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", padding: "20px 20px 40px" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)", margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: seg.bg, border: `1px solid ${seg.color.replace("0.95","0.35")}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: seg.color, flexShrink: 0 }}>
                {(client.prenom?.[0] ?? client.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 17, color: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {name}
                  {hasOverride && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.25)", color: "rgba(120,160,255,0.8)" }}>Manuel</span>}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client.email || "Pas d'email"}</div>
              </div>
            </div>

            {!statusMode ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <PopupRow label="Segment">
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: seg.bg, border: `1px solid ${seg.color.replace("0.95","0.25")}`, color: seg.color }}>
                      {seg.emoji} {seg.label}{!hasOverride && <span style={{ opacity: 0.55 }}> (auto)</span>}
                    </span>
                  </PopupRow>
                  <PopupRow label="CA total" value={formatEUR(caTotal)} accent />
                  <PopupRow label="Nb ventes" value={String(nbVentes)} />
                  <PopupRow label="Dernière vente" value={lastSaleDate ? toFRDate(lastSaleDate) : "—"} />
                  <PopupRow label="Inactivité" value={daysSinceLast !== null ? `${daysSinceLast} jours${inactifAlert ? " ⚠" : ""}` : "—"} alert={inactifAlert} />
                </div>
                <button type="button" onClick={() => setStatusMode(true)}
                  style={{ width: "100%", height: 46, borderRadius: 12, border: "1px solid rgba(99,120,255,0.30)", background: "rgba(99,120,255,0.10)", color: "rgba(120,160,255,0.95)", fontSize: 14, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
                  🏷 Modifier le statut
                </button>
                <button type="button" onClick={handleClose}
                  style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer" }}>Fermer</button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.50)", marginBottom: 12 }}>Statut pour <strong style={{ color: "rgba(255,255,255,0.85)" }}>{name}</strong></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {STATUS_OPTIONS.map(opt => {
                      const isActive = client.status_override === opt.value;
                      const isCurrentAuto = opt.value === null && !hasOverride;
                      return (
                        <button key={String(opt.value)} type="button" onClick={() => applyStatus(opt.value)} disabled={saving}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, border: `1px solid ${isActive || isCurrentAuto ? opt.border : "rgba(255,255,255,0.08)"}`, background: isActive || isCurrentAuto ? opt.bg : "rgba(255,255,255,0.03)", cursor: saving ? "not-allowed" : "pointer", transition: "all 120ms", opacity: saving ? 0.6 : 1 }}>
                          <span style={{ fontSize: 20 }}>{opt.emoji}</span>
                          <div style={{ flex: 1, textAlign: "left" }}>
                            <div style={{ fontWeight: 800, fontSize: 14, color: isActive || isCurrentAuto ? opt.color : "rgba(255,255,255,0.88)" }}>{opt.label}</div>
                            {opt.value === null && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>Actuellement : {seg.emoji} {seg.label}</div>}
                          </div>
                          {(isActive || isCurrentAuto) && <span style={{ fontSize: 16, color: opt.color }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="button" onClick={() => setStatusMode(false)}
                  style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 14, cursor: "pointer" }}>← Retour</button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function PopupRow({ label, value, accent, alert, children }: { label: string; value?: string; accent?: boolean; alert?: boolean; children?: React.ReactNode; }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontWeight: 600 }}>{label}</span>
      {children ?? <span style={{ fontSize: 13, fontWeight: 800, color: alert ? "rgba(255,140,80,0.95)" : accent ? "rgba(120,160,255,0.95)" : "rgba(255,255,255,0.88)" }}>{value}</span>}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function RelancesPage() {
  const { activeWorkspace } = useWorkspace();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeSegment, setActiveSegment] = useState<Segment | "all">("all");
  const [searchQ, setSearchQ] = useState("");
  const [mounted, setMounted] = useState(false);
  const [inactifDays, setInactifDays] = useState(60);
  const [vipThreshold, setVipThreshold] = useState(500);
  const [nouveauDays, setNouveauDays] = useState(30);
  const [regulierMinVentes, setRegulierMinVentes] = useState(2);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tmpInactif, setTmpInactif] = useState(60);
  const [tmpVip, setTmpVip] = useState(500);
  const [tmpNouveau, setTmpNouveau] = useState(30);
  const [tmpRegulierMinVentes, setTmpRegulierMinVentes] = useState(2);

  // Email modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { fetchAll(); }, [activeWorkspace?.id]);

  async function fetchAll() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      if (!activeWorkspace) { setClients([]); setSales([]); setLoading(false); return; }
      const [{ data: cData, error: cErr }, { data: sData, error: sErr }] = await Promise.all([
        supabase.from("clients").select("id,email,prenom,nom,created_at,status_override").eq("workspace_id", activeWorkspace.id).limit(2000),
        supabase.from("sales").select("id,client_id,amount,created_at").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(10000),
      ]);
      if (cErr) throw cErr; if (sErr) throw sErr;
      setClients((cData ?? []) as ClientRow[]);
      setSales((sData ?? []) as SaleRow[]);
    } catch (e: any) { setErrorMsg(e?.message ?? "Erreur inconnue"); }
    finally { setLoading(false); }
  }

  function handleStatusChanged(clientId: string, newStatus: StatusOverride) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status_override: newStatus } : c));
  }

  const clientStats = useMemo(() => {
    const salesByClient = new Map<string, SaleRow[]>();
    for (const s of sales) {
      if (!s.client_id) continue;
      if (!salesByClient.has(s.client_id)) salesByClient.set(s.client_id, []);
      salesByClient.get(s.client_id)!.push(s);
    }
    return clients.map(c => {
      const cs = salesByClient.get(c.id) ?? [];
      const caTotal = cs.reduce((a, s) => a + moneyToNumberAny(s.amount), 0);
      const nbVentes = cs.length;
      const lastSale = cs.length > 0 ? cs.reduce((a, b) => (a.created_at ?? "") > (b.created_at ?? "") ? a : b) : null;
      const lastSaleDate = lastSale?.created_at ?? null;
      const daysSinceLast = lastSaleDate ? daysSince(lastSaleDate) : null;
      const clientAgeDays = c.created_at ? daysSince(c.created_at) : 999;
      let segment: Segment;
      if (c.status_override && STATUS_OVERRIDE_TO_SEGMENT[c.status_override]) {
        segment = STATUS_OVERRIDE_TO_SEGMENT[c.status_override];
      } else if (nbVentes === 0) { segment = "jamais";
      } else if (daysSinceLast !== null && daysSinceLast >= inactifDays) { segment = "inactif";
      } else if (caTotal >= vipThreshold) { segment = "vip";
      } else if (clientAgeDays <= nouveauDays && nbVentes <= 2) { segment = "nouveau";
      } else { segment = "regulier"; }
      return { client: c, caTotal, nbVentes, lastSaleDate, daysSinceLast, segment };
    });
  }, [clients, sales, inactifDays, vipThreshold, nouveauDays, regulierMinVentes]);

  const globalStats = useMemo(() => {
    const inactifs = clientStats.filter(c => c.segment === "inactif");
    const caInactifs = inactifs.reduce((a, c) => a + c.caTotal, 0);
    const panierMoyenInactif = inactifs.length > 0 ? caInactifs / inactifs.length : 0;
    const caPotentiel = inactifs.length * panierMoyenInactif;
    const countBySegment = Object.fromEntries(SEGMENTS.map(s => [s.key, clientStats.filter(c => c.segment === s.key).length])) as Record<Segment, number>;
    return { caInactifs, caPotentiel, countBySegment };
  }, [clientStats]);

  const filtered = useMemo(() => {
    let list = activeSegment === "all" ? clientStats : clientStats.filter(c => c.segment === activeSegment);
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter(c => `${c.client.prenom ?? ""} ${c.client.nom ?? ""} ${c.client.email ?? ""}`.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.caTotal - a.caTotal);
  }, [clientStats, activeSegment, searchQ]);

  // Emails du segment actif (filtrés)
  const segmentEmails = useMemo(
    () => filtered.map(f => f.client.email ?? "").filter(Boolean),
    [filtered]
  );

  function exportSegment() {
    const rows = filtered.map(cs => [
      cs.client.prenom ?? "", cs.client.nom ?? "", cs.client.email ?? "",
      SEGMENTS.find(s => s.key === cs.segment)?.label ?? cs.segment,
      cs.caTotal.toFixed(2).replace(".", ","), String(cs.nbVentes),
      cs.lastSaleDate ? toFRDate(cs.lastSaleDate) : "—",
      cs.daysSinceLast !== null ? String(cs.daysSinceLast) + " j" : "—",
    ]);
    const header = ["Prénom", "Nom", "Email", "Segment", "CA total (€)", "Nb ventes", "Dernière vente", "Inactivité"];
    const now = new Date();
    const dateStr = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
    downloadCSV(`relances_${activeSegment === "all" ? "tous" : activeSegment}_${dateStr}.csv`, [header, ...rows]);
  }

  if (!activeWorkspace) return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Relances</div>
      <h1 className="ds-title">Relances</h1>
      <div style={{ padding: "60px 0", textAlign: "center", opacity: 0.5 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>Aucun workspace sélectionné</div>
      </div>
    </div>
  );

  const activeSegInfo = SEGMENTS.find(s => s.key === activeSegment);

  // Infos segment pour le modal email
  const emailSegmentKey = activeSegment;
  const emailSegmentLabel = activeSegment === "all" ? "Tous" : (activeSegInfo?.label ?? "Tous");
  const emailSegmentEmoji = activeSegment === "all" ? "👥" : (activeSegInfo?.emoji ?? "👥");
  const emailSegmentColor = activeSegment === "all" ? "rgba(120,160,255,0.95)" : (activeSegInfo?.color ?? "rgba(120,160,255,0.95)");
  const emailSegmentBg = activeSegment === "all" ? "rgba(120,160,255,0.10)" : (activeSegInfo?.bg ?? "rgba(120,160,255,0.10)");

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Relances</div>
      <div className="ds-header">
        <div>
          <h1 className="ds-title">Relances & Segments</h1>
          <p className="ds-subtitle">Identifie tes clients à relancer — <strong style={{ color: "rgba(99,120,255,0.9)" }}>{activeWorkspace.name}</strong></p>
          {errorMsg && <p style={{ marginTop: 8, color: "rgba(255,120,120,0.95)", fontWeight: 800 }}>Erreur : {errorMsg}</p>}
        </div>
        <div className="ds-right-tools">
          <button className="ds-btn ds-btn-ghost" type="button" onClick={fetchAll} disabled={loading}>{loading ? "Chargement..." : "Actualiser"}</button>
          <button type="button"
            onClick={() => { setTmpInactif(inactifDays); setTmpVip(vipThreshold); setTmpNouveau(nouveauDays); setTmpRegulierMinVentes(regulierMinVentes); setSettingsOpen(true); }}
            style={{ height: 40, padding: "0 16px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.80)", fontWeight: 750, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            ⚙ Paramètres
          </button>
        </div>
      </div>

      <div className="ds-stats-grid">
        <div className="ds-stat-card"><div className="ds-stat-label">Total clients</div><div className="ds-stat-value">{clients.length}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">Clients inactifs (+{inactifDays}j)</div><div className="ds-stat-value" style={{ color: "rgba(255,140,80,0.95)" }}>{globalStats.countBySegment.inactif}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">CA généré par inactifs</div><div className="ds-stat-value" style={{ color: "rgba(255,140,80,0.85)" }}>{formatEUR(globalStats.caInactifs)}</div></div>
        <div className="ds-stat-card"><div className="ds-stat-label">CA potentiel si relance</div><div className="ds-stat-value" style={{ color: "rgba(120,220,140,0.95)" }}>{formatEUR(globalStats.caPotentiel)}</div><div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Basé sur panier moyen</div></div>
      </div>

      <div className="rl-seg-scroll">
        <div className="rl-seg-track">
          <div onClick={() => setActiveSegment("all")} className={`rl-seg-pill ${activeSegment === "all" ? "rl-seg-pill-active" : ""}`}
            style={activeSegment === "all" ? { borderColor: "rgba(120,160,255,0.45)", background: "rgba(120,160,255,0.10)" } : {}}>
            <span className="rl-seg-pill-emoji">👥</span>
            <span className="rl-seg-pill-count" style={{ color: "rgba(255,255,255,0.9)" }}>{clients.length}</span>
            <span className="rl-seg-pill-label">Tous</span>
          </div>
          {SEGMENTS.map(seg => (
            <div key={seg.key} onClick={() => setActiveSegment(seg.key)} className={`rl-seg-pill ${activeSegment === seg.key ? "rl-seg-pill-active" : ""}`}
              style={activeSegment === seg.key ? { borderColor: seg.color.replace("0.95", "0.45"), background: seg.bg } : {}}>
              <span className="rl-seg-pill-emoji">{seg.emoji}</span>
              <span className="rl-seg-pill-count" style={{ color: seg.color }}>{globalStats.countBySegment[seg.key]}</span>
              <span className="rl-seg-pill-label">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="ds-card">
        <div className="ds-card-head" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="ds-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {activeSegment !== "all" && activeSegInfo && <span style={{ fontSize: 18 }}>{activeSegInfo.emoji}</span>}
              {activeSegment === "all" ? "Tous les clients" : activeSegInfo?.label}
            </div>
            <div className="ds-card-sub">{filtered.length} client{filtered.length > 1 ? "s" : ""}{activeSegment !== "all" ? ` · ${activeSegInfo?.desc}` : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.35, fontSize: 14, pointerEvents: "none" }}>⌕</span>
              <input placeholder="Rechercher…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ height: 36, borderRadius: 10, padding: "0 12px 0 32px", background: "rgba(10,11,14,0.65)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.10)", outline: "none", fontSize: 13, width: 200 }} />
            </div>
            {/* ✉ Bouton relance email */}
            <button type="button" onClick={() => setEmailModalOpen(true)}
              style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(120,160,255,0.35)", background: "rgba(120,160,255,0.12)", color: "rgba(165,180,255,0.95)", fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
              ✉ Relancer par email
              {segmentEmails.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "rgba(120,160,255,0.18)", color: "rgba(165,180,255,0.9)" }}>
                  {segmentEmails.length}
                </span>
              )}
            </button>
            <button type="button" onClick={exportSegment}
              style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.80)", fontSize: 13, fontWeight: 750, cursor: "pointer", whiteSpace: "nowrap" }}>
              ↓ Exporter CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>Chargement…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", opacity: 0.5 }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
            <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.7)" }}>Aucun client dans ce segment</div>
          </div>
        ) : (
          <>
            {/* Desktop : tableau */}
            <div className="rl-desktop-table">
              <div className="ds-table-wrap">
                <table className="ds-table">
                  <thead>
                    <tr><th>Client</th><th>Statut</th><th className="ds-right">CA total</th><th className="ds-right">Ventes</th><th className="ds-right">Dernière vente</th><th className="ds-right">Inactivité</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ client, caTotal, nbVentes, lastSaleDate, daysSinceLast, segment }) => {
                      const inactifAlert = segment === "inactif";
                      return (
                        <tr key={client.id}>
                          <td>
                            <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                              {`${client.prenom ?? ""} ${client.nom ?? ""}`.trim() || client.email || "Client"}
                              {client.status_override && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.25)", color: "rgba(120,160,255,0.8)" }}>Manuel</span>}
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.5, marginTop: 1 }}>{client.email || "—"}</div>
                          </td>
                          <td>
                            <StatusPickerDropdown client={client} computedSegment={segment} onStatusChanged={handleStatusChanged} />
                          </td>
                          <td className="ds-right" style={{ fontWeight: 800, color: "rgba(120,160,255,0.9)" }}>{formatEUR(caTotal)}</td>
                          <td className="ds-right" style={{ fontWeight: 700, opacity: 0.8 }}>{nbVentes}</td>
                          <td className="ds-right" style={{ fontSize: 13, opacity: 0.75 }}>{lastSaleDate ? toFRDate(lastSaleDate) : <span style={{ opacity: 0.4 }}>—</span>}</td>
                          <td className="ds-right">
                            {daysSinceLast !== null ? (
                              <span style={{ fontWeight: 700, fontSize: 13, color: inactifAlert ? "rgba(255,140,80,0.95)" : "rgba(255,255,255,0.60)" }}>
                                {daysSinceLast} j{inactifAlert && " ⚠"}
                              </span>
                            ) : <span style={{ opacity: 0.3 }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile : cartes */}
            <div className="rl-mobile-list">
              {filtered.map(({ client, caTotal, nbVentes, lastSaleDate, daysSinceLast, segment }) => (
                <MobileRelanceCard
                  key={client.id}
                  client={client}
                  caTotal={caTotal}
                  nbVentes={nbVentes}
                  lastSaleDate={lastSaleDate}
                  daysSinceLast={daysSinceLast}
                  segment={segment}
                  onStatusChanged={handleStatusChanged}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modal Email ── */}
      {emailModalOpen && mounted && (
        <EmailModal
          segment={emailSegmentKey}
          segmentLabel={emailSegmentLabel}
          segmentEmoji={emailSegmentEmoji}
          segmentColor={emailSegmentColor}
          segmentBg={emailSegmentBg}
          emailList={segmentEmails}
          onClose={() => setEmailModalOpen(false)}
        />
      )}

      {/* ── Modal Paramètres ── */}
      {settingsOpen && mounted && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(0,0,0,0.58)", backdropFilter: "blur(10px)", overflowY: "auto" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div style={{ width: 480, maxWidth: "100%", borderRadius: 18, padding: 24, background: "linear-gradient(180deg, rgba(20,22,28,0.98), rgba(12,13,16,0.98))", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 30px 80px rgba(0,0,0,0.6)", margin: "auto" }}
            onMouseDown={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>Paramètres de segmentation</div>
                <div style={{ fontSize: 13, opacity: 0.55, marginTop: 3 }}>Adapte les seuils à ton activité</div>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, color: "rgba(255,255,255,0.7)", padding: "8px 14px", cursor: "pointer", fontWeight: 750 }}>Fermer</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Inactivité */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,140,80,0.06)", border: "1px solid rgba(255,140,80,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,140,80,0.95)" }}>😴 Client inactif après</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Nombre de jours sans achat</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(255,140,80,0.95)" }}>{tmpInactif}j</div>
                </div>
                <input type="range" min={7} max={365} step={1} value={tmpInactif} onChange={e => setTmpInactif(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(255,140,80,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>7 jours</span><span>365 jours</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[30, 60, 90, 180].map(v => (
                    <button key={v} type="button" onClick={() => setTmpInactif(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpInactif === v ? "rgba(255,140,80,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpInactif === v ? "rgba(255,140,80,0.16)" : "rgba(255,255,255,0.03)", color: tmpInactif === v ? "rgba(255,140,80,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v}j</button>
                  ))}
                </div>
              </div>
              {/* VIP */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(255,200,80,0.06)", border: "1px solid rgba(255,200,80,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(255,200,80,0.95)" }}>👑 Client VIP à partir de</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>CA total minimum</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(255,200,80,0.95)" }}>{tmpVip} €</div>
                </div>
                <input type="range" min={50} max={5000} step={50} value={tmpVip} onChange={e => setTmpVip(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(255,200,80,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>50 €</span><span>5 000 €</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[200, 500, 1000, 2000].map(v => (
                    <button key={v} type="button" onClick={() => setTmpVip(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpVip === v ? "rgba(255,200,80,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpVip === v ? "rgba(255,200,80,0.16)" : "rgba(255,255,255,0.03)", color: tmpVip === v ? "rgba(255,200,80,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v} €</button>
                  ))}
                </div>
              </div>
              {/* Régulier */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(120,160,255,0.05)", border: "1px solid rgba(120,160,255,0.15)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(120,160,255,0.95)" }}>⭐ Client régulier à partir de</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Nombre minimum de ventes</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(120,160,255,0.95)" }}>{tmpRegulierMinVentes} vente{tmpRegulierMinVentes > 1 ? "s" : ""}</div>
                </div>
                <input type="range" min={1} max={20} step={1} value={tmpRegulierMinVentes} onChange={e => setTmpRegulierMinVentes(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(120,160,255,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>1 vente</span><span>20 ventes</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[2, 3, 5, 10].map(v => (
                    <button key={v} type="button" onClick={() => setTmpRegulierMinVentes(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpRegulierMinVentes === v ? "rgba(120,160,255,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpRegulierMinVentes === v ? "rgba(120,160,255,0.16)" : "rgba(255,255,255,0.03)", color: tmpRegulierMinVentes === v ? "rgba(120,160,255,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v}</button>
                  ))}
                </div>
              </div>
              {/* Nouveau */}
              <div style={{ padding: "16px 18px", borderRadius: 14, background: "rgba(120,220,140,0.05)", border: "1px solid rgba(120,220,140,0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div><div style={{ fontWeight: 800, fontSize: 14, color: "rgba(120,220,140,0.95)" }}>✨ Nouveau client pendant</div><div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>Jours depuis l'inscription</div></div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: "rgba(120,220,140,0.95)" }}>{tmpNouveau}j</div>
                </div>
                <input type="range" min={7} max={90} step={1} value={tmpNouveau} onChange={e => setTmpNouveau(Number(e.target.value))} style={{ width: "100%", accentColor: "rgba(120,220,140,0.9)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.4, marginTop: 4 }}><span>7 jours</span><span>90 jours</span></div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {[14, 30, 45, 60].map(v => (
                    <button key={v} type="button" onClick={() => setTmpNouveau(v)} style={{ height: 28, padding: "0 12px", borderRadius: 999, border: `1px solid ${tmpNouveau === v ? "rgba(120,220,140,0.45)" : "rgba(255,255,255,0.10)"}`, background: tmpNouveau === v ? "rgba(120,220,140,0.16)" : "rgba(255,255,255,0.03)", color: tmpNouveau === v ? "rgba(120,220,140,0.95)" : "rgba(255,255,255,0.65)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{v}j</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button type="button" onClick={() => setSettingsOpen(false)} style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.7)", fontWeight: 750, cursor: "pointer" }}>Annuler</button>
              <button type="button" onClick={() => { setInactifDays(tmpInactif); setVipThreshold(tmpVip); setNouveauDays(tmpNouveau); setRegulierMinVentes(tmpRegulierMinVentes); setSettingsOpen(false); }}
                style={{ height: 40, padding: "0 22px", borderRadius: 999, border: "1px solid rgba(120,160,255,0.40)", background: "rgba(120,160,255,0.16)", color: "rgba(255,255,255,0.95)", fontWeight: 800, cursor: "pointer" }}>Appliquer</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx global>{`
        .rl-seg-scroll { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-bottom: 20px; padding-bottom: 4px; }
        .rl-seg-scroll::-webkit-scrollbar { display: none; }
        .rl-seg-track { display: flex; gap: 10px; min-width: max-content; }
        .rl-seg-pill { border-radius: 14px; padding: 14px 16px; border: 1.5px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); cursor: pointer; transition: all 120ms; display: flex; flex-direction: column; align-items: flex-start; min-width: 110px; }
        .rl-seg-pill-emoji { font-size: 20px; margin-bottom: 6px; }
        .rl-seg-pill-count { font-weight: 900; font-size: 22px; line-height: 1; }
        .rl-seg-pill-label { font-weight: 700; font-size: 12px; color: rgba(255,255,255,0.65); margin-top: 4px; }
        .rl-desktop-table { display: block; }
        .rl-mobile-list { display: none; }
        @media (max-width: 768px) {
          .rl-desktop-table { display: none; }
          .rl-mobile-list { display: block; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
          .rl-seg-pill { min-width: 90px; padding: 12px 12px; }
          .rl-seg-pill-count { font-size: 18px; }
          .rl-seg-pill-emoji { font-size: 18px; margin-bottom: 4px; }
        }
      `}</style>
    </div>
  );
}