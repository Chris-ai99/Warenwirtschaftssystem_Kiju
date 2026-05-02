import { AppShell } from "@/components/AppShell";
import { ArticleForm } from "@/components/ArticleForm";
import { getPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getPageUser();
  const { id } = await params;
  return (
    <AppShell user={user}>
      <section className="screen">
        <div className="screen-header">
          <div>
            <p className="eyebrow">Artikel</p>
            <h1>Artikel bearbeiten</h1>
          </div>
        </div>
        <ArticleForm articleId={id} />
      </section>
    </AppShell>
  );
}
