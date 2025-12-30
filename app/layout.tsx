import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "n8n YouTube Automation Prompt",
  description:
    "Copy-ready prompt for generating a full n8n workflow that creates long-form AI videos and uploads them to YouTube."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
