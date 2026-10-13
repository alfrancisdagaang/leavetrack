import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>
        <Link href="/dashboard">Go to the dashboard</Link>
      </p>
    </main>
  );
}
