import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/layout/Navbar';
import { WorkspaceLayout } from '@/components/layout/WorkspaceLayout';

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
      <body className="bg-[#07090e] text-gray-100 min-h-screen antialiased selection:bg-blue-500/30 selection:text-blue-200">
        <WorkspaceLayout>
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
            {children}
          </main>
        </WorkspaceLayout>
      </body>
    </html>
  );
}
