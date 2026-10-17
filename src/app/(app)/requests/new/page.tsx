import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingRegion } from "@/components/ui/skeleton";
import { requireSession } from "@/lib/auth/guards";
import { RequestFormSection } from "./request-form-section";
import { RequestFormSkeleton } from "./request-form-skeleton";

export const metadata: Metadata = { title: "Request leave" };
export const dynamic = "force-dynamic";

/** US-01. The session user is the requester; the form never sends a user id. */
export default async function NewRequestPage() {
  const { user } = await requireSession();

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Request leave"
        description="Submit a request for your manager to review."
      />
      <div className="max-w-xl">
        <Card>
          <Suspense
            fallback={
              <LoadingRegion>
                <RequestFormSkeleton />
              </LoadingRegion>
            }
          >
            <RequestFormSection userId={user.id} />
          </Suspense>
        </Card>
      </div>
    </div>
  );
}
