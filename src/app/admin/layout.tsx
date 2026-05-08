import { redirect } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { AppShell } from "@/components/AppShell";
import { getPageUser } from "@/lib/page-auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getPageUser();
  if (!hasPermission(user, "admin:access")) {
    redirect("/");
  }

  return (
    <AppShell user={user}>
      <section className="screen">
        <div className="screen-header">
          <div>
            <p className="eyebrow">Adminbereich</p>
            <h1>Verwaltung</h1>
          </div>
        </div>
        <AdminNav />
        {children}
      </section>
    </AppShell>
  );
}
