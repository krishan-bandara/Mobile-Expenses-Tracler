import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

// next/font self-hosts the font at build time — no external stylesheet
// request, and (more importantly here) no manual <head> element needed
// just to load it. A hand-authored <head> in the App Router's root
// layout is the actual bug that was breaking mobile rendering: Next
// manages <head> itself via the metadata/viewport exports below, and a
// second, manually-written <head> alongside that can cause those
// auto-generated tags — including the viewport meta tag — to be
// dropped or duplicated. Without a working viewport tag, mobile
// browsers fall back to a wide desktop-style virtual viewport and
// zoom the whole page out to fit, which is exactly the "content
// squeezed into a narrow island with huge margins" symptom.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans"
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "A personal expense tracker for your phone and the web.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Expenses"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFEFFB" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1117" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="font-sans antialiased">
        {/* Runs before paint so a saved dark-mode preference never
            flashes light first. next/script's beforeInteractive
            strategy is what actually guarantees that timing here —
            see the comment in src/lib/theme.ts for why it can't be a
            useEffect instead. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <div className="max-w-[430px] mx-auto min-h-screen flex flex-col bg-bg">{children}</div>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

function ServiceWorkerRegister() {
  return (
    <Script id="sw-register" strategy="afterInteractive">
      {`
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        }
      `}
    </Script>
  );
}
