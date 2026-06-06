import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restaurant Feedback",
  description: "Share your experience and help us serve you better.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans bg-neutral-950 text-white min-h-screen selection:bg-emerald-500/30 antialiased">
        {children}
      </body>
    </html>
  );
}
