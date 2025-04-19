'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { STAMPS } from '@/lib/stamps';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export default function CompletePage() {
  const supabase = createClientComponentClient();
  const [fireworks, setFireworks] = useState(null);
  const [collectedStamps, setCollectedStamps] = useState<number[]>(() => {
    try {
      const s = localStorage.getItem('collectedStamps');
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });
  const [isExchanged, setIsExchanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFireworks, setShowFireworks] = useState(true);

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

  useEffect(() => {
    fetch('/lottie/hanabi.json')
      .then((res) => res.json())
      .then((data) => setFireworks(data))
      .catch((e) => console.error('Lottie JSON 読み込みエラー:', e));
  }, []);

  useEffect(() => {
    if (fireworks) {
      const timer = setTimeout(() => setShowFireworks(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [fireworks]);

  const handleDownload = async () => {
    try {
      const imagePath = '/images/complete_image.JPG';
      const res = await fetch(imagePath);
      const blob = await res.blob();
      const file = new File([blob], 'meitetsu_rally_complete.jpg', { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'めいてつ瀬戸線 スタンプラリーコンプリート' });
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (e: unknown) {
      // Error オブジェクトか確認
      if (e instanceof Error) {
        // ユーザーがキャンセルした場合（Share canceled）を無視
        if (e.name !== 'AbortError') {
          console.error('Complete image save error:', e);
        }
      } else {
        console.error('Complete image save error (non-error):', e);
      }
    }
  };

  const handleSaveStamp = async (stamp: (typeof STAMPS)[number]) => {
    try {
      const res = await fetch(stamp.image);
      const blob = await res.blob();
      const file = new File([blob], `stamp_${stamp.name}.jpg`, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: stamp.name });
      } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (e: unknown) {
      // Error オブジェクトか確認
      if (e instanceof Error) {
        // ユーザーがキャンセルした場合（Share canceled）を無視
        if (e.name !== 'AbortError') {
          console.error('Stamp save error:', e);
        }
      } else {
        console.error('Stamp save error (non-error):', e);
      }
    }
  };

  useEffect(() => {
    const loadStamps = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('user_stamps').select('stamps').eq('user_id', user.id).single();
      if (data?.stamps) setCollectedStamps(data.stamps);
    };
    loadStamps();
  }, [supabase]);

  return (
    <div className='min-h-screen bg-white flex flex-col items-center justify-center p-4 relative'>
      <div className='w-full max-w-md mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-3xl relative'>
        {showFireworks && fireworks ? (
          <div className='fixed inset-0 flex items-center justify-center bg-white z-50'>
            <Lottie animationData={fireworks} loop autoPlay style={{ width: '100%', height: '100%' }} />
            <div className='absolute inset-0 flex items-center justify-center'>
              <Image
                src='/images/logo.png'
                alt='logo'
                width={180}
                height={120}
                className='object-contain'
                style={{
                  animation: 'zoom-in 4.5s ease-out forwards',
                }}
              />
              <style jsx global>{`
                @keyframes zoom-in {
                  from {
                    transform: scale(0);
                  }
                  to {
                    transform: scale(1);
                    width: 100%;
                  }
                }
              `}</style>
            </div>
          </div>
        ) : (
          <>
            <header className='w-full py-4 px-6 flex justify-center items-center bg-white shadow-md rounded-b-3xl fixed top-0 left-0 right-0 z-10'>
              <div className='w-full max-w-md mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-3xl relative'>
                <Image src='/images/logo.png' alt='logo' width={180} height={120} className='object-contain hover:scale-100 transition-transform' />
              </div>
            </header>

            <main className='relative flex flex-col items-center justify-center gap-2 mt-24 mb-8'>
              <div className='flex items-center w-full mb-4'>
                <motion.div
                  className='mr-3'
                  animate={{
                    y: [0, -2, 0, 2, 0],
                    rotate: [-1, 1, -1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: 'easeInOut',
                  }}>
                  <Image src='/images/densha.jpg' alt='電車' width={48} height={48} className='object-contain' />
                </motion.div>
                <div className='flex flex-col'>
                  <div className='text-gray-600 text-xl font-bold relative z-0'>
                    <span className='relative inline-block'>おめでとうございます 🎉</span>
                  </div>
                  <p className='text-gray-600 text-sm'>コンプリート記念画像はこちらです👇</p>
                </div>
              </div>

              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className='relative overflow-hidden transform-gpu hover:shadow-3xl transition-all'
                style={{
                  perspective: '1000px',
                  transformStyle: 'preserve-3d',
                }}>
                <div
                  className='p-2 bg-gradient-to-r from-amber-100 to-amber-200 border-8 border-amber-700 rounded-lg'
                  style={{
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2), 0 10px 10px rgba(0,0,0,0.15)',
                    transform: 'rotateX(5deg)',
                    transformStyle: 'preserve-3d',
                  }}>
                  <div className='p-2 relative' style={{ transform: 'translateZ(20px)' }}>
                    <Image
                      src='/images/complete_image.JPG'
                      alt='complete'
                      width={800}
                      height={600}
                      className='object-contain rounded-md'
                      style={{
                        boxShadow: '0 5px 15px rgba(0,0,0,0.1)',
                        transform: 'translateZ(10px)',
                      }}
                    />
                  </div>
                  <div
                    className='absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-4 bg-amber-800 rounded-t-lg'
                    style={{ transform: 'translateZ(5px) translateX(-50%)' }}></div>
                </div>
              </motion.div>

              <div className='flex mt-4 gap-4 flex-wrap justify-center'>
                <button
                  onClick={handleDownload}
                  className='px-8 py-3 bg-green-500 text-white text-lg rounded-full shadow-lg transition-all hover:shadow-xl active:scale-95 flex items-center gap-2'
                  style={{ backgroundColor: '#004ea2' }}>
                  <DownloadIcon />
                  コンプリート画像を保存
                </button>
              </div>

              <div className='flex-1 w-full p-4 my-6 bg-gray-100 shadow-lg rounded-lg gap-2'>
                <p className='w-full text-sm text-gray-600'>景品受け取り方法</p>
              </div>

              <div className='flex-1 w-full p-4 my-6 bg-gray-100 shadow-lg rounded-lg gap-2'>
                <p className='w-full text-sm text-gray-600'>↓名古屋鉄道スタッフ専用ボタン</p>
                <button
                  onClick={handleExchange}
                  disabled={isExchanged || isLoading}
                  className={`mt-4 px-8 py-3 rounded-full shadow-lg transition-all hover:shadow-xl active:scale-95 flex items-center gap-2 ${
                    isExchanged ? 'bg-gray-400 cursor-not-allowed' : isLoading ? 'bg-yellow-500 cursor-wait' : 'bg-red-500 hover:bg-red-600'
                  } text-white`}>
                  {isLoading ? <span>処理中...</span> : isExchanged ? <span>景品交換済み</span> : <span>景品と交換する</span>}
                </button>
              </div>

              <div className='flex-1 w-full my-6 gap-2'>
                <p className='text-gray-600'>
                  🎵 瀬戸蔵ミュージアムのご紹介動画です
                  <br />
                  ぜひご視聴ください
                </p>
                <div className='w-full max-w-2xl my-4 aspect-video'>
                  <iframe
                    className='w-full h-full'
                    src='https://www.youtube.com/embed/sG2qLjitPxw?autoplay=1&mute=1'
                    title='YouTube video'
                    frameBorder='0'
                    allow='autoplay; encrypted-media'
                    allowFullScreen
                  />
                </div>
              </div>

              <div className='mt-8 mb-6 shadow-lg rounded-lg p-4 w-full'>
                <h3 className='text-black text-md font-bold text-center mb-4'>✨ スタンプコレクション ✨</h3>
                <div className='grid grid-cols-5 gap-4 md:grid-cols-5 lg:grid-cols-10'>
                  {collectedStamps.map((id) => {
                    const stamp = STAMPS.find((s) => s.id === id);
                    if (!stamp) return null;
                    return (
                      <div
                        key={id}
                        className='flex aspect-square rounded-md overflow-hidden relative cursor-pointer'
                        onClick={() => handleSaveStamp(stamp)}>
                        <Image src={stamp.image} alt={stamp.name} width={100} height={100} className='object-cover w-full h-full' />
                      </div>
                    );
                  })}
                </div>
              </div>
              <Link
                href='/'
                className='px-8 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all hover:shadow-xl active:scale-95 md:px-10 md:py-4 md:text-lg'>
                ホームに戻る
              </Link>
            </main>
          </>
        )}
      </div>
    </div>
  );
}

const DownloadIcon = () => (
  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
  </svg>
);
