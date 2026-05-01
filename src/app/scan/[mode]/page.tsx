import { AppShell } from "@/components/AppShell";
import { ScanFlow } from "@/components/ScanFlow";
import { getPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function ScanPage({ params }: { params: Promise<{ mode: string }> }) {
  const user = await getPageUser();
  const { mode } = await params;
  return (
    <AppShell user={user}>
      <ScanFlow mode={mode} user={user} />
    </AppShell>
  );
}
