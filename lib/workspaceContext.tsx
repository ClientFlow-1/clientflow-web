"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";

export type Workspace = { id: string; name: string; };

type WorkspaceCtx = {
  workspaces: Workspace[];
  allWorkspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (w: Workspace) => void;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  deleteWorkspace: (id: string, transferToId: string | null) => Promise<boolean>;
  renameWorkspace: (id: string, newName: string) => Promise<boolean>;
  loading: boolean;
};

const Ctx = createContext<WorkspaceCtx>({
  workspaces: [], allWorkspaces: [], activeWorkspace: null,
  setActiveWorkspace: () => {}, createWorkspace: async () => null,
  deleteWorkspace: async () => false, renameWorkspace: async () => false, loading: true,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) { setLoading(false); return; }
      const userId = auth.user.id;

      // 1. Toutes les boutiques que l'user possède (owner via workspaces.user_id)
      const { data: ownedData } = await supabase
        .from("workspaces")
        .select("id,name")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      const owned = (ownedData ?? []) as Workspace[];

      // 2. Boutiques accessibles via membership (admin/vendeur)
      // On récupère les member_ids de cet user
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("id,workspace_id,role")
        .eq("user_id", userId)
        .eq("status", "active");

      let memberWorkspaces: Workspace[] = [];
      if (memberData && memberData.length > 0) {
        // Pour chaque membership, on regarde les boutiques assignées via member_workspace_access
        const memberIds = memberData.map((m: any) => m.id);
        const { data: accessData } = await supabase
          .from("member_workspace_access")
          .select("workspace_id")
          .in("member_id", memberIds);

        const assignedWsIds = [...new Set((accessData ?? []).map((a: any) => a.workspace_id))];

        if (assignedWsIds.length > 0) {
          const { data: assignedWs } = await supabase
            .from("workspaces")
            .select("id,name")
            .in("id", assignedWsIds)
            .order("created_at", { ascending: true });
          memberWorkspaces = (assignedWs ?? []) as Workspace[];
        }
      }

      // 3. Toutes les boutiques de l'owner (pour la page Paramètres)
      // allWorkspaces = toutes les boutiques owned (pour que l'owner puisse les assigner)
      setAllWorkspaces(owned);

      // 4. workspaces = boutiques visibles dans le picker (owned + assignées)
      const merged = [...owned];
      memberWorkspaces.forEach(w => {
        if (!merged.find(o => o.id === w.id)) merged.push(w);
      });
      setWorkspaces(merged);

      // 5. Workspace actif
      const savedId = localStorage.getItem("activeWorkspaceId");
      const found = merged.find(w => w.id === savedId) ?? merged[0] ?? null;
      setActiveWorkspaceState(found);
      setLoading(false);
    })();
  }, []);

  function setActiveWorkspace(w: Workspace) {
    setActiveWorkspaceState(w);
    localStorage.setItem("activeWorkspaceId", w.id);
  }

  async function createWorkspace(name: string): Promise<Workspace | null> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return null;
    const { data, error } = await supabase
      .from("workspaces")
      .insert({ user_id: auth.user.id, name: name.trim() })
      .select("id,name")
      .single();
    if (error || !data) return null;
    const w = data as Workspace;
    setWorkspaces(prev => [...prev, w]);
    setAllWorkspaces(prev => [...prev, w]);
    return w;
  }

  async function renameWorkspace(id: string, newName: string): Promise<boolean> {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    const { error } = await supabase.from("workspaces").update({ name: trimmed }).eq("id", id);
    if (error) return false;
    const updater = (prev: Workspace[]) => prev.map(w => w.id === id ? { ...w, name: trimmed } : w);
    setWorkspaces(updater);
    setAllWorkspaces(updater);
    if (activeWorkspace?.id === id) setActiveWorkspaceState(prev => prev ? { ...prev, name: trimmed } : prev);
    return true;
  }

  async function deleteWorkspace(id: string, transferToId: string | null): Promise<boolean> {
    try {
      if (transferToId) {
        const { error: e1 } = await supabase.from("clients").update({ workspace_id: transferToId }).eq("workspace_id", id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("sales").update({ workspace_id: transferToId }).eq("workspace_id", id);
        if (e2) throw e2;
      } else {
        const { error: e1 } = await supabase.from("sales").delete().eq("workspace_id", id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from("clients").delete().eq("workspace_id", id);
        if (e2) throw e2;
      }
      const { error: e3 } = await supabase.from("workspaces").delete().eq("id", id);
      if (e3) throw e3;

      const newList = workspaces.filter(w => w.id !== id);
      setWorkspaces(newList);
      setAllWorkspaces(prev => prev.filter(w => w.id !== id));

      if (activeWorkspace?.id === id) {
        const fallback = transferToId
          ? newList.find(w => w.id === transferToId) ?? newList[0] ?? null
          : newList[0] ?? null;
        setActiveWorkspaceState(fallback);
        if (fallback) localStorage.setItem("activeWorkspaceId", fallback.id);
        else localStorage.removeItem("activeWorkspaceId");
      }
      return true;
    } catch (e) {
      console.error("deleteWorkspace error", e);
      return false;
    }
  }

  return (
    <Ctx.Provider value={{ workspaces, allWorkspaces, activeWorkspace, setActiveWorkspace, createWorkspace, deleteWorkspace, renameWorkspace, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() { return useContext(Ctx); }