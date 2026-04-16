// File: src/app/layout.tsx
/**
 * Root Layout — Next.js App Router Layout
 * Defines the top-level HTML structure, global metadata, and CSS imports.
 * All pages render inside this layout's <body> element.
 * (Why: Next.js App Router requires a root layout that wraps every page)
 */

import type { Metadata } from 'next';
import './globals.css';

// App-wide metadata used by Next.js for <head> tags (title, description)
// (Why: sets the browser tab title and SEO description for all pages)
export const metadata: Metadata = {
  title: 'NeuroDesk AI',
  description: 'AI-powered development assistant',
};

// Root layout component that wraps all pages
// @param children - The active page component rendered by Next.js routing
// @returns The full HTML document shell with global styles applied
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Full-height flex container prevents page scroll and enables sidebar + chat layout */}
      <body className="h-screen flex overflow-hidden">
        {children}
      </body>
    </html>
  );
}
