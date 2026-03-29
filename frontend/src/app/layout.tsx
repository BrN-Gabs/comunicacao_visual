import type { Metadata } from "next";
import { RouteTransitionProvider } from "@/components/transition/route-transition-provider";
import { ThemeController } from "@/components/theme/theme-controller";
import "./globals.css";

const themeInitScript = `
  (() => {
    try {
      const themeKey = "gazin-theme-mode";
      const storedTheme = window.localStorage.getItem(themeKey);
      const preferredTheme =
        storedTheme === "dark" || storedTheme === "light"
          ? storedTheme
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

      document.documentElement.dataset.theme = preferredTheme;
      document.documentElement.style.colorScheme = preferredTheme;
    } catch {}
  })();
`;

export const metadata: Metadata = {
  title: "Gazin Comunicações Visuais",
  description: "Sistema de automação de comunicações visuais Gazin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeController>
          <RouteTransitionProvider>{children}</RouteTransitionProvider>
        </ThemeController>
      </body>
    </html>
  );
}
