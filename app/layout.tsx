import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'INFINITA', description: 'Uma campanha que nunca termina.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><head><link rel="preload" as="image" href="/assets/logo.png" /></head><body>{children}</body></html>;
}
