import { AppShell } from "@/components/AppShell";
import { StockOverview } from "@/components/StockOverview";
import { getPageUser } from "@/lib/page-auth";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const user = await getPageUser();
  return (
    <AppShell user={user}>
      <StockOverview />
    </AppShell>
  );
}
