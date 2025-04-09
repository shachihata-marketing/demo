'use client';

import { useEFP2 } from '@/hooks/useEFP2';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// スタンプの定義
const STAMPS = [
  { id: 1, name: '栄町', image: '/images/stamps/1_sakaemachi.jpg', meta: '対応するメタ情報' },
  { id: 2, name: '東大手', image: '/images/stamps/2_higashioote.JPG', meta: '対応するメタ情報' },
  { id: 3, name: '大曽根', image: '/images/stamps/3_oosone.JPG', meta: '対応するメタ情報' },
  { id: 4, name: '北山', image: '/images/stamps/4_kitayama.jpg', meta: '対応するメタ情報' },
  { id: 5, name: '大森・金城学院前', image: '/images/stamps/5_oomori_kinjougakuinmae.jpg', meta: '対応するメタ情報' },
  { id: 6, name: '尾張旭', image: '/images/stamps/6_owariasahi.jpeg', meta: '対応するメタ情報' },
  { id: 7, name: '新瀬戸', image: '/images/stamps/7_shinseto.jpg', meta: '対応するメタ情報' },
  { id: 8, name: '尾張瀬戸', image: '/images/stamps/8_owariseto.jpg', meta: '対応するメタ情報' },
  { id: 9, name: '瀬戸口', image: '/images/stamps/9_setokura.JPG', meta: '対応するメタ情報' },
  { id: 10, name: 'グリーンシティ', image: '/images/stamps/10_greencity.jpeg', meta: '対応するメタ情報' },
];

export default function Home() {
  // EFP2KITのAPI KEY
  const APIKEY = 'XXBU6d12wboOvdLX4tVjY4IaXJpkkIi0BS3rDAqH+A4vdGG4ZEeL5XrbAnwicrQoN1CY8UzcQiU5G2sym6owH70dcQPiIyn6CwPC2Wi8Fr4=';

  const {
    meta, // useState<string|null> FingerPrintが認識されたら、ここに文字列が入る。
    handleSwitchRec, // () => Promise<void> マイクのスイッチON/Off切り替えのhandler
    isRec, // boolean マイクのオンオフのフラグ
  } = useEFP2(APIKEY);

  const [collectedStamps, setCollectedStamps] = useState<number[]>([]);
  const [newStamp, setNewStamp] = useState<(typeof STAMPS)[0] | null>(null);

  useEffect(() => {
    console.log(meta);
    if (meta) {
      const matchedStamp = STAMPS.find((stamp) => stamp.meta === meta);
      if (matchedStamp && !collectedStamps.includes(matchedStamp.id)) {
        setCollectedStamps((prev) => [...prev, matchedStamp.id]);
        setNewStamp(matchedStamp);
      }
    }
  }, [meta, collectedStamps]);

  const handleDownload = async (stamp: (typeof STAMPS)[0]) => {
    const response = await fetch(stamp.image);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stamp_${stamp.name}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className='min-h-screen bg-white flex flex-col'>
      {/* ヘッダー部分 */}
      <header className='w-full py-4 px-6 flex justify-center items-center border-b'>
        <Image src='/images/logo.png' alt='logo' width={120} height={120} className='object-contain' />
      </header>

      {/* メインコンテンツ */}
      <main className='flex-1 flex flex-col items-center gap-6 px-4 py-6  overflow-y-auto'>
        <Image src='/images/main_image.JPG' alt='main_image' width={1000} height={1000} className='object-contain' />
        {/* スタンプグリッド */}
        <div className='grid grid-cols-5 grid-rows-2 gap-2 max-w-md mx-auto'>
          {STAMPS.map((stamp) => (
            <StampFrame key={stamp.id} stamp={stamp} isCollected={collectedStamps.includes(stamp.id)} onDownload={() => handleDownload(stamp)} />
          ))}
        </div>
      </main>

      {/* 音声認識ボタン（固定位置） */}
      <div className='fixed bottom-6 left-0 right-0 flex justify-center'>
        <button
          className={`rounded-full w-16 h-16 flex items-center justify-center ${
            isRec ? 'bg-red-500' : 'bg-blue-500'
          } text-white shadow-lg transform transition-all active:scale-95`}
          onClick={handleSwitchRec}>
          <span className='sr-only'>{isRec ? 'Stop' : 'Start'} Recognition</span>
          {isRec ? <StopIcon className='w-8 h-8' /> : <MicIcon className='w-8 h-8' />}
        </button>
      </div>

      {/* スタンプ獲得アニメーション */}
      <AnimatePresence>{newStamp && <StampCollectionAnimation stamp={newStamp} onComplete={() => setNewStamp(null)} />}</AnimatePresence>
    </div>
  );
}

// StampFrameコンポーネント
const StampFrame: React.FC<{
  stamp: (typeof STAMPS)[0];
  isCollected: boolean;
  onDownload: () => void;
}> = ({ stamp, isCollected, onDownload }) => {
  return (
    <div className='relative aspect-square border-2 border-gray-300 rounded-lg overflow-hidden group'>
      {isCollected ? (
        <>
          <Image src={stamp.image} alt={stamp.name} fill className='object-cover' />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className='absolute bottom-2 right-2 bg-white rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200'
            aria-label='スタンプをダウンロード'>
            <DownloadIcon />
          </button>
        </>
      ) : (
        <div className='w-full h-full flex items-center justify-center p-2 text-center'>
          <span className='text-gray-400 text-sm'>{stamp.name}</span>
        </div>
      )}
    </div>
  );
};

// スタンプ獲得アニメーション
const StampCollectionAnimation: React.FC<{
  stamp: (typeof STAMPS)[0];
  onComplete: () => void;
}> = ({ stamp, onComplete }) => {
  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'>
      <motion.div
        initial={{ scale: 1.5, y: -100, rotate: -45 }}
        animate={{
          scale: [1.5, 1.2, 1],
          y: [-100, 0, 0],
          rotate: [-45, -45, 0],
          transition: { duration: 1, times: [0, 0.6, 1] },
        }}
        exit={{ scale: 0, opacity: 0 }}
        onAnimationComplete={onComplete}
        className='relative'>
        <div className='absolute inset-0 bg-red-600 opacity-0 animate-stamp' />
        <Image src={stamp.image} alt={stamp.name} width={200} height={200} className='rounded-lg shadow-lg' />
      </motion.div>
    </div>
  );
};

// アイコンコンポーネント
const DownloadIcon = () => (
  <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
  </svg>
);

const MicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth={2}
      d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
    />
  </svg>
);

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <rect x='6' y='6' width='12' height='12' stroke='currentColor' strokeWidth={2} />
  </svg>
);
