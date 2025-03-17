import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "R2D2 - Cloudflare R2 Dashboard",
  description: "A modern dashboard for managing Cloudflare R2 buckets",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <header className="bg-[#21262D] border-b border-[rgba(240,246,252,0.1)]">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center">
              <div className="text-[#EF6351] font-semibold text-lg">R2D2</div>
              <span className="text-gray-400 mx-2">by</span>
              <div className="text-gray-300">exon</div>
            </div>
          </div>
        </header>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
