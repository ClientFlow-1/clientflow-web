import Link from "next/link";

export const metadata = { title: "Mentions légales — ClientFlow" };

export default function MentionsLegales() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "rgba(255,255,255,0.85)", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        .legal-a { color:rgba(99,120,255,0.9); text-decoration:none; }
        .legal-a:hover { text-decoration:underline; }
        .legal-h2 { font-size:18px; font-weight:700; color:rgba(255,255,255,0.95); margin:40px 0 12px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.07); }
        .legal-p  { font-size:15px; color:rgba(255,255,255,0.65); line-height:1.8; margin-bottom:12px; }
        .legal-section { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:24px 28px; margin-bottom:16px; }
      `}</style>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 1140, margin: "0 auto" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#6378ff,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", fontFamily: "'DM Mono',monospace" }}>CF</div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600, fontSize: 12, letterSpacing: 2, color: "rgba(255,255,255,0.85)" }}>CLIENTFLOW</span>
        </Link>
        <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none", fontWeight: 500 }}>← Retour</Link>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 96px" }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.25)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "rgba(160,180,255,0.9)", marginBottom: 20, fontFamily: "'DM Mono',monospace" }}>LÉGAL</div>
          <h1 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 900, letterSpacing: "-0.5px", color: "rgba(255,255,255,0.97)", marginBottom: 12 }}>Mentions légales</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>Dernière mise à jour : mars 2026</p>
        </div>

        <h2 className="legal-h2">1. Éditeur du site</h2>
        <div className="legal-section">
          <p className="legal-p" style={{ margin: 0 }}>
            Le site <strong style={{ color: "rgba(255,255,255,0.85)" }}>clientflow.fr</strong> est édité par :<br /><br />
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>[NOM]</strong>, micro-entrepreneur<br />
            SIRET : <strong style={{ color: "rgba(255,255,255,0.85)" }}>[SIRET]</strong><br />
            Adresse : <strong style={{ color: "rgba(255,255,255,0.85)" }}>[ADRESSE]</strong><br />
            Email : <a href="mailto:client.flow@outlook.com" className="legal-a">client.flow@outlook.com</a>
          </p>
        </div>

        <h2 className="legal-h2">2. Hébergeur</h2>
        <div className="legal-section">
          <p className="legal-p" style={{ margin: 0 }}>
            Le site est hébergé par :<br /><br />
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>Vercel Inc.</strong><br />
            340 Pine Street, Suite 1500<br />
            San Francisco, CA 94104, États-Unis<br />
            <a href="https://vercel.com" className="legal-a" target="_blank" rel="noreferrer">vercel.com</a>
          </p>
        </div>

        <h2 className="legal-h2">3. Propriété intellectuelle</h2>
        <p className="legal-p">
          L'ensemble du contenu de la plateforme ClientFlow — textes, graphismes, logotypes, icônes, interface, code source — est la propriété exclusive de l'éditeur et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
        </p>
        <p className="legal-p">
          Toute reproduction, distribution, modification ou exploitation, totale ou partielle, sans autorisation écrite préalable est strictement interdite.
        </p>

        <h2 className="legal-h2">4. Conditions tarifaires et non-remboursabilité</h2>
        <p className="legal-p">
          L'accès à la plateforme ClientFlow est soumis au paiement de frais d'installation uniques (450 € ou 600 € selon l'offre choisie) ainsi qu'un abonnement mensuel de 20 €.
        </p>
        <p className="legal-p">
          <strong style={{ color: "rgba(255,255,255,0.85)" }}>Les frais d'installation sont non remboursables dès activation du compte client.</strong> En procédant au paiement et en activant son accès, l'utilisateur reconnaît expressément avoir renoncé à son droit de rétractation conformément à l'article L221-28 du Code de la consommation, le service étant pleinement exécuté avec son accord préalable.
        </p>
        <p className="legal-p">
          L'abonnement mensuel peut être résilié à tout moment, sans préavis ni pénalité. Aucun remboursement ne sera effectué pour le mois en cours au moment de la résiliation.
        </p>

        <h2 className="legal-h2">5. Responsabilité</h2>
        <p className="legal-p">
          L'éditeur s'efforce de maintenir la plateforme accessible en continu mais ne peut garantir une disponibilité permanente. Il ne saurait être tenu responsable des interruptions de service liées à des opérations de maintenance, à des défaillances de l'hébergeur ou à tout événement indépendant de sa volonté.
        </p>

        <h2 className="legal-h2">6. Droit applicable</h2>
        <p className="legal-p">
          Le présent site est soumis au droit français. Tout litige relatif à son utilisation sera soumis aux tribunaux compétents français.
        </p>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "28px 24px", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
          <Link href="/legal/mentions-legales" style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Mentions légales</Link>
          <Link href="/legal/cgv" style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>CGV</Link>
          <Link href="/legal/politique-confidentialite" style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>Politique de confidentialité</Link>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.20)", margin: 0 }}>© 2026 ClientFlow — Tous droits réservés</p>
      </footer>
    </div>
  );
}
