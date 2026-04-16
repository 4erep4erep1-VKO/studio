import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  title: 'Монтажка ПРО v 3.0',
  description: 'Система управления заказами',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}