'use client';

import { useEFP2 } from '@/hooks/useEFP2';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { User } from '@supabase/auth-helpers-nextjs';

// スタンプの定義
const STAMPS = [
  { id: 1, name: '栄町', image: '/images/stamps/1_sakaemachi.jpg', meta: 'sakaemachi' },
  { id: 2, name: '東大手', image: '/images/stamps/2_higashioote.JPG', meta: 'higashioote' },
  { id: 3, name: '大曽根', image: '/images/stamps/3_oosone.JPG', meta: 'oosone' },
  { id: 4, name: '北山', image: '/images/stamps/4_kitayama.jpg', meta: 'kitayama' },
  { id: 5, name: '大森・金城学院前', image: '/images/stamps/5_oomori_kinjougakuinmae.jpg', meta: 'oomori_kinjougakuinmae' },
  { id: 6, name: '尾張旭', image: '/images/stamps/6_owariasahi.jpeg', meta: 'owariasahi' },
  { id: 7, name: '新瀬戸', image: '/images/stamps/7_shinseto.jpg', meta: 'shinseto' },
  { id: 8, name: '尾張瀬戸', image: '/images/stamps/8_owariseto.jpg', meta: 'owariseto' },
  { id: 9, name: '瀬戸口', image: '/images/stamps/9_setokura.JPG', meta: 'setokura' },
  { id: 10, name: 'グリーンシティ', image: '/images/stamps/10_greencity.jpeg', meta: 'greencity' },
];

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const APIKEY = 'XXBU6d12wboOvdLX4tVjY4IaXJpkkIi0BS3rDAqH+A4vdGG4ZEeL5XrbAnwicrQoN1CY8UzcQiU5G2sym6owH70dcQPiIyn6CwPC2Wi8Fr4=';

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { meta, handleSwitchRec, isRec } = useEFP2(APIKEY);

  const [collectedStamps, setCollectedStamps] = useState<number[]>([]);
  const [newStamp, setNewStamp] = useState<(typeof STAMPS)[0] | null>(null);

  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [showMicPrompt, setShowMicPrompt] = useState(false);

  // 位置情報の取得
  useEffect(() => {
    const getLocation = () => {
      if (!navigator.geolocation) {
        setLocationError('位置情報が利用できません');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          console.log(position);
        },
        (error) => {
          console.error('位置情報エラー:', error);
          setLocationError('位置情報の取得に失敗しました');
        }
      );
    };

    getLocation();
  }, []);

  // ユーザー認証状態の確認
  useEffect(() => {
    const checkUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        setUser(user);
      } catch (error) {
        console.error('認証エラー:', error);
      }
    };

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // 匿名ユーザー登録
  const handleAnonymousSignUp = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signInAnonymously();

      if (error) throw error;
    } catch (error) {
      console.error('匿名認証エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log(meta);
    if (meta) {
      const matchedStamp = STAMPS.find((stamp) => stamp.meta === meta);
      if (matchedStamp && !collectedStamps.includes(matchedStamp.id)) {
        setCollectedStamps((prev) => [...prev, matchedStamp.id]);
        setNewStamp(matchedStamp);

        // 全てのスタンプを集めた場合
        const updatedStamps = [...collectedStamps, matchedStamp.id];
        if (updatedStamps.length === STAMPS.length) {
          // 少し待ってからコンプリートページに遷移
          setTimeout(() => {
            router.push('/meitetsu/complete');
          }, 2000);
        }
      }
    }
  }, [meta, collectedStamps, router]);

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

  // マイク許可状態の確認
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermission(result.state);

        result.addEventListener('change', () => {
          setMicPermission(result.state);
        });
      } catch (error) {
        console.error('マイク権限の確認エラー:', error);
      }
    };

    checkMicPermission();
  }, []);

  // 音声認識開始前の確認
  const handleStartRecording = async () => {
    if (micPermission === 'denied') {
      alert('マイクの使用が許可されていません。ブラウザの設定から許可してください。');
      return;
    }

    if (micPermission === 'prompt') {
      setShowMicPrompt(true);
      return;
    }

    handleSwitchRec();
  };

  return (
    <div className='min-h-screen bg-blue-50 flex flex-col'>
      {/* ヘッダー部分 */}
      <header className='w-full py-4 px-6 flex justify-center items-center bg-white shadow-md rounded-b-3xl'>
        <Image src='/images/logo.png' alt='logo' width={120} height={120} className='object-contain hover:scale-105 transition-transform' />
      </header>

      {/* メインコンテンツ */}
      <main className='flex-1 flex flex-col items-center gap-8 px-4 py-8 overflow-y-auto'>
        {locationError && (
          <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
            <span className='block sm:inline'>{locationError}</span>
          </div>
        )}
        <div className='rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow'>
          <Image src='/images/main_image.JPG' alt='main_image' width={1000} height={1000} className='object-contain' />
        </div>
        {/* スタンプグリッド */}
        <div className='grid grid-cols-5 grid-rows-2 gap-4 max-w-md mx-auto p-4 bg-white rounded-2xl shadow-lg'>
          {STAMPS.map((stamp) => (
            <StampFrame key={stamp.id} stamp={stamp} isCollected={collectedStamps.includes(stamp.id)} onDownload={() => handleDownload(stamp)} />
          ))}
        </div>
      </main>

      {/* マイク許可確認モーダル */}
      {showMicPrompt && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white p-6 rounded-lg shadow-xl max-w-sm mx-4'>
            <h3 className='text-lg font-bold mb-4'>音声認識の開始</h3>
            <p className='mb-4'>
              スタンプラリーを開始するには、マイクの使用を許可する必要があります。 ブラウザの確認画面が表示されたら、「許可」を選択してください。
            </p>
            <div className='flex justify-end gap-4'>
              <button onClick={() => setShowMicPrompt(false)} className='px-4 py-2 text-gray-600 hover:text-gray-800'>
                キャンセル
              </button>
              <button
                onClick={() => {
                  setShowMicPrompt(false);
                  handleSwitchRec();
                }}
                className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>
                開始する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 音声認識ボタンまたは開始ボタン */}
      <div className='fixed bottom-8 left-0 right-0 flex justify-center'>
        {user ? (
          <button
            className={`w-36 h-16 rounded-full flex items-center justify-center ${
              isRec ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            } text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl`}
            onClick={isRec ? handleSwitchRec : handleStartRecording}
            disabled={!location || !!locationError}>
            <span>{isRec ? '停止' : '開始'}</span>
          </button>
        ) : (
          <button
            onClick={handleAnonymousSignUp}
            disabled={isLoading}
            className='w-36 h-16 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl'>
            {isLoading ? '登録中...' : 'スタート'}
          </button>
        )}
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
    <div className='relative aspect-square border-3 border-gray-200 rounded-2xl overflow-hidden group hover:shadow-md transition-all duration-300 bg-gray-50'>
      {isCollected ? (
        <>
          <Image src={stamp.image} alt={stamp.name} fill className='object-cover transform hover:scale-105 transition-transform duration-300' />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className='absolute bottom-2 right-2 bg-white rounded-full p-2.5 shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-blue-50'
            aria-label='スタンプをダウンロード'>
            <DownloadIcon />
          </button>
        </>
      ) : (
        <div className='w-full h-full flex items-center justify-center p-2 text-center bg-gray-50'>
          <span className='text-gray-500 text-xs font-medium'>{stamp.name}</span>
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
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 backdrop-blur-sm'>
      <motion.div
        initial={{ scale: 2, y: -100, rotate: -45 }}
        animate={{
          scale: [2, 1.5, 1],
          y: [-100, 0, 0],
          rotate: [-45, -45, 0],
          transition: { duration: 1.2, times: [0, 0.6, 1], ease: 'easeOut' },
        }}
        exit={{ scale: 0, opacity: 0, transition: { duration: 0.3 } }}
        onAnimationComplete={onComplete}
        className='relative'>
        <div className='absolute inset-0 bg-red-600 opacity-0 animate-stamp rounded-2xl' />
        <Image src={stamp.image} alt={stamp.name} width={240} height={240} className='rounded-2xl shadow-2xl' />
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
