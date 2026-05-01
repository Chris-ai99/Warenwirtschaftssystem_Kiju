import { AppShell } from "@/components/AppShell";
import { MovementHistory } from "@/components/MovementHistory";
import { getPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
  const user = await getPageUser();
  return (
    <AppShell user={user}>
      <MovementHistory />
    </AppShell>
  );
}
