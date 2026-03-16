import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { useWorkspace } from "./workspaceContext";

export type Role = "owner" | "admin" | "vendeur" | null;

export function useRole() {
  const { activeWorkspace } = useWorkspace();
  const [role, setRole] = useState<Role>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeWorkspace) { setRole(null); setLoading(false); return; }
    fetchRole();
  }, [activeWorkspace?.id]);

  // Subscription temps réel : détecte is_open changé par l'owner pendant la session
  useEffect(() => {
    if (!activeWorkspace?.id) return;
    const channel = supabase
      .channel(`workspace-open-${activeWorkspace.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "workspaces",
        filter: `id=eq.${activeWorkspace.id}`,
      }, (payload) => {
        if (typeof payload.new?.is_open === "boolean") {
          setIsOpen(payload.new.is_open);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeWorkspace?.id]);

  async function fetchRole() {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) { setRole(null); setLoading(false); return; }

      // Requête role membre + workspace en parallèle
      const [{ data: memberData }, { data: wsData }] = await Promise.all([
        supabase.from("workspace_members").select("role").eq("workspace_id", activeWorkspace!.id).eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabase.from("workspaces").select("user_id,is_open").eq("id", activeWorkspace!.id).maybeSingle(),
      ]);

      // is_open depuis la query directe si accessible (owner/admin avec RLS),
      // sinon depuis le contexte workspace (chargé via RPC SECURITY DEFINER, accessible aux vendeurs)
      const isOpenFromQuery  = wsData?.is_open;
      const isOpenFromCtx    = activeWorkspace!.is_open;
      const resolvedIsOpen   = isOpenFromQuery ?? isOpenFromCtx;
      setIsOpen(resolvedIsOpen !== false);

      if (!memberData) {
        setRole(wsData?.user_id === user.id ? "owner" : null);
      } else {
        setRole(memberData.role as Role);
      }
    } catch { setRole(null); }
    finally { setLoading(false); }
  }

  const isOwner   = role === "owner";
  const isAdmin   = role === "admin" || role === "owner";
  const isVendeur = role === "vendeur";
  const isBlocked = isVendeur && !isOpen;

  const can = {
    deleteClients:    isAdmin,
    editSales:        isAdmin,
    deleteSales:      isAdmin,
    viewRelances:     isAdmin || isVendeur,
    viewProduits:     isAdmin || isVendeur,
    viewAnalytiques:  isOwner,
    viewCA:           isOwner,
    toggleShop:       isAdmin,
    manageMembers:    isOwner,
    manageWorkspaces: isOwner,
  };

  return { role, loading, can, isOwner, isAdmin, isVendeur, isOpen, isBlocked };
}