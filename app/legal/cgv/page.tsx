import Link from "next/link";

export const metadata = { title: "CGV — ClientFlow" };

export default function CGV() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "rgba(255,255,255,0.85)", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        .legal-a { color:rgba(99,120,255,0.9); text-decoration:none; }
        .legal-a:hover { text-decoration:underline; }
        .legal-h2 { font-size:18px; font-weight:700; color:rgba(255,255,255,0.95); margin:40px 0 12px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.07); }
        .legal-p  { font-size:15px; color:rgba(255,255,255,0.65); line-height:1.8; margin-bottom:12px; }
        .legal-section { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:24px 28px; margin-bottom:16px; }
        .legal-highlight { background:rgba(99,120,255,0.07); border:1px solid rgba(99,120,255,0.20); border-radius:12px; padding:20px 24px; margin-bottom:16px; }
        .legal-ul { padding-left:20px; margin:0 0 12px; }
        .legal-ul li { font-size:15px; color:rgba(255,255,255,0.65); line-height:1.8; margin-bottom:4px; }
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
          <h1 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 900, letterSpacing: "-0.5px", color: "rgba(255,255,255,0.97)", marginBottom: 12 }}>Conditions Générales de Vente</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>Dernière mise à jour : mars 2026</p>
        </div>

        <p className="legal-p">
          Les présentes Conditions Générales de Vente (CGV) régissent les relations entre <strong style={{ color: "rgba(255,255,255,0.85)" }}>[NOM]</strong>, micro-entrepreneur éditeur de ClientFlow (ci-après « le Prestataire »), et toute personne physique ou morale procédant à l'achat des services proposés (ci-après « le Client »).
        </p>
        <p className="legal-p">
          Toute commande implique l'acceptation pleine et entière des présentes CGV.
        </p>

        <h2 className="legal-h2">1. Description du service</h2>
        <p className="legal-p">
          ClientFlow est une plateforme SaaS (Software as a Service) de gestion de la relation client (CRM) destinée aux commerçants et boutiques physiques. Le service est accessible en ligne via un navigateur web.
        </p>
        <p className="legal-p">Les fonctionnalités incluent notamment : gestion des clients, suivi des ventes, relances email, gestion des stocks, analytiques, et système de rôles pour les équipes.</p>

        <h2 className="legal-h2">2. Tarifs</h2>
        <div className="legal-section">
          <p className="legal-p" style={{ marginBottom: 16 }}>
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>Offre CRM Solo</strong><br />
            Frais d'installation uniques : <strong style={{ color: "rgba(255,255,255,0.85)" }}>450 € TTC</strong><br />
            Abonnement mensuel : <strong style={{ color: "rgba(255,255,255,0.85)" }}>20 € TTC / mois</strong>
          </p>
          <p className="legal-p" style={{ margin: 0 }}>
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>Offre CRM + Site vitrine</strong><br />
            Frais d'installation uniques : <strong style={{ color: "rgba(255,255,255,0.85)" }}>600 € TTC</strong><br />
            Abonnement mensuel : <strong style={{ color: "rgba(255,255,255,0.85)" }}>20 € TTC / mois</strong>
          </p>
        </div>
        <p className="legal-p">
          Les prix sont indiqués en euros toutes taxes comprises. <strong style={{ color: "rgba(255,255,255,0.8)" }}>TVA non applicable — article 293B du Code général des impôts</strong> (micro-entreprise).
        </p>
        <p className="legal-p">
          Le Prestataire se réserve le droit de modifier ses tarifs à tout moment. Les modifications tarifaires sont notifiées aux clients actifs avec un préavis d'au moins 30 jours par email.
        </p>

        <h2 className="legal-h2">3. Commande et activation</h2>
        <p className="legal-p">
          La commande est effectuée en ligne via la plateforme. Le Client procède au paiement des frais d'installation via Stripe. L'accès à la plateforme est activé <strong style={{ color: "rgba(255,255,255,0.8)" }}>immédiatement après confirmation du paiement</strong>. Un email de confirmation est envoyé à l'adresse fournie lors de la commande.
        </p>

        <h2 className="legal-h2">4. Droit de rétractation</h2>
        <div className="legal-highlight">
          <p className="legal-p" style={{ margin: 0, color: "rgba(200,210,255,0.80)" }}>
            Conformément à l'<strong style={{ color: "rgba(200,210,255,0.95)" }}>article L221-28 du Code de la consommation</strong>, le droit de rétractation de 14 jours <strong style={{ color: "rgba(200,210,255,0.95)" }}>ne s'applique pas</strong> aux services pleinement exécutés avant la fin du délai de rétractation, lorsque l'exécution a commencé avec l'accord préalable exprès du consommateur et que celui-ci a renoncé à son droit de rétractation.
          </p>
          <p className="legal-p" style={{ margin: 0, marginTop: 12, color: "rgba(200,210,255,0.80)" }}>
            En procédant au paiement et en activant son accès à ClientFlow, le Client reconnaît expressément avoir demandé l'exécution immédiate du service et avoir renoncé à son droit de rétractation.
          </p>
        </div>

        <h2 className="legal-h2">5. Non-remboursabilité</h2>
        <div className="legal-section" style={{ borderColor: "rgba(255,100,100,0.15)" }}>
          <p className="legal-p" style={{ marginBottom: 12 }}>
            <strong style={{ color: "rgba(255,255,255,0.9)" }}>Frais d'installation :</strong> Les frais d'installation uniques (450 € ou 600 €) sont <strong style={{ color: "rgba(255,255,255,0.9)" }}>strictement non remboursables</strong> dès activation du compte, quelle que soit la durée d'utilisation effective.
          </p>
          <p className="legal-p" style={{ margin: 0 }}>
            <strong style={{ color: "rgba(255,255,255,0.9)" }}>Abonnement mensuel :</strong> L'abonnement mensuel peut être résilié à tout moment, sans préavis ni pénalité, directement depuis les paramètres du compte. <strong style={{ color: "rgba(255,255,255,0.9)" }}>Aucun remboursement ne sera effectué pour le mois en cours</strong> au moment de la résiliation ; l'accès reste actif jusqu'à la fin de la période mensuelle payée.
          </p>
        </div>

        <h2 className="legal-h2">6. Obligations du Prestataire</h2>
        <p className="legal-p">Le Prestataire s'engage à :</p>
        <div className="legal-section">
          <ul className="legal-ul">
            <li>Mettre à disposition la plateforme avec un objectif de disponibilité de 99 % (hors maintenance planifiée)</li>
            <li>Assurer la sécurité et la confidentialité des données conformément à la politique de confidentialité</li>
            <li>Fournir un support par email sous 24 heures ouvrées</li>
            <li>Notifier les maintenances planifiées avec un préavis raisonnable</li>
            <li>Livrer les mises à jour et améliorations de la plateforme sans surcoût</li>
          </ul>
        </div>

        <h2 className="legal-h2">7. Obligations du Client</h2>
        <p className="legal-p">Le Client s'engage à :</p>
        <div className="legal-section">
          <ul className="legal-ul">
            <li>Utiliser la plateforme conformément à sa destination et aux présentes CGV</li>
            <li>Ne pas tenter de contourner les mesures de sécurité ou d'accéder à des ressources non autorisées</li>
            <li>S'assurer de la légalité des données saisies dans le CRM (notamment les données personnelles de ses propres clients)</li>
            <li>Maintenir la confidentialité de ses identifiants de connexion</li>
          </ul>
        </div>

        <h2 className="legal-h2">8. Résiliation</h2>
        <p className="legal-p">
          Le Client peut résilier son abonnement mensuel à tout moment depuis les paramètres de son compte ou en contactant le Prestataire à <a href="mailto:client.flow@outlook.com" className="legal-a">client.flow@outlook.com</a>. La résiliation prend effet à la fin de la période mensuelle en cours.
        </p>
        <p className="legal-p">
          Le Prestataire se réserve le droit de suspendre ou de résilier l'accès d'un Client en cas de non-paiement, de violation des présentes CGV, ou d'utilisation abusive de la plateforme.
        </p>

        <h2 className="legal-h2">9. Responsabilité</h2>
        <p className="legal-p">
          La responsabilité du Prestataire est limitée au montant des sommes effectivement versées par le Client au cours des 3 derniers mois précédant le sinistre. Le Prestataire ne saurait être tenu responsable des préjudices indirects tels que perte de chiffre d'affaires, perte de données ou préjudice commercial.
        </p>

        <h2 className="legal-h2">10. Protection des données</h2>
        <p className="legal-p">
          Le traitement des données personnelles est régi par notre <Link href="/legal/politique-confidentialite" className="legal-a">Politique de confidentialité</Link>, conforme au RGPD.
        </p>

        <h2 className="legal-h2">11. Droit applicable et litiges</h2>
        <p className="legal-p">
          Les présentes CGV sont soumises au <strong style={{ color: "rgba(255,255,255,0.8)" }}>droit français</strong>. En cas de litige, les parties s'efforceront de trouver une solution amiable avant tout recours judiciaire. À défaut d'accord amiable, le litige sera porté devant le tribunal compétent du ressort de <strong style={{ color: "rgba(255,255,255,0.8)" }}>[VILLE]</strong>.
        </p>
        <p className="legal-p">
          Conformément à l'article L612-1 du Code de la consommation, le Client consommateur peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige.
        </p>

        <h2 className="legal-h2">12. Contact</h2>
        <p className="legal-p">
          Pour toute question relative aux présentes CGV : <a href="mailto:client.flow@outlook.com" className="legal-a">client.flow@outlook.com</a>
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
