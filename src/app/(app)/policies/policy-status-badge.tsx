import { Badge } from "@/components/ui/badge";

/** "Up to date" (every shown rate is set) or "No policy yet" (one is missing). Text as well as colour. */
export function PolicyStatusBadge({ status }: { status: "none" | "ok" }) {
  return (
    <span className="whitespace-nowrap">
      {status === "ok" ? (
        <Badge variant="approved">Up to date</Badge>
      ) : (
        <Badge variant="pending">No policy yet</Badge>
      )}
    </span>
  );
}
