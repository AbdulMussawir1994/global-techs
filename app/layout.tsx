import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Techs · People workspace",
  description: "A simple, organized home for your team. Manage employee profiles, departments, and employment details.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
