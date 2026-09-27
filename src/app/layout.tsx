import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource/quicksand/400.css";
import "@fontsource/quicksand/500.css";
import "@fontsource/quicksand/600.css";
import "@fontsource/quicksand/700.css";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

// Self-hosted as a plain npm package (resolved via the npm registry,
// which already works fine in every environment this has been built
// in) rather than next/font/google, which needs to reach
// fonts.googleapis.com *during the Docker build* to fetch the font —
// that specific host turned out to be unreachable from the VM's build
// environment even though npm install itself worked fine moments
// earlier. This has zero network dependency at build time, on any
// machine, ever: the font files ship inside the npm package itself.
//
// Unrelated to the above, but worth repeating: no manual <head>
// element here either way. A hand-authored <head> in the App
// Router's root layout is what broke mobile rendering earlier — Next
// manages <head> itself via the metadata/viewport exports below, and
// a second, manually-written <head> alongside that can cause those
// auto-generated tags — including the viewport meta tag — to be
// dropped or duplicated.

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
    <html lang="en">
      <body className="font-sans antialiased">
        {/* Runs before paint so a saved dark-mode preference never
            flashes light first. next/script's beforeInteractive
            strategy is what actually guarantees that timing here —
            see the comment in src/lib/theme.ts for why it can't be a
            useEffect instead. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        {/* Full-width edge-to-edge on an actual phone (this is a
            mobile-first app, and phone-width layouts — the keypad,
            the bottom nav — are deliberately fixed-feeling by design).
            On anything wider, it reads instead as an app window
            centered on its own background, rather than a narrow
            column stranded in a sea of empty space. */}
        <div className="min-h-screen bg-bg flex justify-center">
          <div className="w-full sm:max-w-[480px] sm:my-8 sm:rounded-3xl sm:shadow-xl sm:border sm:border-border sm:overflow-hidden min-h-screen sm:min-h-0 flex flex-col bg-bg">
            {children}
          </div>
        </div>
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
