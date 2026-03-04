"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Sale = {
  id: string;
  amount: number | null;
  client_id: string | null;
  created_at: string;
};

type Client = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
};

function formatEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [amount, setAmount] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);

    const [{ data: salesData }, { data: clientsData }] = await Promise.all([
      supabase.from("sales").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id,prenom,nom,email"),
    ]);

    setSales(salesData ?? []);
    setClients(clientsData ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function addSale() {
    if (!amount) return;

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    await supabase.from("sales").insert({
      amount: numericAmount,
      client_id: selectedClient || null,
    });

    setAmount("");
    setSelectedClient("");
    fetchData();
  }

  async function deleteSale(id: string) {
    await supabase.from("sales").delete().eq("id", id);
    fetchData();
  }

  const stats = useMemo(() => {
    const total = sales.reduce((acc, s) => acc + (s.amount ?? 0), 0);
    const clientTotal = sales
      .filter((s) => s.client_id)
      .reduce((acc, s) => acc + (s.amount ?? 0), 0);

    return {
      total,
      clientTotal,
      count: sales.length,
    };
  }, [sales]);

  return (
    <div className="ds-page">
      <div className="ds-topline">Dashboard / Sales</div>

      <h1 className="ds-title">Ventes</h1>

      {/* STATS */}
      <div className="ds-stats-grid">
        <div className="ds-stat-card">
          <div className="ds-stat-label">CA Total</div>
          <div className="ds-stat-value">{formatEUR(stats.total)}</div>
        </div>

        <div className="ds-stat-card">
          <div className="ds-stat-label">CA Clients</div>
          <div className="ds-stat-value">{formatEUR(stats.clientTotal)}</div>
        </div>

        <div className="ds-stat-card">
          <div className="ds-stat-label">Nombre de ventes</div>
          <div className="ds-stat-value">{stats.count}</div>
        </div>
      </div>

      {/* ADD SALE */}
      <div className="ds-card" style={{ marginTop: 30 }}>
        <div className="ds-card-title">Ajouter une vente</div>

        <div style={{ display: "flex", gap: 12, marginTop: 15 }}>
          <input
            className="ds-search-input"
            placeholder="Montant (€)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <select
            className="ds-search-input"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
          >
            <option value="">Sans client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom} ({c.email})
              </option>
            ))}
          </select>

          <button className="ds-btn" onClick={addSale}>
            Ajouter
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="ds-card" style={{ marginTop: 30 }}>
        <div className="ds-card-title">Historique</div>

        {loading ? (
          <div style={{ padding: 20 }}>Chargement...</div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Montant</th>
                <th>Client</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const client = clients.find((c) => c.id === s.client_id);
                return (
                  <tr key={s.id}>
                    <td>{new Date(s.created_at).toLocaleString()}</td>
                    <td>{formatEUR(s.amount ?? 0)}</td>
                    <td>
                      {client
                        ? `${client.prenom} ${client.nom}`
                        : "Sans client"}
                    </td>
                    <td>
                      <button
                        className="ds-btn ds-btn-danger-xs"
                        onClick={() => deleteSale(s.id)}
                      >
                        Suppr.
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}