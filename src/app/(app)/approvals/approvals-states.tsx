/** Nothing is waiting for the manager. */
export function PendingEmpty() {
  return <p className="text-ink-muted">No pending requests from your team.</p>;
}

/** Nothing has been decided for the team yet. */
export function DecidedEmpty() {
  return <p className="text-ink-muted">Nothing has been decided for your team yet.</p>;
}
