'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';

export default function CompletePage() {
  const supabase = createClientComponentClient();
  const [isExchanged, setIsExchanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleExchange = async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error('ユーザーが見つかりません');
        return;
      }

      const { error } = await supabase.from('users').update({ completed: true }).eq('id', user.id);

      if (error) {
        console.error('更新エラー:', error);
        return;
      }

      setIsExchanged(true);
    } catch (error) {
      console.error('エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkExchangeStatus = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('completed').eq('id', user.id).single();

        if (data) {
          setIsExchanged(data.completed);
        }
      }
    };

    checkExchangeStatus();
  }, [supabase]);

  const handleDownload = async () => {
    const response = await fetch('/images/complete_image.JPG');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meitetsu_rally_complete.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className='min-h-screen bg-white flex flex-col items-center justify-center p-4'>
      {/* ヘッダー部分 */}
      <header className='w-full py-4 px-6 flex justify-center items-center bg-white shadow-md rounded-b-3xl fixed top-0 left-0 right-0 z-10'>
        <Image src='/images/logo.png' alt='logo' width={180} height={120} className='object-contain hover:scale-100 transition-transform' />
      </header>

      {/* メインコンテンツ */}
      <main className='flex flex-col items-center justify-center gap-4 mt-24 mb-8'>
        {/* おめでとうメッセージ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className='text-center relative z-0'>
          <h1 className='text-3xl font-bold text-blue-600 mb-4 relative z-0'>
            <span className='bg-gradient-to-r from-pink-500 via-yellow-500 to-blue-500 text-transparent bg-clip-text'>コンプリート</span>
            <br />
            <span className='relative inline-block'>
              おめでとうございます！
              <span className='absolute -top-2 -right-4 text-2xl animate-pulse'>🎉</span>
              <span className='absolute -bottom-2 -left-4 text-2xl animate-pulse'>🎊</span>
            </span>
          </h1>
          <p className='text-gray-600'>
            ご参加いただき
            <br />
            誠にありがとうございました
          </p>
        </motion.div>

        {/* コンプリート画像 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className='relative overflow-hidden shadow-2xl hover:shadow-3xl transition-shadow'>
          <Image src='/images/complete_image.JPG' alt='complete' width={800} height={600} className='object-contain' />
        </motion.div>

        {/* 紙吹雪アニメーション */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className='absolute inset-0 pointer-events-none z-0'>
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className='absolute w-2 h-2 bg-blue-500 rounded-full'
              initial={{
                opacity: 1,
                top: '-10%',
                left: `${Math.random() * 100}%`,
                scale: Math.random() * 0.5 + 0.5,
              }}
              animate={{
                opacity: 0,
                top: '110%',
                left: `${Math.random() * 100}%`,
              }}
              transition={{
                duration: Math.random() * 2 + 1,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
              style={{
                backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'][Math.floor(Math.random() * 4)],
              }}
            />
          ))}
        </motion.div>

        {/* ボタングループ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className='flex gap-4 flex-wrap justify-center'>
          <button
            onClick={handleDownload}
            className='px-8 py-3 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 transition-all hover:shadow-xl active:scale-95 flex items-center gap-2'>
            <DownloadIcon />
            画像を保存
          </button>

          <button
            onClick={handleExchange}
            disabled={isExchanged || isLoading}
            className={`px-8 py-3 rounded-full shadow-lg transition-all hover:shadow-xl active:scale-95 flex items-center gap-2 ${
              isExchanged ? 'bg-gray-400 cursor-not-allowed' : isLoading ? 'bg-yellow-500 cursor-wait' : 'bg-red-500 hover:bg-red-600'
            } text-white`}>
            {isLoading ? <span>処理中...</span> : isExchanged ? <span>景品交換済み</span> : <span>景品と交換する</span>}
          </button>

          {/* YouTube 動画埋め込み (ミュート + 自動再生) */}
          <div className='w-full max-w-2xl mb-4 aspect-video'>
            <iframe
              className='w-full h-full'
              src='https://www.youtube.com/embed/sG2qLjitPxw?autoplay=1&mute=1'
              title='YouTube video'
              frameBorder='0'
              allow='autoplay; encrypted-media'
              allowFullScreen
            />
          </div>
          <Link
            href='/'
            className='px-8 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all hover:shadow-xl active:scale-95'>
            ホームに戻る
          </Link>
        </motion.div>
      </main>
    </div>
  );
}

// ダウンロードアイコン
const DownloadIcon = () => (
  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
  </svg>
);
