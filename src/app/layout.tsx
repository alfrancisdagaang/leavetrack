import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "LeaveTrack", template: "%s · LeaveTrack" },
  description: "Self-service leave requests, scoped manager approval, and an auditable record.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Unstyled root layout — design system and UI shell are added when the design export lands. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
