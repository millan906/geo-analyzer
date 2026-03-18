import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GEO Analyzer — The Yoast SEO of the AI Era',
  description:
    'Optimize your content for AI-generated answers. Get a GEO Score and actionable recommendations to appear in ChatGPT, Perplexity, and Google AI Overviews.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
