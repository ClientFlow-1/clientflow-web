import Link from "next/link";

export const metadata = { title: "Politique de confidentialité — ClientFlow" };

export default function PolitiqueConfidentialite() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "rgba(255,255,255,0.85)", fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        .legal-a { color:rgba(99,120,255,0.9); text-decoration:none; }
        .legal-a:hover { text-decoration:underline; }
        .legal-h2 { font-size:18px; font-weight:700; color:rgba(255,255,255,0.95); margin:40px 0 12px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.07); }
        .legal-p  { font-size:15px; color:rgba(255,255,255,0.65); line-height:1.8; margin-bottom:12px; }
        .legal-section { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:24px 28px; margin-bottom:16px; }
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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(99,120,255,0.12)", border: "1px solid rgba(99,120,255,0.25)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "rgba(160,180,255,0.9)", marginBottom: 20, fontFamily: "'DM Mono',monospace" }}>RGPD</div>
          <h1 style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 900, letterSpacing: "-0.5px", color: "rgba(255,255,255,0.97)", marginBottom: 12 }}>Politique de confidentialité</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", fontWeight: 500 }}>Dernière mise à jour : mars 2026</p>
        </div>

        <p className="legal-p">
          ClientFlow s'engage à protéger la vie privée de ses utilisateurs. Cette politique décrit quelles données sont collectées, comment elles sont utilisées et quels sont vos droits conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679).
        </p>

        <h2 className="legal-h2">1. Responsable du traitement</h2>
        <div className="legal-section">
          <p className="legal-p" style={{ margin: 0 }}>
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>[NOM]</strong>, micro-entrepreneur<br />
            Email : <a href="mailto:client.flow@outlook.com" className="legal-a">client.flow@outlook.com</a>
          </p>
        </div>

        <h2 className="legal-h2">2. Données collectées</h2>
        <p className="legal-p">Nous collectons uniquement les données nécessaires à la fourniture du service :</p>
        <div className="legal-section">
          <ul className="legal-ul">
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Données d'identification</strong> : nom, prénom, adresse email</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Données de compte</strong> : mot de passe (hashé, jamais stocké en clair)</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Données d'utilisation</strong> : actions effectuées dans la plateforme (clients créés, ventes enregistrées, relances envoyées)</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Données de paiement</strong> : traitées exclusivement par Stripe — ClientFlow ne stocke aucune donnée bancaire</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Données des clients finaux</strong> : les informations que vous saisissez dans votre CRM (vos propres clients) sont stockées sous votre responsabilité en tant que responsable de traitement secondaire</li>
          </ul>
        </div>

        <h2 className="legal-h2">3. Finalités du traitement</h2>
        <p className="legal-p">Vos données sont traitées pour les finalités suivantes :</p>
        <div className="legal-section">
          <ul className="legal-ul">
            <li>Fourniture et gestion du service CRM ClientFlow</li>
            <li>Authentification et sécurité de votre compte</li>
            <li>Facturation et gestion de l'abonnement</li>
            <li>Support client et réponse à vos demandes</li>
            <li>Amélioration du service (données agrégées et anonymisées)</li>
          </ul>
        </div>

        <h2 className="legal-h2">4. Base légale</h2>
        <p className="legal-p">
          Les traitements reposent sur <strong style={{ color: "rgba(255,255,255,0.8)" }}>l'exécution du contrat</strong> (art. 6.1.b RGPD) pour la fourniture du service, et sur notre <strong style={{ color: "rgba(255,255,255,0.8)" }}>intérêt légitime</strong> (art. 6.1.f) pour la sécurité et l'amélioration du service.
        </p>

        <h2 className="legal-h2">5. Hébergement et sous-traitants</h2>
        <div className="legal-section">
          <p className="legal-p" style={{ marginBottom: 16 }}>
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>Supabase</strong> (base de données)<br />
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Données hébergées dans l'Union Européenne (région Frankfurt, eu-central-1). Conforme au RGPD.</span>
          </p>
          <p className="legal-p" style={{ marginBottom: 16 }}>
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>Vercel Inc.</strong> (hébergement de l'application)<br />
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Vercel est un prestataire américain encadré par des garanties appropriées (Data Processing Agreement conforme au RGPD, clauses contractuelles types). <a href="https://vercel.com/legal/privacy-policy" className="legal-a" target="_blank" rel="noreferrer">Privacy Policy Vercel</a></span>
          </p>
          <p className="legal-p" style={{ margin: 0 }}>
            <strong style={{ color: "rgba(255,255,255,0.85)" }}>Stripe</strong> (paiement)<br />
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Traitement des paiements conforme PCI-DSS. ClientFlow n'a accès à aucune donnée bancaire.</span>
          </p>
        </div>

        <h2 className="legal-h2">6. Durée de conservation</h2>
        <p className="legal-p">
          Vos données sont conservées pendant toute la durée de votre abonnement actif, puis <strong style={{ color: "rgba(255,255,255,0.8)" }}>supprimées dans un délai de 30 jours</strong> suivant la résiliation de votre compte, sauf obligation légale de conservation plus longue (données comptables : 10 ans).
        </p>

        <h2 className="legal-h2">7. Vos droits RGPD</h2>
        <p className="legal-p">Conformément au RGPD, vous disposez des droits suivants :</p>
        <div className="legal-section">
          <ul className="legal-ul">
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Droit de rectification</strong> : corriger des données inexactes</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Droit à l'effacement</strong> : demander la suppression de vos données</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
            <li><strong style={{ color: "rgba(255,255,255,0.8)" }}>Droit d'opposition</strong> : vous opposer à certains traitements</li>
          </ul>
          <p className="legal-p" style={{ margin: 0, marginTop: 12 }}>
            Pour exercer vos droits, contactez-nous à : <a href="mailto:client.flow@outlook.com" className="legal-a">client.flow@outlook.com</a>. Réponse sous 30 jours maximum. En cas de litige, vous pouvez saisir la <a href="https://www.cnil.fr" className="legal-a" target="_blank" rel="noreferrer">CNIL</a>.
          </p>
        </div>

        <h2 className="legal-h2">8. Partage des données</h2>
        <p className="legal-p">
          <strong style={{ color: "rgba(255,255,255,0.85)" }}>Nous ne vendons, ne louons et ne partageons jamais vos données personnelles avec des tiers</strong> à des fins commerciales. Le partage est strictement limité aux sous-traitants techniques listés ci-dessus, dans le cadre de la fourniture du service.
        </p>

        <h2 className="legal-h2">9. Cookies</h2>
        <p className="legal-p">
          ClientFlow utilise uniquement des <strong style={{ color: "rgba(255,255,255,0.8)" }}>cookies techniques strictement nécessaires</strong> au fonctionnement du service (session d'authentification, préférences de l'espace de travail actif). Aucun cookie publicitaire, aucun tracker tiers, aucune régie publicitaire.
        </p>

        <h2 className="legal-h2">10. Modifications</h2>
        <p className="legal-p">
          Cette politique peut être mise à jour pour refléter des évolutions légales ou techniques. La date de dernière mise à jour est indiquée en haut de cette page. En cas de modification substantielle, les utilisateurs seront informés par email.
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
