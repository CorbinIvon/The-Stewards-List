import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Stewards List",
  description: "A home organization app featuring user management, task management, and task tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
