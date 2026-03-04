"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";

export type Workspace = { id: string; name: string; };

type WorkspaceCtx = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (w: Workspace) => void;
  createWorkspace: (name: string) => Promise<Workspace | null>;
  deleteWorkspace: (id: string, transferToId: string | null) => Promise<boolean>;
  renameWorkspace: (id: string, newName: string) => Promise<boolean>;
  loading: boolean;
};

const Ctx = createContext<WorkspaceCtx>({
  workspaces: [], activeWorkspace: null,
  setActiveWorkspace: () => {}, createWorkspace: async () => null,
  deleteWorkspace: async () => false, renameWorkspace: async () => false, loading: true,
});

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return;
      const { data } = await supabase
        .from("workspaces")
        .select("id,name")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: true });
      const list = (data ?? []) as Workspace[];
      setWorkspaces(list);
      const savedId = localStorage.getItem("activeWorkspaceId");
      const found = list.find(w => w.id === savedId) ?? list[0] ?? null;
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
    return w;
  }

  async function renameWorkspace(id: string, newName: string): Promise<boolean> {
    const trimmed = newName.trim();
    if (!trimmed) return false;
    const { error } = await supabase
      .from("workspaces")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) return false;
    setWorkspaces(prev => prev.map(w => w.id === id ? { ...w, name: trimmed } : w));
    if (activeWorkspace?.id === id) {
      setActiveWorkspaceState(prev => prev ? { ...prev, name: trimmed } : prev);
    }
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
      if (activeWorkspace?.id === id) {
        const fallback = transferToId ? newList.find(w => w.id === transferToId) ?? newList[0] ?? null : newList[0] ?? null;
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
    <Ctx.Provider value={{ workspaces, activeWorkspace, setActiveWorkspace, createWorkspace, deleteWorkspace, renameWorkspace, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace() { return useContext(Ctx); }