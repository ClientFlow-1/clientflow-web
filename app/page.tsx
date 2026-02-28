// app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  created_at: string;
  email: string | null;
  is_active: boolean | null;
};

function formatDateFR(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export default async function Home() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, created_at, email, is_active")
    .order("created_at", { ascending: false });

  const profiles: Profile[] = (data ?? []) as Profile[];

  const total = profiles.length;
  const actifs = profiles.filter((p) => p.is_active === true).length;
  const inactifs = total - actifs;

  // Bandeau “système”
  const systemLabel = error
    ? `Supabase: ERREUR (${error.code ?? "unknown"})`
    : "Supabase: OK (lecture profils)";
  const systemSub = error ? error.message : "RLS/SELECT: autorisé";

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1 className="title">Dashboard</h1>
          <div className="subtitle">Vue rapide des profils (Supabase)</div>
        </div>

        <div className="pill">
          <span className={`dot ${error ? "dotRed" : "dotGreen"}`} />
          {error ? "Déconnecté" : "Connecté"}
        </div>
      </div>

      <div className="stats">
        <div className="statCard">
          <div className="statLabel">Total profils</div>
          <div className="statValue">{total}</div>
        </div>
        <div className="statCard">
          <div className="statLabel">Actifs</div>
          <div className="statValue">{actifs}</div>
        </div>
        <div className="statCard">
          <div className="statLabel">Inactifs</div>
          <div className="statValue">{inactifs}</div>
        </div>
      </div>

      <div className="tableCard">
        <div className="tableHead" style={{ display: "grid", gap: 10 }}>
          <div>
            <h2 className="tableTitle">Profils</h2>
            <div className="tableSub">Contrôle rapide avant import / usage</div>
          </div>

          <div
            className="pill"
            style={{
              justifyContent: "space-between",
              width: "fit-content",
              maxWidth: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className={`dot ${error ? "dotRed" : "dotGreen"}`} />
              <div style={{ display: "grid", lineHeight: 1.2 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {systemLabel}
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  {systemSub}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Statut</th>
                <th>Créé le</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const shortId =
                  p.id && p.id.length > 12 ? `${p.id.slice(0, 8)}…${p.id.slice(-4)}` : p.id;

                const isActive = p.is_active === true;

                return (
                  <tr key={p.id}>
                    <td className="mono">{shortId}</td>
                    <td>{p.email ?? <span className="muted">—</span>}</td>
                    <td>
                      <span
                        className={[
                          "badge",
                          isActive ? "badgeGreen" : "badgeGray",
                        ].join(" ")}
                      >
                        {isActive ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td>{formatDateFR(p.created_at)}</td>
                  </tr>
                );
              })}

              {!profiles.length && (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: "18px 20px" }}>
                    Aucun profil trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}