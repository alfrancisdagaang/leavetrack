import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth/guards";
import { getMySummary, requireDb } from "@/lib/leave/service";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Request leave" };
export const dynamic = "force-dynamic";

/** US-01. The session user is the requester; the form never sends a user id. */
export default async function NewRequestPage() {
  const { user } = await requireSession();
  const { balances } = await getMySummary(requireDb(), user.id);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Request leave"
        description="Submit a request for your manager to review."
      />
      <div className="max-w-xl">
        <Card>
          {balances.length === 0 ? (
            <Alert variant="error">No leave types are set up yet.</Alert>
          ) : (
            <RequestForm balances={balances} />
          )}
        </Card>
      </div>
    </div>
  );
}
