'use client';
import dynamic from 'next/dynamic';
// CSR専用: react-confetti を SSR 無効で動的ロード
const ReactConfetti = dynamic(() => import('react-confetti'), { ssr: false });
// CSR専用: lottie-react を SSR 無効で動的ロード
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { User } from '@supabase/auth-helpers-nextjs';
import { useEFP2 } from '@/hooks/useEFP2';
import Image from 'next/image';

// スタンプの定義
export const STAMPS = [
  // 1行目
  { id: 1, station_name: '栄町', name: '発車ベル音', image: '/images/stamps/1_sakaemachi.jpg', meta: 'bell' },
  { id: 2, station_name: '東大手', name: '東大手', image: '/images/stamps/2_higashioote.JPG', meta: 'higashiote' },
  { id: 3, station_name: '大曽根', name: '大曽根', image: '/images/stamps/3_oosone.JPG', meta: 'ozone' },
  { id: 4, station_name: '喜多山', name: '喜多山', image: '/images/stamps/4_kitayama.jpg', meta: 'kitayama' },
  {
    id: 5,
    station_name: '大森・金城学院前',
    name: '大森・金城学院前',
    image: '/images/stamps/5_oomori_kinjougakuinmae.jpg',
    meta: 'omorikinjogakuinmae',
  },
  { id: 6, station_name: '尾張旭', name: '尾張旭', image: '/images/stamps/6_owariasahi.jpeg', meta: 'owariasahi' },
  { id: 7, station_name: '新瀬戸', name: '新瀬戸', image: '/images/stamps/7_shinseto.jpg', meta: 'shinseto' },
  { id: 8, station_name: '瀬戸市役所前', name: '瀬戸市役所前', image: '/images/stamps/10_greencity.jpeg', meta: 'setoshiyakushomae' },
  { id: 9, station_name: '瀬戸蔵ミュージアム', name: '瀬戸蔵ミュージアム', image: '/images/stamps/9_setokura.JPG', meta: 'setogura_museum' },
  {
    id: 10,
    station_name: '尾張旭まち案内 ',
    name: 'Asumi_赤い電車_君とせとでん',
    image: '/images/stamps/9_setokura.JPG',
    meta: 'asumi_kimitosetoden',
  },
  // 2行目
  // 3行目
];

