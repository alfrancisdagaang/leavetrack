import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { navItemsFor } from "@/components/ui/nav";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Dashboard" };

/** Post-login landing. One role-aware dashboard; each card becomes live as its task ships. */
export default async function DashboardPage() {
  const { user, role } = await requireSession();
  const cards = navItemsFor(role).filter((item) => item.key !== "dashboard");

  return (
    <>
      <PageHeader title="Dashboard" description={`Welcome, ${user.name}.`} />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((item) => (
          <Card key={item.key} title={item.label}>
            <p className="mb-3 text-grey-500">{item.description}</p>
            {item.available ? (
              <ButtonLink href={item.href} variant="secondary">
                Open
              </ButtonLink>
            ) : (
              <Badge>Coming soon</Badge>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
