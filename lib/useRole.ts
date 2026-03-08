import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useWorkspace } from "./workspaceContext";

export type Role = "owner" | "admin" | "vendeur" | null;

export function useRole() {
  const { activeWorkspace } = useWorkspace();
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) { setRole(null); setLoading(false); return; }
    fetchRole();
  }, [activeWorkspace?.id]);

  async function fetchRole() {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { setRole(null); setLoading(false); return; }

      const { data, error } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", activeWorkspace!.id)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (error || !data) {
        // Fallback : si pas de membre trouvé, vérifie si c'est le owner du workspace
        const { data: ws } = await supabase
          .from("workspaces")
          .select("user_id")
          .eq("id", activeWorkspace!.id)
          .single();
        setRole(ws?.user_id === user.id ? "owner" : null);
      } else {
        setRole(data.role as Role);
      }
    } catch { setRole(null); }
    finally { setLoading(false); }
  }

  const isOwner   = role === "owner";
  const isAdmin   = role === "admin" || role === "owner";
  const isVendeur = role === "vendeur";

  // Permissions
  const can = {
    deleteClients:    isAdmin,
    editSales:        isAdmin,
    deleteSales:      isAdmin,
    viewRelances:     isAdmin,
    viewProduits:     isAdmin,
    manageMembers:    isOwner,
    manageWorkspaces: isOwner,
  };

  return { role, loading, can, isOwner, isAdmin, isVendeur };
}