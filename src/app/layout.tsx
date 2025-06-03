import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
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
    images: ['/images/hero1.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'シヤチハタ動物園デモページ',
    description: '音響認識技術を使用したデジタルスタンプラリーのデモンストレーション',
    images: ['/images/hero1.png'],
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
        <link rel='icon' href='/favicon.ico' />
        <link rel='manifest' href='/manifest.json' />
        <link rel='apple-touch-icon' href='/images/hero1.png' />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-18BSM8C75G"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-18BSM8C75G');
            
            // EFP2 SDKのログを抑制（開発環境・本番環境両方）
            if (typeof window !== 'undefined') {
              const originalLog = console.log;
              const originalDebug = console.debug;
              const originalInfo = console.info;
              
              // console.logのオーバーライド
              console.log = function(...args) {
                // APIキーやセンシティブな情報を含むログをフィルタ
                const logString = args.join(' ');
                if (logString.includes('apikey:') || 
                    logString.includes('dk:') || 
                    logString.includes('campaign_id:') ||
                    logString.includes('sdkInitialized:') ||
                    logString.includes('need_decode_meta:') ||
                    logString.includes('eMaYe9yDYUY')) {
                  return; // これらのログは出力しない
                }
                originalLog.apply(console, args);
              };
              
              // debug/infoも同様にフィルタ
              console.debug = function(...args) {
                const logString = args.join(' ');
                if (logString.includes('apikey:') || logString.includes('dk:')) {
                  return;
                }
                originalDebug.apply(console, args);
              };
              
              console.info = function(...args) {
                const logString = args.join(' ');
                if (logString.includes('apikey:') || logString.includes('dk:')) {
                  return;
                }
                originalInfo.apply(console, args);
              };
            }
          `}
        </Script>
        <MobileContainer>{children}</MobileContainer>
      </body>
    </html>
  );
}
