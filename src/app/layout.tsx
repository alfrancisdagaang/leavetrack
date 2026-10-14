import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "leavetrack", template: "%s · leavetrack" },
  description: "Self-service leave requests, scoped manager approval, and an auditable record.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Root layout: global styles only. Signed-in chrome lives in the (app) route group's layout. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
