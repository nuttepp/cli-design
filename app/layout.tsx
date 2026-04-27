import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLI-D",
  description: "Design with CLI — prototype UIs using AI coding agents.",
};

const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    if (theme === "dark") document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="h-screen overflow-hidden">{children}</body>
    </html>
  );
}
