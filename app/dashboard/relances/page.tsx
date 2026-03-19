"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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

// ── Color helpers ─────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").padEnd(6, "0");
  return [parseInt(h.slice(0,2),16)||99, parseInt(h.slice(2,4),16)||120, parseInt(h.slice(4,6),16)||255];
}
function hexAlpha(hex: string, a: number): string {
  const [r,g,b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`;
}
function darkenHex(hex: string, pct: number): string {
  const d = (v: number) => Math.max(0, Math.floor(v * (1 - pct)));
  const [r,g,b] = hexToRgb(hex);
  return `#${[d(r),d(g),d(b)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}

// ── Section order definitions ─────────────────────────────────────────────────
type EmailSectionKey = "hero" | "body" | "promo" | "cta" | "shopinfo";
const EMAIL_SECTIONS: { key: EmailSectionKey; label: string; icon: string }[] = [
  { key: "hero",     label: "Image hero",       icon: "🖼" },
  { key: "body",     label: "Message principal", icon: "✉️" },
  { key: "promo",    label: "Bloc promo",        icon: "🎁" },
  { key: "cta",      label: "Bouton CTA",        icon: "🔗" },
  { key: "shopinfo", label: "Infos boutique",    icon: "🏪" },
];
const DEFAULT_SECTION_ORDER: EmailSectionKey[] = ["hero", "body", "promo", "cta", "shopinfo"];

// ── Generate HTML email ──────────────────────────────────────────────────────
function generateEmailHTML({
  shopName, segmentEmoji, segmentLabel, subject, body,
  promoEnabled, promoCode, promoDesc,
  heroImage, ctaText, ctaUrl, accentColor,
  shopAddress, shopHours, shopPhone,
  sectionOrder,
}: {
  shopName: string; segmentEmoji: string; segmentLabel: string;
  subject: string; body: string;
  promoEnabled: boolean; promoCode: string; promoDesc: string;
  heroImage: string; ctaText: string; ctaUrl: string; accentColor: string;
  shopAddress: string; shopHours: string; shopPhone: string;
  sectionOrder: EmailSectionKey[];
}): string {
  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const acc = accentColor || "#6378ff";
  const accDark = darkenHex(acc, 0.20);
  const accLight = hexAlpha(acc, 0.08);
  const accMid   = hexAlpha(acc, 0.22);
  const accBorder = hexAlpha(acc, 0.42);
  const initials = shopName.split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()||"CF";
  const year = new Date().getFullYear();

  // ── Body paragraphs ──
  const bodyHtml = body.split("\n").map(line =>
    line.trim()
      ? `<p style="margin:0 0 16px;color:#2a2a3e;font-size:15px;line-height:1.82;">${esc(line)}</p>`
      : `<div style="height:6px;"></div>`
  ).join("");

  // ── Hero section ──
  const heroSection = heroImage
    ? `<tr>
        <td style="line-height:0;font-size:0;padding:0;">
          <img src="${esc(heroImage)}" alt="${esc(shopName)}" width="600"
            style="display:block;width:100%;max-height:300px;object-fit:cover;font-size:0;" />
        </td>
      </tr>
      <tr>
        <td style="padding:30px 48px 0;text-align:center;background:#fff;">
          <h1 style="margin:0 0 10px;font-size:28px;font-weight:900;color:#12122a;letter-spacing:-0.5px;">${esc(shopName)}</h1>
          <div style="display:inline-block;padding:5px 18px;border-radius:999px;background:${accLight};border:1px solid ${hexAlpha(acc,0.30)};font-size:12px;color:${acc};font-weight:700;letter-spacing:0.3px;">
            ${segmentEmoji}&nbsp; Message ${esc(segmentLabel)}
          </div>
        </td>
      </tr>`
    : `<tr>
        <td style="background:linear-gradient(135deg,${acc} 0%,${accDark} 100%);padding:52px 48px 44px;text-align:center;">
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 20px;">
            <tr>
              <td style="width:62px;height:62px;border-radius:18px;background:rgba(255,255,255,0.22);text-align:center;vertical-align:middle;border:2px solid rgba(255,255,255,0.35);">
                <span style="color:#fff;font-family:'Courier New',monospace;font-weight:800;font-size:17px;letter-spacing:0.5px;">${initials}</span>
              </td>
            </tr>
          </table>
          <h1 style="margin:0 0 12px;font-size:32px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${esc(shopName)}</h1>
          <div style="display:inline-block;padding:6px 20px;border-radius:999px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.38);font-size:12px;color:#fff;font-weight:700;letter-spacing:0.3px;">
            ${segmentEmoji}&nbsp; Message ${esc(segmentLabel)}
          </div>
        </td>
      </tr>`;

  // ── Promo block ──
  const promoBlock = promoEnabled && (promoCode || promoDesc) ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:24px 0 8px;">
      <tr>
        <td style="padding:26px 28px;background:${accLight};border:2px dashed ${accBorder};border-radius:14px;text-align:center;">
          ${promoDesc ? `<p style="margin:0 0 ${promoCode?"16px":"0"};font-size:16px;font-weight:700;color:${acc};">${esc(promoDesc)}</p>` : ""}
          ${promoCode ? `<div style="display:inline-block;padding:14px 34px;background:#fff;border:2px solid ${hexAlpha(acc,0.55)};border-radius:12px;margin-bottom:12px;box-shadow:0 4px 16px ${hexAlpha(acc,0.15)};">
            <span style="font-family:'Courier New',monospace;font-size:24px;font-weight:900;color:${acc};letter-spacing:6px;">${esc(promoCode)}</span>
          </div>
          <p style="margin:0;font-size:12px;color:#9090a8;">Code à présenter lors de votre prochaine visite</p>` : ""}
        </td>
      </tr>
    </table>` : "";

  // ── CTA button ──
  const ctaHref = ctaUrl.trim()
    ? (ctaUrl.startsWith("http")||ctaUrl.startsWith("mailto")||ctaUrl.startsWith("tel") ? ctaUrl : /^[\d\s\+\-\(\)\.]{6,}$/.test(ctaUrl.trim()) ? `tel:${ctaUrl.replace(/\s/g,"")}` : `https://${ctaUrl}`)
    : "";
  const ctaBlock = ctaHref ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0 4px;">
      <tr>
        <td align="center">
          <a href="${esc(ctaHref)}" style="display:inline-block;padding:16px 44px;background:linear-gradient(135deg,${acc} 0%,${accDark} 100%);color:#ffffff;text-decoration:none;border-radius:12px;font-weight:800;font-size:15px;letter-spacing:0.3px;box-shadow:0 6px 24px ${hexAlpha(acc,0.38)};">${esc(ctaText||"Nous rendre visite")}</a>
        </td>
      </tr>
    </table>` : "";

  // ── Shop info block ──
  const hasShopInfo = shopAddress.trim()||shopHours.trim()||shopPhone.trim();
  const shopInfoBlock = hasShopInfo ? `
    <tr>
      <td style="padding:24px 48px 22px;background:#f6f6fb;border-top:1px solid #eaeaf4;">
        <p style="margin:0 0 16px;font-size:11px;font-weight:800;color:#9898b8;letter-spacing:1.4px;text-transform:uppercase;text-align:center;">Nos informations</p>
        <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto;">
          ${shopAddress.trim() ? `<tr><td style="padding:6px 0;font-size:14px;color:#3a3a56;vertical-align:top;white-space:nowrap;">
            <span style="display:inline-block;width:26px;text-align:center;font-size:15px;">📍</span>&nbsp;
            <span style="font-weight:600;">${esc(shopAddress)}</span>
          </td></tr>` : ""}
          ${shopHours.trim() ? `<tr><td style="padding:6px 0;font-size:14px;color:#3a3a56;vertical-align:top;white-space:nowrap;">
            <span style="display:inline-block;width:26px;text-align:center;font-size:15px;">🕐</span>&nbsp;
            <span style="font-weight:600;">${esc(shopHours)}</span>
          </td></tr>` : ""}
          ${shopPhone.trim() ? `<tr><td style="padding:6px 0;font-size:14px;color:#3a3a56;vertical-align:top;white-space:nowrap;">
            <span style="display:inline-block;width:26px;text-align:center;font-size:15px;">📞</span>&nbsp;
            <a href="tel:${esc(shopPhone.replace(/\s/g,""))}" style="color:${acc};font-weight:700;text-decoration:none;">${esc(shopPhone)}</a>
          </td></tr>` : ""}
        </table>
      </td>
    </tr>` : "";

  // ── Section map (each is a <tr> block) ──
  const heroTr = heroSection;
  const bodyTr = `<tr><td style="padding:40px 48px 24px;background:#ffffff;">${bodyHtml}</td></tr>`;
  const promoTr = promoEnabled && (promoCode || promoDesc)
    ? `<tr><td style="padding:0 48px 8px;background:#ffffff;">${promoBlock}</td></tr>`
    : "";
  const ctaTr = ctaHref
    ? `<tr><td style="padding:0 48px 24px;background:#ffffff;">${ctaBlock}</td></tr>`
    : "";
  const shopinfoTr = shopInfoBlock;

  const sectionMap: Record<EmailSectionKey, string> = {
    hero: heroTr,
    body: bodyTr,
    promo: promoTr,
    cta: ctaTr,
    shopinfo: shopinfoTr,
  };

  const orderedSections = sectionOrder.map(k => sectionMap[k]).join("\n");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ecedf4;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ecedf4;">
  <tr>
    <td align="center" style="padding:32px 12px 52px;">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
        style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 48px rgba(0,0,20,0.12);">

        ${orderedSections}

        <!-- Footer -->
        <tr>
          <td style="padding:20px 48px 26px;background:#f2f2f8;border-top:1px solid #e4e4f0;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#9898b4;">
              © ${year}&nbsp;<strong style="color:#5a5a78;">${esc(shopName)}</strong>&nbsp;&middot;&nbsp;Géré via
              <span style="color:${acc};font-weight:700;">ClientFlow</span>
            </p>
            <p style="margin:0;font-size:11px;color:#b4b4cc;">
              Vous recevez ce message car vous êtes client(e) de ${esc(shopName)}.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ── ToggleSection : composant réutilisable ────────────────────────────────────
function ToggleSection({ icon, title, subtitle, enabled, onToggle, accent, children }: {
  icon: string; title: string; subtitle: string;
  enabled: boolean; onToggle: () => void; accent?: string;
  children: React.ReactNode;
}) {
  const borderColor = enabled ? (accent ? `${accent}55` : "rgba(99,120,255,0.32)") : "rgba(255,255,255,0.08)";
  const bg = enabled ? (accent ? `${accent}14` : "rgba(99,120,255,0.09)") : "rgba(255,255,255,0.02)";
  const titleColor = enabled ? (accent || "rgba(165,185,255,0.95)") : "rgba(255,255,255,0.75)";
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${borderColor}`, overflow: "hidden" }}>
      <button type="button" onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", background: bg, border: "none", cursor: "pointer", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: titleColor }}>{title}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ width: 40, height: 22, borderRadius: 11, background: enabled ? (accent || "rgba(99,120,255,0.82)") : "rgba(255,255,255,0.14)", position: "relative", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: 3, left: enabled ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.4)", transition: "left 180ms" }} />
        </div>
      </button>
      {enabled && (
        <div style={{ padding: "6px 18px 18px", background: enabled ? (accent ? `${accent}08` : "rgba(99,120,255,0.04)") : undefined }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Séparateur section design (défini hors EmailModal pour stabiliser le type React) ──
function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 2px" }}>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.28)", letterSpacing: 1.1, textTransform: "uppercase" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

// ── Email Modal ───────────────────────────────────────────────────────────────
function EmailModal({
  segment, segmentLabel, segmentEmoji, segmentColor, segmentBg,
  emailList, shopName, resendApiKey, workspaceId, onClose,
}: {
  segment: Segment | "all"; segmentLabel: string; segmentEmoji: string;
  segmentColor: string; segmentBg: string; emailList: string[];
  shopName: string; resendApiKey: string; workspaceId: string; onClose: () => void;
}) {
  const def = DEFAULT_TEMPLATES[segment];
  // Contenu
  const [subject,    setSubject]    = useState(def.subject);
  const [body,       setBody]       = useState(def.body);
  // Promo
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoCode,    setPromoCode]    = useState("");
  const [promoDesc,    setPromoDesc]    = useState("");
  // Design
  const [accentColor, setAccentColor] = useState("#6378ff");
  // Hero image
  const [heroSrc,      setHeroSrc]      = useState("");  // base64 ou URL confirmée
  const [heroUrlDraft, setHeroUrlDraft] = useState("");
  // CTA
  const [ctaText, setCtaText] = useState("Nous rendre visite →");
  const [ctaUrl,  setCtaUrl]  = useState("");
  // Infos boutique
  const [shopInfoEnabled, setShopInfoEnabled] = useState(false);
  const [shopAddress,     setShopAddress]     = useState("");
  const [shopHours,       setShopHours]       = useState("");
  const [shopPhone,       setShopPhone]       = useState("");
  // Section order
  const [sectionOrder, setSectionOrder] = useState<EmailSectionKey[]>([...DEFAULT_SECTION_ORDER]);
  // UI
  const [activeTab,   setActiveTab]   = useState<"compose" | "preview">("compose");
  const [copied,      setCopied]      = useState(false);
  const [copiedHtml,  setCopiedHtml]  = useState(false);
  const [sending,     setSending]     = useState(false);
  const [sendResult,  setSendResult]  = useState<{ ok: boolean; msg: string } | null>(null);
  // Persistence template
  const [templateLoading, setTemplateLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const isReadyRef  = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = { current: null as HTMLInputElement | null };

  // ── Chargement du template sauvegardé ──────────────────────────────────────
  useEffect(() => {
    async function loadTemplate() {
      setTemplateLoading(true);
      isReadyRef.current = false;
      try {
        const { data } = await supabase
          .from("email_templates")
          .select("template_data")
          .eq("workspace_id", workspaceId)
          .eq("segment_type", segment)
          .single();
        if (data?.template_data) {
          const t = data.template_data as Record<string, unknown>;
          if (typeof t.subject      === "string") setSubject(t.subject);
          if (typeof t.body         === "string") setBody(t.body);
          if (typeof t.promoEnabled === "boolean") setPromoEnabled(t.promoEnabled);
          if (typeof t.promoCode    === "string") setPromoCode(t.promoCode);
          if (typeof t.promoDesc    === "string") setPromoDesc(t.promoDesc);
          if (typeof t.accentColor  === "string") setAccentColor(t.accentColor);
          if (typeof t.heroSrc      === "string") setHeroSrc(t.heroSrc);
          if (typeof t.ctaText      === "string") setCtaText(t.ctaText);
          if (typeof t.ctaUrl       === "string") setCtaUrl(t.ctaUrl);
          if (typeof t.shopInfoEnabled === "boolean") setShopInfoEnabled(t.shopInfoEnabled);
          if (typeof t.shopAddress  === "string") setShopAddress(t.shopAddress);
          if (typeof t.shopHours    === "string") setShopHours(t.shopHours);
          if (typeof t.shopPhone    === "string") setShopPhone(t.shopPhone);
          if (Array.isArray(t.sectionOrder)) setSectionOrder(t.sectionOrder as EmailSectionKey[]);
        }
      } catch { /* pas de template sauvegardé — on garde les défauts */ }
      finally {
        setTemplateLoading(false);
        setTimeout(() => { isReadyRef.current = true; }, 0);
      }
    }
    loadTemplate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sauvegarde automatique avec debounce 1s ────────────────────────────────
  useEffect(() => {
    if (!isReadyRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      const templateData = {
        subject, body, promoEnabled, promoCode, promoDesc,
        accentColor, heroSrc, ctaText, ctaUrl,
        shopInfoEnabled, shopAddress, shopHours, shopPhone, sectionOrder,
      };
      await supabase.from("email_templates").upsert(
        { workspace_id: workspaceId, segment_type: segment, template_data: templateData, updated_at: new Date().toISOString() },
        { onConflict: "workspace_id,segment_type" }
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [subject, body, promoEnabled, promoCode, promoDesc, accentColor, heroSrc, ctaText, ctaUrl, shopInfoEnabled, shopAddress, shopHours, shopPhone, sectionOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  function moveSection(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= sectionOrder.length) return;
    setSectionOrder(prev => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  }

  const validEmails  = emailList.filter(Boolean);
  const noEmails     = validEmails.length === 0;
  const effectiveHero = heroSrc;

  const htmlContent = generateEmailHTML({
    shopName, segmentEmoji, segmentLabel, subject, body,
    promoEnabled, promoCode, promoDesc,
    heroImage: effectiveHero, ctaText, ctaUrl, accentColor,
    shopAddress: shopInfoEnabled ? shopAddress : "",
    shopHours:   shopInfoEnabled ? shopHours   : "",
    shopPhone:   shopInfoEnabled ? shopPhone   : "",
    sectionOrder,
  });

  function openMailto() {
    window.open(`mailto:${validEmails.join(",")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
  }
  function copyEmails() { navigator.clipboard.writeText(validEmails.join(", ")); setCopied(true); setTimeout(()=>setCopied(false), 2000); }
  function copyHtml()   { navigator.clipboard.writeText(htmlContent);            setCopiedHtml(true); setTimeout(()=>setCopiedHtml(false), 2500); }
  function resetTemplate() { setSubject(def.subject); setBody(def.body); }

  async function sendViaResend() {
    setSending(true); setSendResult(null);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: resendApiKey, to: validEmails, subject, html: htmlContent }),
      });
      const json = await res.json();
      if (json.success) {
        setSendResult({ ok: true, msg: `✅ ${json.sent ?? validEmails.length} email(s) envoyé(s) avec succès !` });
      } else {
        setSendResult({ ok: false, msg: `❌ ${json.error ?? "Erreur d'envoi"}` });
      }
    } catch (e: any) {
      setSendResult({ ok: false, msg: `❌ ${e?.message ?? "Erreur réseau"}` });
    } finally { setSending(false); }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => { setHeroSrc(reader.result as string); setHeroUrlDraft(""); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function confirmHeroUrl() {
    const url = heroUrlDraft.trim();
    if (url) { setHeroSrc(url); }
  }

  // Dérivé : affichage de l'image hero dans le formulaire
  const heroIsBase64  = heroSrc.startsWith("data:");
  const heroIsUrl     = heroSrc && !heroIsBase64;

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 12px 48px", background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", overflowY: "auto" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ width: activeTab === "preview" ? 740 : 660, maxWidth: "100%", borderRadius: 22, background: "linear-gradient(180deg,rgba(16,18,28,0.99),rgba(10,11,18,0.99))", border: "1px solid rgba(99,120,255,0.20)", boxShadow: "0 40px 120px rgba(0,0,0,0.82)", display: "flex", flexDirection: "column" }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: "20px 28px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>✉ Relance email</span>
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 11px", borderRadius: 999, background: segmentBg, border: `1px solid ${segmentColor.replace("0.95","0.30")}`, color: segmentColor }}>
                {segmentEmoji} {segmentLabel}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.38)" }}>
              <span>{noEmails ? "⚠️ Aucun email disponible" : `${validEmails.length} destinataire${validEmails.length > 1 ? "s" : ""} · ${shopName}`}</span>
              {templateLoading && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>⟳ Chargement…</span>}
              {!templateLoading && saveStatus === "saving" && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>⟳ Sauvegarde…</span>}
              {!templateLoading && saveStatus === "saved"  && <span style={{ fontSize: 11, color: "rgba(100,210,140,0.75)", fontWeight: 700 }}>✓ Sauvegardé</span>}
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 999, color: "rgba(255,255,255,0.55)", padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>✕</button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", padding: "0 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          {([["compose","✏️ Composer"],["preview","👁 Aperçu"]] as const).map(([key,label]) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)}
              style={{ height: 40, padding: "0 20px", border: "none", borderBottom: activeTab===key ? `2px solid ${accentColor}` : "2px solid transparent", background: "transparent", color: activeTab===key ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.38)", fontSize: 13, fontWeight: activeTab===key ? 800 : 600, cursor: "pointer", marginBottom: -1, transition: "all 150ms" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Scroll body ── */}
        <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", flex: "1 1 auto" }}>

          {templateLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", opacity: 0.45, fontSize: 14, gap: 10 }}>
              <span>⟳</span><span>Chargement du template…</span>
            </div>
          ) : activeTab === "compose" ? (<>

            {/* Destinataires */}
            <div style={{ padding: "11px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: noEmails ? 4 : 7 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.38)", letterSpacing: 1, textTransform: "uppercase" }}>Destinataires ({validEmails.length})</span>
                {validEmails.length > 0 && (
                  <button type="button" onClick={copyEmails}
                    style={{ height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: copied ? "rgba(80,210,140,0.12)" : "rgba(255,255,255,0.04)", color: copied ? "rgba(80,210,140,0.9)" : "rgba(255,255,255,0.50)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {copied ? "✓ Copié !" : "📋 Copier"}
                  </button>
                )}
              </div>
              {noEmails
                ? <div style={{ fontSize: 13, color: "rgba(255,255,255,0.32)" }}>Aucun client avec un email dans ce segment.</div>
                : <div style={{ fontSize: 12, color: "rgba(255,255,255,0.48)", lineHeight: 1.8, maxHeight: 52, overflowY: "auto", wordBreak: "break-all" }}>{validEmails.join(", ")}</div>
              }
            </div>

            {/* Objet */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.60)", marginBottom: 7, letterSpacing: 0.3 }}>OBJET DE L'EMAIL</label>
              <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Objet du mail…"
                style={{ width: "100%", height: 44, borderRadius: 12, padding: "0 14px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(99,120,255,0.24)", outline: "none", fontSize: 14, boxSizing: "border-box" }} />
            </div>

            <SectionDivider label="Design de l'email" />

            {/* ── Image hero ── */}
            <div style={{ borderRadius: 14, border: "1px solid rgba(99,120,255,0.38)", overflow: "hidden", background: "rgba(99,120,255,0.07)" }}>
              {/* Header du bloc */}
              <div style={{ padding: "13px 16px 12px", borderBottom: "1px solid rgba(99,120,255,0.18)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>🖼</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.82)" }}>Image hero</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                    Photo en tête d'email · sans image = dégradé avec le nom de la boutique
                  </div>
                </div>
                {heroSrc && (
                  <button type="button" onClick={() => { setHeroSrc(""); setHeroUrlDraft(""); }}
                    style={{ marginLeft: "auto", height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,80,80,0.25)", background: "rgba(255,80,80,0.08)", color: "rgba(255,120,100,0.90)", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    ✕ Supprimer
                  </button>
                )}
              </div>

              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Prévisualisation ou placeholder */}
                {heroSrc ? (
                  <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", height: 100, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <img src={heroSrc} alt="preview hero" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 10px", background: "linear-gradient(0deg,rgba(0,0,0,0.65),transparent)", fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                      {heroIsBase64 ? "✓ Fichier chargé (base64)" : heroSrc.slice(0, 60) + (heroSrc.length > 60 ? "…" : "")}
                    </div>
                  </div>
                ) : (
                  <div style={{ borderRadius: 10, height: 72, background: `linear-gradient(135deg,${accentColor}88,${darkenHex(accentColor,0.22)}cc)`, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed rgba(255,255,255,0.15)" }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", fontWeight: 700 }}>Aucune image — dégradé affiché dans l'email</span>
                  </div>
                )}

                {/* Champ URL */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.42)", marginBottom: 6 }}>Coller une URL d'image</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      value={heroUrlDraft}
                      onChange={e => setHeroUrlDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") confirmHeroUrl(); }}
                      placeholder="https://monsite.com/photo.jpg"
                      style={{ flex: 1, height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(99,120,255,0.22)", outline: "none", fontSize: 13, boxSizing: "border-box" }}
                    />
                    <button type="button" onClick={confirmHeroUrl} disabled={!heroUrlDraft.trim()}
                      style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(99,120,255,0.32)", background: "rgba(99,120,255,0.14)", color: "rgba(165,185,255,0.92)", fontSize: 12, fontWeight: 800, cursor: heroUrlDraft.trim() ? "pointer" : "not-allowed", opacity: heroUrlDraft.trim() ? 1 : 0.45, whiteSpace: "nowrap" }}>
                      Appliquer
                    </button>
                  </div>
                </div>

                {/* Séparateur OU */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 700, letterSpacing: 0.5 }}>OU</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                </div>

                {/* Upload fichier */}
                <input ref={el => { fileInputRef.current = el; }} type="file" accept="image/*" onChange={handleFileUpload} style={{ display: "none" }} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  📁 Charger depuis l'ordinateur
                </button>
              </div>
            </div>

            {/* Couleur d'accent */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.80)" }}>🎨 Couleur d'accent</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>Header, bouton CTA, séparateurs</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ position: "relative", width: 38, height: 38, borderRadius: 10, overflow: "hidden", boxShadow: `0 0 0 2px ${hexAlpha(accentColor,0.50)}, 0 0 0 4px rgba(255,255,255,0.06)` }}>
                  <input type="color" value={accentColor} onChange={e=>setAccentColor(e.target.value)}
                    style={{ position: "absolute", inset: "-4px", width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", cursor: "pointer", padding: 0 }} />
                </div>
                <input value={accentColor}
                  onChange={e=>{ if(/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) setAccentColor(e.target.value.length===7?e.target.value:e.target.value); }}
                  maxLength={7}
                  style={{ width: 82, height: 36, borderRadius: 9, padding: "0 10px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(99,120,255,0.22)", outline: "none", fontSize: 13, fontFamily: "monospace", fontWeight: 700, letterSpacing: 1, boxSizing: "border-box" }} />
              </div>
            </div>

            {/* Bouton CTA */}
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>🔗</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.80)" }}>Bouton d'action (CTA)</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>Lien ou téléphone — laisser vide pour ne pas afficher</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>Texte du bouton</label>
                  <input value={ctaText} onChange={e=>setCtaText(e.target.value)} placeholder="Nous rendre visite →"
                    style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(99,120,255,0.22)", outline: "none", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>URL ou numéro de téléphone</label>
                  <input value={ctaUrl} onChange={e=>setCtaUrl(e.target.value)} placeholder="https://monsite.fr  ou  +33 6 12 34 56 78"
                    style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(99,120,255,0.22)", outline: "none", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                {ctaUrl.trim() && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: hexAlpha(accentColor, 0.08), border: `1px solid ${hexAlpha(accentColor, 0.25)}` }}>
                    <span style={{ fontSize: 12 }}>👁</span>
                    <span style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>{ctaText || "Nous rendre visite"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Message */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.60)", letterSpacing: 0.3 }}>MESSAGE PRINCIPAL</label>
                <button type="button" onClick={resetTemplate}
                  style={{ height: 26, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>↺ Réinitialiser</button>
              </div>
              <textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} placeholder="Votre message…"
                style={{ width: "100%", borderRadius: 12, padding: "12px 14px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(99,120,255,0.18)", outline: "none", fontSize: 13, lineHeight: 1.75, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            {/* Promo */}
            <ToggleSection icon="🎁" title="Offre / Code promo" subtitle="Bloc visuel mis en avant dans l'email" enabled={promoEnabled} onToggle={()=>setPromoEnabled(v=>!v)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>Description de l'offre</label>
                  <input value={promoDesc} onChange={e=>setPromoDesc(e.target.value)} placeholder="-20% sur votre prochaine commande"
                    style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.92)", border: "1px solid rgba(99,120,255,0.22)", outline: "none", fontSize: 13, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>Code promo <span style={{ opacity: 0.5 }}>(optionnel)</span></label>
                  <input value={promoCode} onChange={e=>setPromoCode(e.target.value.toUpperCase())} placeholder="WELCOME20"
                    style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(7,8,13,0.85)", color: accentColor, border: "1px solid rgba(99,120,255,0.22)", outline: "none", fontSize: 15, fontFamily: "monospace", fontWeight: 800, letterSpacing: 3, boxSizing: "border-box" }} />
                </div>
              </div>
            </ToggleSection>

            {/* Infos boutique */}
            <ToggleSection icon="🏪" title="Infos boutique" subtitle="Adresse, horaires et téléphone dans le footer" enabled={shopInfoEnabled} onToggle={()=>setShopInfoEnabled(v=>!v)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 10 }}>
                {([
                  ["📍", "Adresse", shopAddress, setShopAddress, "12 rue de la Paix, 75001 Paris"],
                  ["🕐", "Horaires d'ouverture", shopHours, setShopHours, "Lun–Sam 9h–19h, Dim 10h–13h"],
                  ["📞", "Téléphone", shopPhone, setShopPhone, "+33 1 23 45 67 89"],
                ] as [string, string, string, (v:string)=>void, string][]).map(([icon, lbl, val, setter, ph]) => (
                  <div key={lbl}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 5 }}>{icon} {lbl}</label>
                    <input value={val} onChange={e=>setter(e.target.value)} placeholder={ph}
                      style={{ width: "100%", height: 40, borderRadius: 10, padding: "0 12px", background: "rgba(7,8,13,0.85)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(99,120,255,0.18)", outline: "none", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
            </ToggleSection>

            {/* Note */}
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.26)", lineHeight: 1.65, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              ℹ️ <strong style={{ color: "rgba(255,255,255,0.38)" }}>Deux façons d'envoyer :</strong> "Ma messagerie" envoie le texte brut. Pour l'email designé, bascule sur <strong style={{ color: hexAlpha(accentColor,0.90) }}>Aperçu</strong> → copie le HTML → colle dans Mailchimp, Brevo…
            </div>

          </>) : (
            /* ── Aperçu ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>Rendu HTML · mise à jour en temps réel</span>
                <button type="button" onClick={copyHtml}
                  style={{ height: 34, padding: "0 16px", borderRadius: 10, border: `1px solid ${copiedHtml ? "rgba(80,210,140,0.40)" : hexAlpha(accentColor,0.40)}`, background: copiedHtml ? "rgba(80,210,140,0.12)" : hexAlpha(accentColor,0.12), color: copiedHtml ? "rgba(80,210,140,0.9)" : accentColor, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  {copiedHtml ? "✓ HTML copié !" : "📋 Copier le HTML"}
                </button>
              </div>

              {/* ── Réorganisation des sections ── */}
              <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.28)", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 }}>Ordre des sections</div>
                {sectionOrder.map((key, idx) => {
                  const sec = EMAIL_SECTIONS.find(s => s.key === key)!;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Section label */}
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: 14 }}>{sec.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{sec.label}</span>
                        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                          <button type="button" onClick={() => moveSection(idx, -1)} disabled={idx === 0}
                            style={{ background: "none", border: "none", padding: "0 2px", cursor: idx === 0 ? "default" : "pointer", fontSize: 13, color: "rgba(255,255,255,0.9)", opacity: idx === 0 ? 0 : 0.4, lineHeight: 1, transition: "opacity 120ms" }}
                            onMouseEnter={e => { if (idx !== 0) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                            onMouseLeave={e => { if (idx !== 0) (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; }}>↑</button>
                          <button type="button" onClick={() => moveSection(idx, 1)} disabled={idx === sectionOrder.length - 1}
                            style={{ background: "none", border: "none", padding: "0 2px", cursor: idx === sectionOrder.length - 1 ? "default" : "pointer", fontSize: 13, color: "rgba(255,255,255,0.9)", opacity: idx === sectionOrder.length - 1 ? 0 : 0.4, lineHeight: 1, transition: "opacity 120ms" }}
                            onMouseEnter={e => { if (idx !== sectionOrder.length - 1) (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                            onMouseLeave={e => { if (idx !== sectionOrder.length - 1) (e.currentTarget as HTMLButtonElement).style.opacity = "0.4"; }}>↓</button>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.22)", fontVariantNumeric: "tabular-nums", minWidth: 10 }}>{idx + 1}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${hexAlpha(accentColor,0.20)}`, boxShadow: "0 8px 40px rgba(0,0,0,0.40)" }}>
                <iframe srcDoc={htmlContent} sandbox="allow-same-origin"
                  style={{ width: "100%", height: 560, border: "none", display: "block" }}
                  title="Aperçu de l'email" />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "14px 28px 18px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
          {sendResult && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: sendResult.ok ? "rgba(80,200,120,0.08)" : "rgba(255,80,80,0.08)", border: `1px solid ${sendResult.ok ? "rgba(80,200,120,0.25)" : "rgba(255,80,80,0.25)"}`, color: sendResult.ok ? "rgba(100,220,140,0.95)" : "rgba(255,120,120,0.95)", fontSize: 13, fontWeight: 700 }}>
              {sendResult.msg}
            </div>
          )}
          {!resendApiKey && (
            <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,180,50,0.07)", border: "1px solid rgba(255,180,50,0.22)", color: "rgba(255,200,80,0.90)", fontSize: 13, fontWeight: 600 }}>
              💡 Configurez votre clé Resend dans <strong>Paramètres → Envoi d'emails</strong> pour envoyer directement.
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {activeTab === "preview" ? (
              <button type="button" onClick={copyHtml}
                style={{ height: 40, padding: "0 18px", borderRadius: 999, border: `1px solid ${copiedHtml ? "rgba(80,210,140,0.35)" : "rgba(255,255,255,0.12)"}`, background: copiedHtml ? "rgba(80,210,140,0.10)" : "rgba(255,255,255,0.04)", color: copiedHtml ? "rgba(80,210,140,0.9)" : "rgba(255,255,255,0.55)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                {copiedHtml ? "✓ HTML copié !" : "📋 Copier le HTML"}
              </button>
            ) : <div />}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={onClose}
                style={{ height: 40, padding: "0 18px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.55)", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Annuler</button>
              <button type="button" onClick={openMailto} disabled={noEmails}
                style={{ height: 40, padding: "0 16px", borderRadius: 999, border: `1px solid rgba(255,255,255,0.14)`, background: "rgba(255,255,255,0.05)", color: noEmails ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.65)", fontWeight: 700, cursor: noEmails ? "not-allowed" : "pointer", fontSize: 13 }}>
                ✉ Ma messagerie
              </button>
              {resendApiKey ? (
                <button type="button" onClick={sendViaResend} disabled={noEmails || sending}
                  style={{ height: 40, padding: "0 20px", borderRadius: 999, border: `1px solid ${noEmails || sending ? "rgba(255,255,255,0.10)" : hexAlpha(accentColor,0.50)}`, background: noEmails || sending ? "rgba(255,255,255,0.03)" : hexAlpha(accentColor,0.18), color: noEmails || sending ? "rgba(255,255,255,0.28)" : "#fff", fontWeight: 800, cursor: noEmails || sending ? "not-allowed" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  {sending ? "Envoi…" : `🚀 Envoyer (${validEmails.length})`}
                </button>
              ) : (
                <button type="button" disabled
                  style={{ height: 40, padding: "0 20px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)", fontWeight: 800, cursor: "not-allowed", fontSize: 13 }}>
                  🚀 Envoyer
                </button>
              )}
            </div>
          </div>
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
function RelancesPageInner() {
  const { activeWorkspace } = useWorkspace();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const searchParams = useSearchParams();
  const autoOpenComposerDone = useRef(false);
  const [activeSegment, setActiveSegment] = useState<Segment | "all">("all");
  const [notifClientNames, setNotifClientNames] = useState<string[]>([]);
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
  const [resendApiKey, setResendApiKey] = useState("");

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { fetchAll(); }, [activeWorkspace?.id]);

  async function fetchAll() {
    setLoading(true); setErrorMsg("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { window.location.href = "/login"; return; }
      if (!activeWorkspace) { setClients([]); setSales([]); setLoading(false); return; }
      const [{ data: cData, error: cErr }, { data: sData, error: sErr }, { data: wsData }] = await Promise.all([
        supabase.from("clients").select("id,email,prenom,nom,created_at,status_override").eq("workspace_id", activeWorkspace.id).limit(2000),
        supabase.from("sales").select("id,client_id,amount,created_at").eq("workspace_id", activeWorkspace.id).order("created_at", { ascending: false }).limit(10000),
        supabase.from("workspaces").select("resend_api_key").eq("id", activeWorkspace.id).single(),
      ]);
      if (cErr) throw cErr; if (sErr) throw sErr;
      setClients((cData ?? []) as ClientRow[]);
      setSales((sData ?? []) as SaleRow[]);
      setResendApiKey(wsData?.resend_api_key ?? "");
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

  // Auto-open email composer from notification deep-link
  useEffect(() => {
    if (autoOpenComposerDone.current || !clientStats.length) return;
    const segParam = searchParams.get("segment");
    const openComposer = searchParams.get("openComposer");
    if (!segParam || !openComposer) return;
    autoOpenComposerDone.current = true;
    const SEG_MAP: Record<string, Segment> = { "30": "regulier", "60": "inactif", "90": "inactif", "180": "inactif" };
    const segKey = SEG_MAP[segParam];
    if (segKey) {
      setActiveSegment(segKey);
      const clientsParam = searchParams.get("clients");
      if (clientsParam) {
        const names = clientsParam.split(",").map(s => s.trim()).filter(Boolean);
        if (names.length > 0) setNotifClientNames(names);
      }
      setEmailModalOpen(true);
    }
  }, [clientStats]);

  const filtered = useMemo(() => {
    let list = activeSegment === "all" ? clientStats : clientStats.filter(c => c.segment === activeSegment);
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      list = list.filter(c => `${c.client.prenom ?? ""} ${c.client.nom ?? ""} ${c.client.email ?? ""}`.toLowerCase().includes(q));
    }
    if (notifClientNames.length > 0) {
      list = list.filter(c => {
        const fullName = `${c.client.prenom ?? ""} ${c.client.nom ?? ""}`.trim().toLowerCase();
        return notifClientNames.some(n => n.toLowerCase() === fullName);
      });
    }
    return list.sort((a, b) => b.caTotal - a.caTotal);
  }, [clientStats, activeSegment, searchQ, notifClientNames]);

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
          shopName={activeWorkspace.name}
          resendApiKey={resendApiKey}
          workspaceId={activeWorkspace.id}
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
export default function RelancesPage() {
  return (
    <Suspense fallback={null}>
      <RelancesPageInner />
    </Suspense>
  );
}
