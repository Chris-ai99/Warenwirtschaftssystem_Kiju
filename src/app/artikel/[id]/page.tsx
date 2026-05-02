import { AppShell } from "@/components/AppShell";
import { ArticleDetail } from "@/components/ArticleDetail";
import { getPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getPageUser();
  const { id } = await params;
  return (
    <AppShell user={user}>
      <ArticleDetail id={id} user={user} />
    </AppShell>
  );
}
