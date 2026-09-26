import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/fira-code";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/space-mono/400.css";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/shell/Shell";
import { BOOT_SCRIPT } from "@/lib/boot-script";
import { clerkEnabled } from "@/server/env";

export const metadata: Metadata = {
  title: {
    default: "clack. — how fast are your thoughts?",
    template: "%s · clack.",
  },
  description:
    "A typing playground for fast thoughts. Deep analytics, a caret with personality, ten atmospheres, and zero sign-up to start.",
  applicationName: "clack.",
  openGraph: {
    title: "clack.",
    description: "How fast are your thoughts? A typing test that feels alive.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f10",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const app = (
    <Providers authEnabled={clerkEnabled}>
      <Shell>{children}</Shell>
    </Providers>
  );
  return (
    <html lang="en" data-theme="graphite" data-dark="true" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="grain antialiased">
        {/* Clerk is optional: without keys the app runs fully anonymous. */}
        {clerkEnabled ? (
          <ClerkProvider
            appearance={{
              variables: { colorPrimary: "#ff6b3d", borderRadius: "4px", fontFamily: "Geist Variable, system-ui, sans-serif" },
            }}
          >
            {app}
          </ClerkProvider>
        ) : (
          app
        )}
      </body>
    </html>
  );
}
