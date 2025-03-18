import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import Image from "next/image";
import { auth } from "@/auth";
import { AuthHeader } from "@/components/AuthHeader";
// Load the OverusedGrotesk font family
const overusedGrotesk = localFont({
  src: [
    {
      path: './fonts/OverusedGrotesk-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: './fonts/OverusedGrotesk-Book.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/OverusedGrotesk-Roman.otf',
      weight: '450',
      style: 'normal',
    },
    {
      path: './fonts/OverusedGrotesk-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/OverusedGrotesk-SemiBold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/OverusedGrotesk-Bold.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './fonts/OverusedGrotesk-ExtraBold.otf',
      weight: '800',
      style: 'normal',
    },
    {
      path: './fonts/OverusedGrotesk-Black.otf',
      weight: '900',
      style: 'normal',
    },
  ],
  display: 'swap',
  variable: '--font-overused-grotesk',
});

export const metadata: Metadata = {
  title: "R2D2 - Cloudflare R2 Dashboard",
  description: "A modern dashboard for managing Cloudflare R2 buckets",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className={`${overusedGrotesk.variable}`}>
      <head>
        {/* <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        /> */}
      </head>
      <body className={overusedGrotesk.className}>
        <header className="bg-[#21262D] border-b border-[rgba(240,246,252,0.1)]">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-[#EF6351] font-semibold text-lg">Cloudflare R2D2</div>
              <div className="flex items-center space-x-4">
                
                <div className="flex items-center border-r border-[rgba(240,246,252,0.1)] pr-4">
                  <span className="text-gray-400 mx-2">designed by</span>
                  <Image src="https://0o4pg1fpby.ufs.sh/f/RSbfEU0J8Dcdm3yLbxdIVFOXRtqQKykJax2d8HCTMl4E0UrG" alt="exon" width={20} height={20} />
                  <div className="text-gray-300 ml-2">exon</div>
                </div>
                <AuthHeader session={session} />
              </div>
            </div>
          </div>
        </header>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
