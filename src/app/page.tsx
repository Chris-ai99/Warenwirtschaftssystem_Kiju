import { AppShell } from "@/components/AppShell";
import { ModeGrid } from "@/components/ModeGrid";
import { getPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getPageUser();
  return (
    <AppShell user={user}>
      <ModeGrid user={user} />
    </AppShell>
  );
}
