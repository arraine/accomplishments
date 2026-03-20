import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import AccountMenu from "./components/account-menu";
import ThemeSwitcher from "./components/theme-switcher";
import { StoreProvider } from "./lib/store-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accomplishments Assistant",
  description: "Track daily accomplishments against goals and competencies."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <header className="site-header">
            <div className="site-header-inner">
              <Link href="/" className="brand-mark">
                Accomplishments Assistant
              </Link>
              <nav className="top-nav" aria-label="Primary">
                <Link href="/">Home</Link>
                <Link href="/goals">Goals</Link>
                <Link href="/competencies">Competencies</Link>
                <Link href="/summary">Summary</Link>
              </nav>
              <div className="header-controls">
                <ThemeSwitcher />
                <AccountMenu />
              </div>
            </div>
          </header>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
