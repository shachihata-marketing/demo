import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '名鉄音鉄サウンドスタンプラリー',
  description: '名鉄音鉄サウンドスタンプラリーアプリ',
  openGraph: {
    title: '名鉄瀬戸線開業120周年記念 音鉄サウンドスタンプラリー',
    description: '名鉄瀬戸線開業120周年を記念した音を集めるデジタルスタンプラリーです。',
    images: ['/images/logo.png'],
  },
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
  themeColor: '#004ea2',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#004ea2',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ja'>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}>{children}</body>
    </html>
  );
}
