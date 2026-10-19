import Image from "next/image";
import { Alert } from "@/components/ui/alert";
import type { ManagerOrg } from "@/lib/leave/org";
import {
  ChartShell,
  Connector,
  EmptyReports,
  ManagerAbove,
  ManagerAside,
  ReportsHeading,
} from "./org-parts";
import { PersonCard } from "./org-person";
import { buildTree, nestClass, type TreeNode } from "./org-tree-build";
import { cutNote, notShownLabel } from "./org-text";

function NotShown({ n }: { n: number }) {
  return <p className="mt-1 pl-3 text-sm text-ink-muted">{notShownLabel(n)}</p>;
}

function TreeList({ nodes, depth }: { nodes: TreeNode[]; depth: number }) {
  return (
    <ul className={`space-y-2 ${depth > 1 ? nestClass(depth) : ""}`}>
      {nodes.map((n) => (
        <li key={n.id}>
          <TreeItem node={n} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A person with people under them is a native `<details>` that starts closed: the whole card is the
 * summary, so it is keyboard usable (Enter and Space) and needs no client code. A person whose reports
 * were not loaded says so instead of looking like a dead end.
 */
function TreeItem({ node }: { node: TreeNode }) {
  if (node.children.length === 0) {
    return (
      <>
        <PersonCard node={node} />
        {node.hidden > 0 ? <NotShown n={node.hidden} /> : null}
      </>
    );
  }
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <PersonCard node={node} />
        </span>
        <Image
          src="/icons/chevron-down.svg"
          alt=""
          width={16}
          height={16}
          unoptimized
          className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-2">
        <TreeList nodes={node.children} depth={node.depth + 1} />
        {node.hidden > 0 ? <NotShown n={node.hidden} /> : null}
      </div>
    </details>
  );
}

/**
 * The manager's view: their own manager above, themselves highlighted and a tree of everyone under
 * them. Only the first level shows at first; each person with reports opens to show theirs. If the read
 * was cut at 200 people, a note says how many exist.
 */
export function ManagerChart({ org }: { org: ManagerOrg }) {
  const tree = buildTree(org.people, org.me.id);
  return (
    <ChartShell
      title="Your place in the organization"
      subtitle="See who you report to and who reports to you."
      aside={<ManagerAside manager={org.manager} />}
      wide
    >
      <ManagerAbove manager={org.manager} />
      <PersonCard node={org.me} you />
      <Connector />
      <ReportsHeading>People under you</ReportsHeading>
      {org.truncated ? (
        <div className="mb-3">
          <Alert variant="info">{cutNote(org.people.length, org.total)}</Alert>
        </div>
      ) : null}
      {tree.length === 0 ? <EmptyReports /> : <TreeList nodes={tree} depth={1} />}
    </ChartShell>
  );
}
