import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NeuroDesk AI',
  description: 'AI-powered development assistant',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen flex overflow-hidden">
        {children}
      </body>
    </html>
  );
}