// ローカルストレージキー
const STORAGE_KEY = 'collectedStamps';

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const APIKEY =
    'C8w5IdiLDykjCe2Y3kESlzpvFtPxSOyX7wlqJTllFdKHy02IGNmVwMerhQJD6S8ek0zueOdaLEpnL5u25WqYZb5516tGVZcGUrJcgRL6s1veg8d8t7izQqToN/wlbNi1oQNInwTy8KXFgnKxbfsd+cYYQks9JGttFQeY2WiEtZvS/+N4HNVn2u/GZGHOUAv+0oukh1L7gMLxwy6mFGPWbzu6AGUUJjr8rTkWzDuPmuHLEnU1DW+lfI5yQeVfuIab';

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { meta, isRec, handleSwitchRec, error: audioError } = useEFP2(APIKEY);

  const [collectedStamps, setCollectedStamps] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  // collectedStampsが更新されるたび、localStorageにも保存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectedStamps));
    } catch (e) {
      console.error('localStorage書き込みエラー:', e);
    }
  }, [collectedStamps]);

  const [newStamp, setNewStamp] = useState<(typeof STAMPS)[0] | null>(null);

  // 位置情報の取得（1回だけ）
  useEffect(() => {
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
      },
      (error) => {
        console.error('位置情報エラー:', error);
        setLocationError('位置情報の取得に失敗しました');
      }
    );
  }, []); // 依存配列を空にして1回だけ実行

  // ユーザー認証状態の確認
  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
        } else {
          // セッションがなければ匿名サインイン
          const {
            data: { user: anonUser },
            error: signInError,
          } = await supabase.auth.signInAnonymously();
          if (signInError) throw signInError;
          setUser(anonUser);
        }
      } catch (error) {
        console.error('認証エラー:', error);
      }
    };
    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // 保存されたスタンプをSupabaseから取得する
  useEffect(() => {
    if (!user) return;
    const fetchStamps = async () => {
      try {
        const { data, error } = await supabase.from('user_stamps').select('stamps').eq('user_id', user.id).single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data?.stamps) {
          setCollectedStamps(data.stamps);
        }
      } catch (error) {
        console.error('スタンプ取得エラー:', error);
      }
    };
    fetchStamps();
  }, [user, supabase]);

  // collectedStampsの変更をSupabaseに保存する
  useEffect(() => {
    if (!user) return;
    const saveStamps = async () => {
      try {
        const { error } = await supabase.from('user_stamps').upsert({ user_id: user.id, stamps: collectedStamps }, { onConflict: 'user_id' });
        if (error) throw error;
      } catch (error) {
        console.error('スタンプ保存エラー:', error);
      }
    };
    saveStamps();
  }, [collectedStamps, user, supabase]);

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
    if (!meta) return;
    const matchedStamp = STAMPS.find((stamp) => stamp.meta === meta);
    if (matchedStamp && !collectedStamps.includes(matchedStamp.id)) {
      const updatedStamps = [...collectedStamps, matchedStamp.id];
      setCollectedStamps(updatedStamps);
      setNewStamp(matchedStamp);

      // 全てのスタンプを集めた場合
      if (updatedStamps.length === STAMPS.length) {
        // 少し待ってからコンプリートページに遷移
        setTimeout(() => {
          router.push('/complete');
        }, 2000);
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

  // initialize window size for confetti
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const updateSize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // show confetti for 2 seconds when newStamp is set
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (newStamp) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [newStamp]);

  return (
    <div className='min-h-screen bg-white flex flex-col'>
      {/* メインコンテンツ */}
      <main className='flex-1 flex flex-col items-center mb-12 pb-24 overflow-y-auto'>
        <div className='overflow-hidden shadow-lg hover:shadow-xl transition-shadow'>
          <Image src='/images/main_image.JPG' alt='main_image' width={1000} height={1000} className='object-contain' />
        </div>
        <div className='flex my-2 align-start overflow-hidden hover:shadow-xl transition-shadow'>
          <Image src='/images/MEITETSU_LOGO_2020.png' alt='main_image' width={70} height={50} className='object-contain' />
        </div>
        <div className='overflow-hidden transition-shadow'>
          <Image src='/images/logo.png' alt='logo' width={300} height={240} className='object-contain hover:scale-105 transition-transform' />
        </div>

        {(locationError || audioError) && (
          <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative' role='alert'>
            <span className='block sm:inline'>{locationError || audioError}</span>
            {locationError && (
              <button
                onClick={() => {
                  setLocationError(null);
                  setLocation(null);
                }}
                className='ml-4 text-sm underline hover:no-underline'>
                再試行
              </button>
            )}
          </div>
        )}

        <div className='text-center text-md mt-4 text-gray-700 p-4 bg-yellow-50 border-2 border-yellow-400 shadow-md animate-pulse'>
          <div className='flex items-center justify-center mb-2'>
            <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6 text-yellow-500 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
              />
            </svg>
            <span className='font-bold text-yellow-700'>お知らせ</span>
          </div>
          スタンプラリーに参加するには
          <br />
          マイクの使用を許可してください！
          <div className='mt-2 text-sm text-yellow-600'>👉 ブラウザの許可ポップアップが表示されたら「許可」を選択してください 👈</div>
        </div>

        {/* スタンプと線路のグリッド */}
        <div className='w-full max-w-2xl my-4 p-4 bg-white shadow-lg'>
          {/* かわいいタイトル */}
          <div className='flex mb-6 items-center'>
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
            <div className='inline-block bg-white transform -rotate-2'>
              <span className='text-xl font-bold text-red-600 flex items-center'>
                <span className='text-gray-700 bg-clip-text tracking-widest'>
                  スタンプ<span className='text-red-600 text-3xl'>10</span>個集めて
                  <br />
                  景品をGET！
                </span>
                <span className='ml-2'>✨</span>
              </span>
            </div>
          </div>

          <div className='grid grid-cols-3 gap-4'>
            {STAMPS.map((stamp, index) => (
              <div key={stamp.id} className='relative rounded-md overflow-hidden'>
                {/* 線路の描画（最後のスタンプ以外） */}
                {index < STAMPS.length - 1 && <div className='absolute top-1/2 left-[calc(100%_-_8px)] w-[calc(100%_+_16px)] h-2 -z-10 track-bg' />}

                {/* スタンプ */}
                <div className={`aspect-square rounded-md overflow-hidden group relative`}>
                  <Image
                    src={stamp.image}
                    alt={stamp.name}
                    fill
                    className={`object-cover transition-opacity duration-300 ${collectedStamps.includes(stamp.id) ? 'opacity-100' : 'opacity-5'}`}
                  />
                  {collectedStamps.includes(stamp.id) ? (
                    <button
                      onClick={() => handleDownload(stamp)}
                      className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300'>
                      <DownloadIcon className='w-6 h-6 text-white opacity-0 group-hover:opacity-100' />
                    </button>
                  ) : (
                    <div className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300'>
                      <span className='text-gray-500 text-4xl font-bold opacity-70'>?</span>
                    </div>
                  )}
                </div>

                {/* 駅名 */}
                <div className='text-center'>
                  <span
                    className={`${collectedStamps.includes(stamp.id) ? 'text-blue-600' : 'text-gray-500'}`}
                    style={{ fontSize: '10px', lineHeight: 0.8 }}>
                    {stamp.station_name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* マイク許可の注意喚起 */}

      {/* 音声認識ボタンまたは開始ボタン */}
      <div className='fixed px-4 bottom-4 left-0 right-0 flex justify-center'>
        {user ? (
          <button
            className={`w-full h-12 rounded-full flex items-center justify-center ${isRec ? 'bg-red-500 hover:bg-red-600' : 'bg-[#004ea2] hover:bg-blue-600'} text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl ${!location || !!locationError ? 'opacity-50' : ''}`}
            onClick={handleSwitchRec}
            disabled={!location || !!locationError}>
            <span className='text-xl'>{isRec ? '停止' : '📢 音響検知スタート'}</span>
          </button>
        ) : (
          <button
            onClick={handleAnonymousSignUp}
            disabled={isLoading}
            className='w-full h-12 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl'>
            {isLoading ? '登録中...' : 'スタート'}
          </button>
        )}
      </div>

      {/* スタンプ獲得アニメーション */}
      <AnimatePresence>{newStamp && <StampCollectionAnimation stamp={newStamp} onComplete={() => setNewStamp(null)} />}</AnimatePresence>
      {/* テスト用: localStorageリセットボタン */}
      <div className='fixed bottom-20 left-0 right-0 flex justify-center gap-2 z-50'>
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setCollectedStamps([]);
          }}
          className='px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded'>
          Test: Reset Stamps
        </button>
        <button onClick={() => router.push('/complete')} className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded'>
          Test: コンプリート画面へ
        </button>
      </div>

      {/* Confetti animation loaded dynamically on client */}
      {showConfetti && <ReactConfetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} />}
    </div>
  );
}

