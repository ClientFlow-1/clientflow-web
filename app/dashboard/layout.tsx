import DashboardShell from "../components/DashboardShell";
import { WorkspaceProvider } from "@/lib/workspaceContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <DashboardShell>{children}</DashboardShell>
    </WorkspaceProvider>
  );
}