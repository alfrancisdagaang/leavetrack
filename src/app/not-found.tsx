import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-8">
      <Card>
        <h1 className="mb-4 text-xl font-semibold text-ink">Page not found</h1>
        <ButtonLink href="/dashboard">Go to the dashboard</ButtonLink>
      </Card>
    </main>
  );
}
