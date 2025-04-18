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
  // 1行目
  { id: 1, name: '発車ベル音', image: '/images/stamps/1_sakaemachi.jpg', meta: 'bell' },
  { id: 2, name: '東大手', image: '/images/stamps/2_higashioote.JPG', meta: 'higashiote' },
  { id: 3, name: '大曽根', image: '/images/stamps/3_oosone.JPG', meta: 'ozone' },
  { id: 4, name: '喜多山', image: '/images/stamps/4_kitayama.jpg', meta: 'kitayama' },
  { id: 5, name: '大森・金城学院前', image: '/images/stamps/5_oomori_kinjougakuinmae.jpg', meta: 'omorikinjogakuinmae' },
  { id: 6, name: '尾張旭', image: '/images/stamps/6_owariasahi.jpeg', meta: 'owariasahi' },
  { id: 7, name: '新瀬戸', image: '/images/stamps/7_shinseto.jpg', meta: 'shinseto' },
  { id: 8, name: '瀬戸市役所前', image: '/images/stamps/10_greencity.jpeg', meta: 'setoshiyakushomae' },
  { id: 9, name: '瀬戸蔵ミュージアム', image: '/images/stamps/9_setokura.JPG', meta: 'setogura_museum' },
  { id: 10, name: 'Asumi_赤い電車_君とせとでん', image: '/images/stamps/9_setokura.JPG', meta: 'asumi_kimitosetoden' },
  // 2行目
  // 3行目
];

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

  const [collectedStamps, setCollectedStamps] = useState<number[]>([]);
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
          router.push('/meitetsu/complete');
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

  return (
    <div className='min-h-screen bg-blue-50 flex flex-col'>
      {/* ヘッダー部分 */}
      <header className='w-full py-4 px-6 flex justify-center items-center bg-white shadow-md rounded-b-3xl'>
        <Image src='/images/logo.png' alt='logo' width={240} height={240} className='object-contain hover:scale-105 transition-transform' />
      </header>

      {/* メインコンテンツ */}
      <main className='flex-1 flex flex-col items-center gap-8 px-4 py-8 pb-24 overflow-y-auto'>
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
        <div className='rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow'>
          <Image src='/images/main_image.JPG' alt='main_image' width={1000} height={1000} className='object-contain' />
        </div>

        {/* スタンプと線路のグリッド */}
        <div className='w-full max-w-2xl mx-auto p-4 bg-white rounded-2xl shadow-lg'>
          <div className='grid grid-cols-4 gap-4'>
            {STAMPS.map((stamp, index) => (
              <div key={stamp.id} className='relative'>
                {/* 線路の描画（最後のスタンプ以外） */}
                {index < STAMPS.length - 1 && (
                  <div
                    className={`absolute top-1/2 left-[calc(100%_-_8px)] w-[calc(100%_+_16px)] h-2 -z-10 ${
                      collectedStamps.includes(stamp.id) && collectedStamps.includes(STAMPS[index + 1].id) ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                    style={{
                      backgroundImage: 'repeating-linear-gradient(90deg, currentColor, currentColor 4px, transparent 4px, transparent 8px)',
                    }}
                  />
                )}

                {/* スタンプ */}
                <div
                  className={`aspect-square rounded-lg border-2 ${
                    collectedStamps.includes(stamp.id) ? 'border-blue-600' : 'border-gray-300'
                  } overflow-hidden group relative`}>
                  {collectedStamps.includes(stamp.id) ? (
                    <>
                      <Image src={stamp.image} alt={stamp.name} fill className='object-cover' />
                      <button
                        onClick={() => handleDownload(stamp)}
                        className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300'>
                        <DownloadIcon className='w-6 h-6 text-white opacity-0 group-hover:opacity-100' />
                      </button>
                    </>
                  ) : (
                    <div className='w-full h-full flex items-center justify-center bg-gray-50'>
                      <div className='w-3 h-3 bg-gray-300 rounded-full' />
                    </div>
                  )}
                </div>

                {/* 駅名 */}
                <div className='text-center'>
                  <span className={`text-xs ${collectedStamps.includes(stamp.id) ? 'text-blue-600' : 'text-gray-500'}`}>{stamp.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* マイク許可の注意喚起 */}
      <div className='text-center text-sm text-gray-700 mb-24'>使用するデバイスのマイクの使用を許可してください。</div>

      {/* 音声認識ボタンまたは開始ボタン */}
      <div className='fixed bottom-8 left-0 right-0 flex justify-center'>
        {user ? (
          <button
            className={`w-36 h-16 rounded-full flex items-center justify-center ${isRec ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl ${!location || !!locationError ? 'opacity-50' : ''}`}
            onClick={handleSwitchRec}
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

// アイコンコンポーネント
const DownloadIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
  </svg>
);

// スタンプ獲得アニメーション
const StampCollectionAnimation: React.FC<{
  stamp: (typeof STAMPS)[0];
  onComplete: () => void;
}> = ({ stamp, onComplete }) => {
  // スタンプ取得時の効果音再生
  useEffect(() => {
    const audio = new Audio('/sounds/acquired.mp3');
    audio.play().catch((err) => console.error('音声再生エラー:', err));
  }, []);

  return (
    <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
        onAnimationComplete={() => {
          setTimeout(onComplete, 6000);
        }}
        className='relative'>
        <div className='absolute inset-0 bg-red-600 opacity-0 animate-stamp rounded-2xl' />
        <Image src={stamp.image} alt={stamp.name} width={240} height={240} className='rounded-2xl shadow-2xl' />
      </motion.div>
    </div>
  );
};
