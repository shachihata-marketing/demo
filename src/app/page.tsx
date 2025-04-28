'use client';
import dynamic from 'next/dynamic';
// CSR専用: react-confetti を SSR 無効で動的ロード
const ReactConfetti = dynamic(() => import('react-confetti'), { ssr: false });
// CSR専用: lottie-react を SSR 無効で動的ロード
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { User } from '@supabase/auth-helpers-nextjs';
import { useEFP2 } from '@/hooks/useEFP2';
import Image from 'next/image';
import { STAMPS } from '@/lib/stamps';

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
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    try {
      // ローカルストレージからもコンプリート状態を確認
      return localStorage.getItem('isCompleted') === 'true';
    } catch {
      return false;
    }
  });
  const [allowAutoSignIn, setAllowAutoSignIn] = useState<boolean>(() => {
    try {
      // 'false'が明示的に保存されている場合のみ自動サインインを無効にする
      // localStorage と sessionStorage の両方をチェック
      const lsDisabled = localStorage.getItem('allowAutoSignIn') === 'false';
      const ssDisabled = sessionStorage.getItem('allowAutoSignIn') === 'false';

      // リセット直後かどうかを確認
      const justReset = localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true';

      // どれかでfalseなら無効化
      return !(lsDisabled || ssDisabled || justReset);
    } catch {
      return true;
    }
  });

  const { meta, isRec, handleSwitchRec, error: audioError } = useEFP2(APIKEY);

  // デバッグ用：isRec状態変更の監視
  useEffect(() => {
    console.log('Page component: isRec state changed:', isRec);
  }, [isRec]);

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

  // コンプリート状態を確認する関数（独立した関数として定義）
  const checkCompletedStatus = useCallback(
    async (userId: string) => {
      try {
        console.log('Checking completed status for user:', userId);

        // まずuser_stampsテーブルからスタンプの収集状態を確認
        const { data: stampData } = await supabase.from('user_stamps').select('stamps').eq('user_id', userId).single();

        const collectedAll = stampData?.stamps && Array.isArray(stampData.stamps) && stampData.stamps.length === STAMPS.length;

        // public.usersテーブルのレコードがあるかどうか確認
        const { data: userData } = await supabase.from('users').select('id, completed').eq('id', userId).maybeSingle(); // レコードがない場合もエラーにしない

        let dbCompleted = false;

        if (userData) {
          // 既存レコードの場合はその値を使用
          dbCompleted = userData.completed || false;

          // 全スタンプ収集済みなのにcompletedがfalseの場合は更新
          if (collectedAll && !dbCompleted) {
            console.log('全スタンプ収集済み。completedをtrueに更新します');
            const { error: updateError } = await supabase.from('users').upsert({ id: userId, completed: true }).eq('id', userId);

            if (updateError) throw updateError;
            dbCompleted = true;
          }
        } else {
          // レコードがない場合は新規作成
          console.log('ユーザーレコードが存在しないため新規作成します');
          const { error: insertError } = await supabase.from('users').insert({ id: userId, completed: collectedAll });

          if (insertError) throw insertError;
          dbCompleted = collectedAll;
        }

        console.log('Database completed status:', dbCompleted);

        // 新しい状態をセット
        setIsCompleted(dbCompleted);
        // ローカルストレージに保存（すべてのウィンドウで状態を一貫させるため）
        localStorage.setItem('isCompleted', dbCompleted.toString());
      } catch (error) {
        console.error('コンプリート状態確認エラー:', error);
      }
    },
    [supabase]
  );

  // ユーザー認証状態の監視
  useEffect(() => {
    let unmounted = false;

    // リセット直後かどうかを確認
    const isJustReset = () => {
      return localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true';
    };

    // 初期チェック - リセット直後なら何もしない
    if (isJustReset()) {
      console.log('自動サインイン無効のため、認証状態監視をスキップします');
      return () => {};
    }

    // 自動サインインが許可されていない場合は何もしない
    if (!allowAutoSignIn) {
      console.log('自動サインイン無効のため、認証状態監視をスキップします');
      return () => {};
    }

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        // 終了フラグのチェック
        if (unmounted) return;

        // リセット直後の場合は認証処理をスキップ
        if (localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true') {
          console.log('リセット直後のため、認証処理をスキップします');
          localStorage.removeItem('justReset');
          sessionStorage.removeItem('justReset');
          setUser(null);
          return;
        }

        // 自動サインインが無効の場合はセッションを使用しない
        if (!allowAutoSignIn) {
          console.log('自動サインイン無効のため、認証状態監視をスキップします');
          setUser(null);
          return;
        }

        if (session) {
          const userId = session.user.id;
          setUser(session.user);
          console.log('セッション読み込み完了:', userId);
        } else {
          setUser(null);
          console.log('セッションなし');
        }
      } catch (error) {
        console.error('セッション読み込みエラー:', error);
      }
    };

    // ユーザーが存在しない場合のみ自動サインインを試みる
    if (!user) {
      loadSession();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // リセット直後の場合は認証状態の変更を無視
      if (isJustReset()) {
        console.log('リセット直後のため、認証状態変更を無視します');
        return;
      }

      const hasUser = !!session?.user;
      console.log(`Auth state changed: {hasUser: ${hasUser}, event: '${event}'}`);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setCollectedStamps([]);
        setIsCompleted(false);
      } else if (hasUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        setUser(session.user);
      }
    });

    const unmountCleanup = () => {
      unmounted = true;
      subscription?.unsubscribe();
    };

    return unmountCleanup;
  }, [supabase.auth, allowAutoSignIn, user]);

  // スタンプステータスの定期確認
  useEffect(() => {
    // ユーザーがいない場合は何もしない
    if (!user) return;

    // リセット中かどうかを確認する関数
    const isResetting = () => {
      return localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true';
    };

    // リセット中なら何もしない
    if (isResetting()) {
      console.log('リセット中のため、完了状態チェックをスキップします');
      return () => {};
    }

    const CHECK_INTERVAL_MS = 5000; // 5秒間隔
    let intervalId: NodeJS.Timeout | null = null;

    console.log('完了状態チェックインターバルを設定します');
    intervalId = setInterval(() => {
      // 実行時にもリセットフラグをチェック
      if (isResetting()) {
        console.log('リセット実行中のため、チェックをスキップします');
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }

      console.log('完了状態の定期チェックを実行します');
      checkCompletedStatus(user.id);
    }, CHECK_INTERVAL_MS);

    // 初回チェック（リセットフラグをチェックして実行）
    if (!isResetting()) {
      checkCompletedStatus(user.id);
    }

    return () => {
      if (intervalId) {
        console.log('完了状態チェックインターバルをクリアします');
        clearInterval(intervalId);
      }
    };
  }, [user, checkCompletedStatus]);

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

  // マイク許可の状態を確認する関数
  const checkMicrophonePermission = async () => {
    try {
      // 現在のパーミッション状態を確認
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });

      if (permissionStatus.state === 'denied') {
        setMicPermissionDenied(true);
        setShowPermissionGuide(true);
        return false;
      } else if (permissionStatus.state === 'granted') {
        setMicPermissionDenied(false);
        return true;
      } else {
        // 'prompt' の場合は許可ダイアログを表示するために true を返す
        setMicPermissionDenied(false);
        return true;
      }
    } catch (error) {
      console.error('パーミッション確認エラー:', error);
      // 確認できない場合は許可ダイアログを表示するために true を返す
      return true;
    }
  };

  // 匿名ユーザー登録
  const handleAnonymousSignUp = async () => {
    try {
      setIsLoading(true);
      setMicPermissionDenied(false); // リセット

      // 先にマイク許可状態を確認
      const canRequestPermission = await checkMicrophonePermission();

      if (!canRequestPermission) {
        // 許可が既に拒否されている場合は、設定ガイドを表示して早期リターン
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInAnonymously();

      if (error) throw error;

      // サインイン成功したら自動サインインを許可
      localStorage.setItem('allowAutoSignIn', 'true');
      setAllowAutoSignIn(true);

      // マイク許可を要求
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // マイクへのアクセスを要求
          await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('マイク許可が成功しました');
          setMicPermissionDenied(false);
        } catch (micError) {
          console.error('マイク許可エラー:', micError);
          // マイク許可拒否の場合、ログアウトして再度スタートからやり直し
          setMicPermissionDenied(true);
          setShowPermissionGuide(true);

          // ログアウト処理
          await supabase.auth.signOut();
          setUser(null); // ユーザー状態をクリア
        }
      }
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

  // リセットして再チャレンジ
  const handleRechallenge = async () => {
    try {
      setIsLoading(true);
      // スタンプコレクションをリセット
      localStorage.removeItem(STORAGE_KEY);
      setCollectedStamps([]);

      if (user) {
        // Supabaseのユーザースタンプをクリア
        await supabase.from('user_stamps').update({ stamps: [] }).eq('user_id', user.id);
        // Completedフラグをリセット
        await supabase.from('users').update({ completed: false }).eq('id', user.id);
      }

      setIsCompleted(false);
      localStorage.setItem('isCompleted', 'false');

      // ユーザー体験向上のためにページをリロード
      window.location.reload();
    } catch (error) {
      console.error('再チャレンジエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 音響検知ボタンのハンドラー
  const handleAudioDetection = async () => {
    console.log('音響検知ボタンがクリックされました。現在のisRec:', isRec);
    await handleSwitchRec();
    // 確実に変更が反映されるよう、少し遅延させてコンソールに状態を出力
    setTimeout(() => {
      console.log('音響検知ボタンクリック後 isRec:', isRec);
    }, 500);
  };

  // リセットALLボタンの関数
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleResetAll = useCallback(async () => {
    const isConfirmed = window.confirm('全てのデータをリセットしますか？この操作は元に戻せません。');
    if (!isConfirmed) return;

    try {
      console.log('全てのデータをリセットします...');

      // リセットフラグを設定
      localStorage.setItem('justReset', 'true');
      sessionStorage.setItem('justReset', 'true');

      // ユーザー状態をクリア
      setUser(null);
      setCollectedStamps([]);
      setIsCompleted(false);
      setAllowAutoSignIn(false);

      // ローカルストレージのクリア - キーを定数として一元管理
      const keysToRemove = [STORAGE_KEY, 'isExchanged', 'isCompleted', 'allowAutoSignIn'];

      // Supabase関連の認証トークンを検出して削除リストに追加
      const supabaseKeyPatterns = ['supabase-auth-token', 'sb-'];

      // セッションとローカルストレージからキーを収集
      [...Object.keys(localStorage), ...Object.keys(sessionStorage)].forEach((key) => {
        if (supabaseKeyPatterns.some((pattern) => key.startsWith(pattern))) {
          if (!keysToRemove.includes(key)) {
            keysToRemove.push(key);
          }
        }
      });

      // すべてのキーを削除
      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      // ユーザーIDがある場合はデータベースもリセット
      if (user?.id) {
        // user_stampsテーブルのリセット
        await supabase.from('user_stamps').upsert(
          {
            user_id: user.id,
            stamps: [],
          },
          {
            onConflict: 'user_id',
          }
        );

        // usersテーブルの存在確認とリセット
        const { data } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();

        if (data) {
          await supabase.from('users').update({ completed: false }).eq('id', user.id);
        }
      }

      // Supabaseからサインアウト
      await supabase.auth.signOut();

      console.log('リセット完了。ページをリロードします...');
      alert('リセットが完了しました。ページをリロードします。');

      // リロード前にリセットフラグをクリア
      setTimeout(() => {
        localStorage.removeItem('justReset');
        sessionStorage.removeItem('justReset');
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('リセット中にエラーが発生しました:', error);
      alert(`リセット中にエラーが発生しました: ${error}`);

      // エラーが発生した場合でもリセットフラグをクリア
      localStorage.removeItem('justReset');
      sessionStorage.removeItem('justReset');
    }
  }, [supabase.auth, user]);

  return (
    <div className='min-h-screen bg-white flex flex-col items-center'>
      <div className='w-full max-w-md mx-auto sm:max-w-lg md:max-w-2xl lg:max-w-3xl relative'>
        {/* メインコンテンツ */}
        <main className='flex-1 flex flex-col items-center mb-12 pb-24 overflow-y-auto w-full'>
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
            {micPermissionDenied && (
              <div className='mt-3 p-2 bg-red-100 text-red-700 rounded-lg border border-red-300'>
                <p className='font-bold'>⚠️ マイク許可が拒否されました</p>
                <p className='text-sm mt-1'>ブラウザの設定からマイク許可を有効にして、再度スタートボタンを押してください。</p>
              </div>
            )}
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

            <div className='grid grid-cols-3 gap-4 md:grid-cols-5'>
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
                        onClick={() => handleSaveStamp(stamp)}
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

        {/* マイク許可のガイドモーダル */}
        {showPermissionGuide && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto'>
            <div className='bg-white p-6 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto my-4'>
              <h3 className='text-xl font-bold mb-4 text-black'>マイク許可の設定方法</h3>
              <p className='mb-4 text-gray-800'>スタンプラリーにはマイク許可が必要です。以下の手順で許可してください：</p>

              <div className='space-y-4 mb-4'>
                <div className='border p-3 rounded-lg bg-gray-50'>
                  <h4 className='font-bold text-black'>iPhoneの場合</h4>
                  <ol className='list-decimal pl-5 text-sm text-gray-800'>
                    <li>設定アプリを開く</li>
                    <li>「Safari」を選択</li>
                    <li>「Webサイト設定」を選択</li>
                    <li>「マイク」を選択し、このサイトを「許可」に設定</li>
                    <li>Safariに戻り、ページを再読み込み</li>
                  </ol>
                </div>

                <div className='border p-3 rounded-lg bg-gray-50'>
                  <h4 className='font-bold text-black'>Androidの場合</h4>
                  <ol className='list-decimal pl-5 text-sm text-gray-800'>
                    <li>Chromeブラウザのアドレスバーの右側の「︙」をタップ</li>
                    <li>「設定」を選択</li>
                    <li>「サイトの設定」を選択</li>
                    <li>「マイク」を選択</li>
                    <li>このサイトを「許可」に設定</li>
                    <li>ブラウザに戻り、ページを再読み込み</li>
                  </ol>
                </div>
              </div>

              <div className='flex justify-end mt-6'>
                <button
                  onClick={() => {
                    setShowPermissionGuide(false);
                    window.location.reload(); // 設定変更後にリロード
                  }}
                  className='px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600'>
                  設定を完了しました
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 音声認識ボタンまたは開始ボタン */}
        <div className='fixed px-4 bottom-4 left-0 right-0 flex justify-center sm:w-auto sm:mx-auto sm:left-1/2 sm:-translate-x-1/2 max-w-md sm:max-w-lg'>
          {user ? (
            isCompleted ? (
              <button
                className={`w-full h-12 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl max-w-sm mx-auto`}
                onClick={handleRechallenge}
                disabled={isLoading}>
                <span className='text-xl'>{isLoading ? '処理中...' : '再チャレンジする'}</span>
              </button>
            ) : (
              <button
                className={`w-full h-12 rounded-full flex items-center justify-center ${
                  isRec ? 'bg-red-500 hover:bg-red-600' : 'bg-[#004ea2] hover:bg-blue-600'
                } text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl ${
                  !location || !!locationError ? 'opacity-50' : ''
                } max-w-sm mx-auto`}
                onClick={handleAudioDetection}
                disabled={!location || !!locationError}>
                <span className='text-xl'>{isRec ? '停止' : '📢 音響検知スタート'}</span>
              </button>
            )
          ) : (
            <button
              onClick={handleAnonymousSignUp}
              disabled={isLoading}
              className='w-full h-12 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl max-w-sm mx-auto'>
              <span className='text-xl'>{isLoading ? '登録中...' : 'スタート'}</span>
            </button>
          )}
        </div>

        {/* すべてリセットボタン - 常に表示 */}
        <div className='fixed top-2 right-2 z-50'>
          <button
            onClick={handleRechallenge}
            className='px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-xs shadow hover:bg-gray-300 transition-colors'>
            すべてリセット
          </button>
        </div>

        {/* スタンプ獲得アニメーション */}
        <AnimatePresence>{newStamp && <StampCollectionAnimation stamp={newStamp} onComplete={() => setNewStamp(null)} />}</AnimatePresence>

        <div className='fixed bottom-20 left-0 right-0 flex justify-center gap-2 z-50 md:gap-4'>
          <button onClick={() => router.push('/complete')} className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded'>
            Test: コンプリート画面へ
          </button>
        </div>
        {/* テスト用: ボタン */}
        {/* コンプリート済みユーザーにのみリセットボタンを表示 */}
        {/* <div className='fixed bottom-20 left-0 right-0 flex justify-center gap-2 z-50 md:gap-4'>
          {isCompleted && (
            <button
              onClick={async () => {
                try {
                  // ユーザーをログアウト
                  const supabase = createClientComponentClient();
                  await supabase.auth.signOut();

                  // すべてのローカルストレージをクリア
                  localStorage.removeItem(STORAGE_KEY);
                  localStorage.removeItem('isExchanged');

                  // 自動サインインを無効化
                  localStorage.setItem('allowAutoSignIn', 'false');
                  setAllowAutoSignIn(false);

                  // Supabaseの認証状態を完全にクリア - すべての可能性のあるキーを削除
                  localStorage.removeItem('supabase.auth.token');
                  localStorage.removeItem('sb-refresh-token');
                  localStorage.removeItem('sb-access-token');
                  localStorage.removeItem('supabase.auth.expires_at');
                  localStorage.removeItem('supabase.auth.refresh_token');
                  localStorage.removeItem('supabase.auth.user');

                  // または、サイト固有のすべてのローカルストレージをクリア
                  Object.keys(localStorage).forEach((key) => {
                    if (key.startsWith('supabase') || key.startsWith('sb-')) {
                      localStorage.removeItem(key);
                    }
                  });

                  // 状態をリセット
                  setCollectedStamps([]);
                  setUser(null);
                  setIsCompleted(false);

                  // 強制的にすべてのキャッシュをクリアして完全にリロード
                  // URLパラメータを使わない方法に変更
                  setTimeout(() => {
                    window.location.href = '/';
                  }, 100);
                } catch (error) {
                  console.error('リセットエラー:', error);
                  // エラーが発生しても強制的にリロード
                  window.location.reload();
                }
              }}
              className='px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded md:px-6 md:py-3 md:text-lg'>
              Test: Reset Stamps
            </button>
          )}
          <button onClick={() => router.push('/complete')} className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded'>
            Test: コンプリート画面へ
          </button>

          <div className='bg-gray-800 text-white px-2 py-1 rounded text-xs'>
            状態: {isCompleted ? 'コンプリート済み' : '未コンプリート'} | ユーザー: {user ? '有り' : '無し'}
          </div>

          {user && (
            <button
              onClick={async () => {
                try {
                  if (!user) return;

                  const newCompletedState = !isCompleted;
                  // ユーザーのコンプリート状態を切り替え
                  await supabase.from('users').update({ completed: newCompletedState }).eq('id', user.id);

                  // 状態を更新
                  setIsCompleted(newCompletedState);
                  localStorage.setItem('isCompleted', newCompletedState.toString());

                  // フィードバック表示
                  alert(`コンプリート状態を「${newCompletedState ? '完了' : '未完了'}」に切り替えました`);
                } catch (error) {
                  console.error('状態切り替えエラー:', error);
                  alert('エラーが発生しました');
                }
              }}
              className='px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded'>
              Test: コンプリート状態切り替え
            </button>
          )}
        </div> */}

        {/* Confetti animation loaded dynamically on client */}
        {showConfetti && <ReactConfetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} />}
      </div>
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