// アイコンコンポーネント
const DownloadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
  </svg>
);

// スタンプ獲得アニメーション
const StampCollectionAnimation: React.FC<{ stamp: (typeof STAMPS)[0]; onComplete: () => void }> = ({ stamp, onComplete }) => {
  const [showTrain, setShowTrain] = useState(true);
  const [showStamp, setShowStamp] = useState(false);
  const [fireworksData, setFireworksData] = useState<object | null>(null);
  // 電車アニメーション完了後にスタンプ表示へ
  useEffect(() => {
    if (showTrain) {
      const timer = setTimeout(() => {
        setShowTrain(false);
        setShowStamp(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showTrain]);
  // showStamp開始時に花火JSONをロード
  useEffect(() => {
    if (showStamp) {
      fetch('/lottie/hanabi.json')
        .then((res) => res.json())
        .then((data) => setFireworksData(data))
        .catch((err) => console.error('Lottie JSON 読み込みエラー:', err));
    }
  }, [showStamp]);
  // スタンプ表示後に1秒拡大＋バウンス → 2秒停止後に完了コール
  useEffect(() => {
    if (showStamp) {
      const completeTimer = setTimeout(onComplete, 4000);
      return () => clearTimeout(completeTimer);
    }
  }, [showStamp, onComplete]);

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 backdrop-blur-sm'>
      {showTrain && (
        <motion.div
          initial={{ x: '-100%', y: 0 }}
          animate={{
            x: '100%',
            y: [0, 0, -20, 0],
          }}
          transition={{
            x: { duration: 1, ease: 'linear' },
            y: { times: [0, 0.8, 0.9, 1], duration: 1.2, ease: 'easeOut' },
          }}
          className='absolute top-1/2 left-0'>
          <Image src='/images/wrapped_densha.png' alt='電車' width={800} height={400} />
        </motion.div>
      )}
      {showStamp && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1, 0.8, 1] }}
          transition={{ scale: { times: [0, 0.75, 0.9, 1], duration: 1, ease: 'easeOut' } }}
          className='relative z-10'
          style={{ opacity: 1 }}>
          {fireworksData && (
            <div className='absolute inset-0 z-0 pointer-events-none'>
              <Lottie animationData={fireworksData} loop={false} />
            </div>
          )}
          <div className='absolute inset-0 bg-red-600 opacity-0 animate-stamp rounded-2xl' />
          <Image src={stamp.image} alt={stamp.station_name} width={320} height={320} className='rounded-2xl shadow-2xl' />
        </motion.div>
      )}
    </div>
  );
};
