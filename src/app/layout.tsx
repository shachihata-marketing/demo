import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import MobileContainer from '@/components/MobileContainer';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'シヤチハタ動物園デモページ',
  description: 'シヤチハタ動物園 音声スタンプラリー デモンストレーション',
  metadataBase: new URL('https://shachihata-zoo-demo.vercel.app'),
  openGraph: {
    title: 'シヤチハタ動物園デモページ',
    description: '音響認識技術を使用したデジタルスタンプラリーのデモンストレーション',
    images: ['/images/logo.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'シヤチハタ動物園デモページ',
    description: '音響認識技術を使用したデジタルスタンプラリーのデモンストレーション',
    images: ['/images/logo.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#22c55e',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ja'>
      <head>
        <link rel='manifest' href='/manifest.json' />
        <link rel='apple-touch-icon' href='/images/logo.png' />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MobileContainer>{children}</MobileContainer>
      </body>
    </html>
  );
}
