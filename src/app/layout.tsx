import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/components/providers/AppProvider';

const plexTh = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-plex-th', display: 'swap' });
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ICT Service Desk — NISSEI TRADING (THAILAND)', template: '%s · ICT Service Desk' },
  description: 'ระบบแจ้งซ่อม / ขอใช้บริการ ICT — NISSEI TRADING (THAILAND) CO., LTD.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1e90e8' };

/** กันแฟลชของธีม: ตั้ง class "dark" ก่อน React hydrate */
const themeInit = `try{var t=localStorage.getItem('ict-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plexTh.variable} ${plex.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
