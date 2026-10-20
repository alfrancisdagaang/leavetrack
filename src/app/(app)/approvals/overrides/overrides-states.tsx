/** Nothing is waiting for HR. */
export function WaitingEmpty() {
  return <p className="text-ink-muted">No requests are waiting for an HR override.</p>;
}

/** HR has not overridden anything yet. */
export function OverriddenEmpty() {
  return <p className="text-ink-muted">No request has been overridden yet.</p>;
}
