import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Autonomous AI Researcher | Evidence-Grounded Multi-Agent Engine',
  description:
    'Autonomous AI research platform powered by CrewAI, Gemini, and real-time evidence validation.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#07090e] text-gray-100 min-h-screen flex flex-col antialiased selection:bg-blue-500/30 selection:text-blue-200">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-500">
          Autonomous AI Researcher Platform • Next.js + FastAPI + Supabase + CrewAI
        </footer>
      </body>
    </html>
  );
}
