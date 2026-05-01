import { AppShell } from "@/components/AppShell";
import { ArticleForm } from "@/components/ArticleForm";
import { getPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  const user = await getPageUser();
  return (
    <AppShell user={user}>
      <section className="screen">
        <div className="screen-header">
          <div>
            <p className="eyebrow">Artikelverwaltung</p>
            <h1>Artikel anlegen</h1>
          </div>
        </div>
        <ArticleForm />
      </section>
    </AppShell>
  );
}
