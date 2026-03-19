import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/dashboard/:path*"],
};

export async function middleware(req: NextRequest) {
  // Active workspace is stored in localStorage on the client, but middleware
  // can only read cookies. The client must also set an "activeWorkspaceId"
  // cookie (e.g. in WorkspaceProvider) for this check to run.
  const activeWorkspaceId = req.cookies.get("activeWorkspaceId")?.value;

  if (!activeWorkspaceId) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.next();
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/workspaces?id=eq.${activeWorkspaceId}&select=subscription_status,subscription_ends_at`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    const [workspace] = await res.json();

    if (
      workspace &&
      workspace.subscription_status === "cancelled" &&
      workspace.subscription_ends_at &&
      new Date(workspace.subscription_ends_at) < new Date()
    ) {
      return NextResponse.redirect(new URL("/subscription-expired", req.url));
    }
  } catch {
    // On fetch error, let the request through rather than blocking the user
  }

  return NextResponse.next();
}
