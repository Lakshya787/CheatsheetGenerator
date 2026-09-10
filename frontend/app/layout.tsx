import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cheatsheet-generator-eight.vercel.app"),
  title: "CheatSheet.ai — Paste a doc, get a cheat sheet",
  description:
    "Paste any documentation URL and get a structured, downloadable cheat sheet in seconds. Powered by AI.",
  icons: {
    icon: "/cheaticon.png",
    apple: "/cheaticon.png",
  },
  openGraph: {
    title: "CheatSheet.ai — Paste a doc, get a cheat sheet",
    description:
      "Paste any documentation URL and get a structured, downloadable cheat sheet in seconds. Powered by AI.",
    url: "https://cheatsheet-generator-eight.vercel.app",
    siteName: "CheatSheet.ai",
    images: [
      {
        url: "/cheaticon.png",
        width: 512,
        height: 512,
        alt: "CheatSheet.ai Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CheatSheet.ai — Paste a doc, get a cheat sheet",
    description:
      "Paste any documentation URL and get a structured, downloadable cheat sheet in seconds. Powered by AI.",
    images: ["/cheaticon.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Roboto — Material You canonical typeface */}
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
