'use client';

// テストモードの有効/無効を切り替えるための定数です。
// true にするとテスト用の機能が有効になり、デプロイ前には false に変更します。

import Image from 'next/image';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { STAMPS } from '@/lib/stamps';
import DownloadIcon from '@/components/DownloadIcon';
import dynamic from 'next/dynamic';

// SSRを無効にしてRouletteWheelをインポート
const RouletteWheel = dynamic(() => import('@/components/RouletteWheel'), {
  ssr: false,
});

/**
 * スタンプラリーコンプリートページコンポーネント。
 * スタンプラリーを全て完了したユーザーに表示されます。
 * - お祝いのアニメーション (花火)
 * - 収集した全スタンプの表示と、個別の保存・共有機能
 * - コンプリート画像の保存・共有機能
 * - 景品交換の状態管理と、交換処理の実行
 * - トップページへの導線
 */
export default function CompletePage() {
  // Supabaseクライアントインスタンスはインポート済み
  // 収集済みのスタンプIDの配列を保持するstate
  const [collectedStamps, setCollectedStamps] = useState<number[]>([]);
  // スタンプ画像の共有処理が実行中かどうかを示すstate
  const [isSharingStamp, setIsSharingStamp] = useState(false);
  // コンプリート画像のダウンロード/共有処理が実行中かどうかを示すstate
  const [isDownloading, setIsDownloading] = useState(false);
  // 現在処理中 (保存/共有) のスタンプIDを保持するstate
  const [processingStampId, setProcessingStampId] = useState<number | null>(null);
  // クーポンが使用済みかどうかを示すstate。ローカルストレージから初期値を読み込みます。
  const [isExchanged, setIsExchanged] = useState<boolean>(() => {
    try {
      const exchanged = localStorage.getItem('isCouponUsed');
      return exchanged === 'true';
    } catch {
      return false;
    }
  });
  // ローディング状態 (景品交換処理など) を示すstate
  const [isLoading, setIsLoading] = useState(false);
  // 景品交換の確認ダイアログを表示するかどうかを制御するstate
  const [showConfirmation, setShowConfirmation] = useState(false);
  // 現在ログインしているユーザーのIDを保持するstate
  const [userId, setUserId] = useState<string | null>(null);
  // ルーレットを回したかどうかを示すstate
  const [hasSpunRoulette] = useState<boolean>(() => {
    try {
      const spun = localStorage.getItem('hasSpunRoulette');
      return spun === 'true';
    } catch {
      return false;
    }
  });
  // ルーレットで当たった賞品
  const [wonPrize, setWonPrize] = useState<string | null>(null);
  // ルーレットを表示するかどうか
  const [showRoulette, setShowRoulette] = useState(false);

  /**
   * useEffectフック: コンポーネントマウント時およびSupabaseクライアントインスタンス変更時に実行。
   * ログインユーザーの情報を取得し、そのユーザーの収集済みスタンプデータと
   * 景品交換済み (completed) 状態をSupabaseデータベースから読み込みます。
   * - ユーザー情報 (ID) を userId state にセットします。
   * - 収集済みスタンプのID配列を collectedStamps state にセットします。
   * - 景品交換済み状態を isExchanged state およびローカルストレージにセットします。
   * - 途中でエラーが発生した場合はコンソールに出力します。
   */
  useEffect(() => {
    const loadUserAndStamps = async () => {
      try {
        // まずローカルストレージからデータを読み込む（即座に表示）
        const localStamps = localStorage.getItem('collectedStamps');
        if (localStamps) {
          try {
            const parsed = JSON.parse(localStamps);
            setCollectedStamps(parsed);
          } catch (e) {
            console.error('ローカルストレージのパースエラー:', e);
          }
        }

        // クーポン使用状態もローカルストレージから読み込む
        const localCouponUsed = localStorage.getItem('isCouponUsed');
        if (localCouponUsed === 'true') {
          setIsExchanged(true);
        }

        // Supabaseからユーザー情報取得を試みる
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          console.log('Supabase認証なし - ローカルモードで動作');
          // ローカルユーザーIDを生成（クーポン使用のため）
          const localUserId = localStorage.getItem('localUserId') || `local-user-${Date.now()}`;
          localStorage.setItem('localUserId', localUserId);
          setUserId(localUserId);
          return;
        }

        setUserId(user.id);

        // Supabaseからデータ取得を試みる（エラーがあってもローカルデータは保持）
        try {
          // user_stampsテーブルからスタンプとis_redeemedを取得
          const { data: stampData, error } = await supabase.from('user_stamps').select('stamps, is_redeemed').eq('user_id', user.id).maybeSingle();

          if (error && error.code === 'PGRST116') {
            // レコードが存在しない場合は作成
            console.log('user_stampsレコードが存在しないため作成します');
            const localStamps = localStorage.getItem('collectedStamps');
            const stamps = localStamps ? JSON.parse(localStamps) : [];

            await supabase.from('user_stamps').insert({
              user_id: user.id,
              stamps: stamps,
              is_completed: stamps.length === 4,
              is_redeemed: false,
            });
          } else if (stampData) {
            if (stampData.stamps) {
              setCollectedStamps(stampData.stamps);
            }

            // user_stampsテーブルからis_redeemedを確認
            if (stampData.is_redeemed !== undefined) {
              setIsExchanged(stampData.is_redeemed);
              localStorage.setItem('isCouponUsed', stampData.is_redeemed.toString());
            }
          }
        } catch (dbError) {
          console.error('Supabaseデータベースエラー:', dbError);
          // データベースエラーがあってもローカルデータで続行
        }
      } catch (error) {
        console.error('ユーザーデータ読み込みエラー:', error);
        // エラー時もローカルユーザーIDを設定
        const localUserId = localStorage.getItem('localUserId') || `local-user-${Date.now()}`;
        localStorage.setItem('localUserId', localUserId);
        setUserId(localUserId);
      }
    };

    loadUserAndStamps();
  }, []);

  /**
   * 「クーポンを使用する」ボタンがクリックされたときの処理。
   * クーポン使用の確認ダイアログ (showConfirmation state) を表示します。
   */
  const handleExchange = () => {
    setShowConfirmation(true);
  };

  /**
   * ルーレットを回す処理
   */
  const handleSpinRoulette = () => {
    setShowRoulette(true);
  };

  /**
   * ルーレット完了時の処理
   */
  const handleRouletteComplete = (prize: string) => {
    console.log(`Complete page received prize: "${prize}"`);
    console.log(`Prize includes ハズレ: ${prize.includes('ハズレ')}`);
    console.log(`Prize === '😢 ハズレ': ${prize === '😢 ハズレ'}`);
    
    setWonPrize(prize);

    setTimeout(() => {
      // ハズレの場合は別のメッセージ
      if (prize.includes('ハズレ')) {
        alert(`残念でした！\n\n😢 ハズレ 😢\n\nまた次回チャレンジしてください！`);
      } else {
        alert(`おめでとうございます！\n\n🎉 ${prize} 🎉\n\n受付でこの画面をお見せください。`);
      }
      setShowRoulette(false);
    }, 500);
  };

  /**
   * クーポン使用の確認ダイアログで「使用する」ボタンがクリックされたときの非同期処理。
   * - ユーザーIDが存在しない場合はエラーをログに出力して処理を中断します。
   * - isLoading state を true に設定し、ローディング状態にします。
   * - Supabaseの 'users' テーブルで、該当ユーザーの 'completed' カラムを true に更新 (またはレコードを新規作成) します。
   * - isExchanged state を true に更新し、ローカルストレージにも保存します。
   *   また、'isCompleted' もローカルストレージで true に設定し、スタンプラリー全体の完了状態を整合させます。
   * - 処理中にエラーが発生した場合はコンソールに出力します。
   * - 処理完了後 (成功・失敗問わず) に isLoading state を false に戻します。
   */
  const confirmExchange = async () => {
    if (!userId) {
      console.error('ユーザーIDが見つかりません');
      // ローカルユーザーIDを再生成
      const localUserId = `local-user-${Date.now()}`;
      localStorage.setItem('localUserId', localUserId);
      setUserId(localUserId);
    }

    setShowConfirmation(false);
    setIsLoading(true);

    try {
      // まずローカルストレージを更新（ユーザー体験優先）
      setIsExchanged(true);
      localStorage.setItem('isCouponUsed', 'true');
      localStorage.setItem('isCompleted', 'true');
    } catch (storageError) {
      console.error('ローカルストレージへの保存に失敗:', storageError);
      alert('クーポン使用状態を端末に保存できませんでした。ページの再読み込みで正しい状態が表示されるか確認してください。');
    }

    // バックグラウンドでSupabaseを更新（エラーがあってもユーザー体験に影響しない）
    if (userId) {
      supabase
        .from('user_stamps')
        .update({ is_redeemed: true })
        .eq('user_id', userId)
        .then(({ error }) => {
          if (error) {
            console.error('Supabase更新エラー（バックグラウンド）:', error);
          }
        });
    }

    setIsLoading(false);
  };

  /**
   * コンプリート画像 (complete_image.JPG) を保存または共有する非同期関数。
   * - isDownloading state を使用して、同時に複数の処理が実行されるのを防ぎます。
   * - 画像をフェッチし、Blobオブジェクトとして取得します。
   * - navigator.share API (Web Share API) が利用可能なモバイル環境では、共有ダイアログを表示します。
   *   - ユーザーが共有をキャンセルした場合は、エラーとして扱わず静かに処理を終了します。
   *   - 共有APIの使用中にその他のエラーが発生した場合は、それをスローして上位のcatchブロックで処理させます。
   * - 共有APIが利用できない環境 (デスクトップブラウザなど) では、画像をファイルとしてダウンロードするフォールバック処理を行います。
   * - 処理中に発生したエラーは包括的にcatchし、エラーの種類に応じたフレンドリーなメッセージをalertでユーザーに通知します。
   * - 処理完了後 (成功・失敗問わず)、isDownloading stateを少し遅延させてからfalseに戻します。
   */
  const handleDownload = async () => {
    // 既に処理中なら早期リターン
    if (isDownloading) {
      // console.log('画像の共有処理が進行中です。しばらくお待ちください。');
      return;
    }

    try {
      setIsDownloading(true);

      const imagePath = '/images/complete_special.png';
      const res = await fetch(imagePath);
      if (!res.ok) {
        const errorDetail = `コンプリート画像の取得に失敗しました (HTTP ${res.status})。ファイルが見つからないか、ネットワークに問題がある可能性があります。`;
        console.error(errorDetail);
        alert(errorDetail);
        throw new Error(errorDetail);
      }

      const blob = await res.blob();
      const file = new File([blob], 'shachihata_zoo_complete.jpg', { type: blob.type });

      // モバイルでの共有APIをサポートしているかチェック
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const canUseShareAPI = isMobile && typeof navigator.share === 'function' && navigator.canShare && navigator.canShare({ files: [file] });

      // デバイスタイプと共有API対応状況の確認

      if (canUseShareAPI) {
        try {
          await navigator.share({
            files: [file],
            title: 'シヤチハタ動物園 スタンプラリーコンプリート',
            text: 'シヤチハタ動物園スタンプラリーをコンプリートしました！🎉',
          });
          // コンプリート画像共有成功
        } catch (shareError) {
          // キャンセルの場合は静かに終了
          if (
            shareError instanceof Error &&
            (shareError.name === 'AbortError' || shareError.name === 'NotAllowedError' || shareError.message.toLowerCase().includes('cancel'))
          ) {
            console.log('完了画像共有: キャンセルされました');
            return; // alertは表示しない
          }
          console.error('完了画像共有API使用エラー:', shareError);
          throw shareError; // キャンセル以外のエラーは下位のエラーハンドラに渡す
        }
      } else {
        // 共有APIが使えない場合は通常のダウンロード処理
        console.info('モバイルブラウザ限定サービスですが、Web Share APIが利用できませんでした。ダウンロード処理にフォールバックします。');
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
      console.error('コンプリート画像保存/共有エラー:', e);

      let userMessage = '画像の保存/共有中に不明なエラーが発生しました。';
      if (e instanceof Error) {
        if (e.message.includes('HTTP')) {
          // fetch失敗時の自作エラーメッセージ
          userMessage = e.message;
        } else if (e.name === 'AbortError' || e.message.toLowerCase().includes('cancel')) {
          // このパスは上のcatchでreturnされるため通常到達しないが念のため
          console.log('共有操作がキャンセルされました（下位catch）。');
          return;
        } else {
          // エラータイプ別のメッセージ
          const friendlyErrorMessage: Record<string, string> = {
            NetworkError: 'ネットワーク接続に問題があります。接続を確認して再度お試しください。',
            SecurityError: 'セキュリティ上の理由で処理を実行できませんでした。ブラウザの設定を確認してください。',
            QuotaExceededError: '端末の保存領域が不足しています。不要なデータを削除してください。',
            InvalidStateError: '前回の操作がまだ完了していません。時間をおいて再度お試しください。',
            default: '画像の保存/共有中にエラーが発生しました。しばらくしてから再試行してください。',
          };
          userMessage = friendlyErrorMessage[e.name] || friendlyErrorMessage.default;
        }
      }
      alert(userMessage);
    } finally {
      // 少し遅延させて共有状態をリセット
      setTimeout(() => {
        setIsDownloading(false);
      }, 1000);
    }
  };

  /**
   * 収集した個別のスタンプ画像を保存または共有する非同期関数。
   * - isSharingStamp state および processingStampId state を使用して、処理の重複を防ぎ、どのスタンプが処理中かを示します。
   * - 指定されたスタンプの画像URLから画像をフェッチし、Blobオブジェクトとして取得します。
   * - navigator.share API が利用可能な場合はそれを使用し、そうでない場合はダウンロード処理にフォールバックします。
   *   （詳細なロジックは handleDownload 関数と類似しています。）
   * - エラーハンドリングも handleDownload 関数と類似の方法で行われます。
   * - 処理完了後、isSharingStamp および processingStampId state をリセットします。
   * @param stamp 保存または共有するスタンプオブジェクト。(STAMPS配列の要素と同じ型)
   */
  const handleSaveStamp = async (stamp: (typeof STAMPS)[number]) => {
    if (isSharingStamp) {
      // console.log('他のスタンプの共有処理が進行中です。しばらくお待ちください。');
      return;
    }

    try {
      setIsSharingStamp(true);
      setProcessingStampId(stamp.id);

      const res = await fetch(stamp.image);
      if (!res.ok) {
        const errorDetail = `${stamp.name}のスタンプ画像の取得に失敗しました (HTTP ${res.status})。ファイルが見つからないか、ネットワークに問題がある可能性があります。`;
        console.error(errorDetail);
        alert(errorDetail);
        throw new Error(errorDetail);
      }

      const blob = await res.blob();
      const file = new File([blob], 'stamp_' + stamp.name + '.jpg', { type: blob.type });

      // モバイルでの共有APIをサポートしているかチェック
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const canUseShareAPI = isMobile && typeof navigator.share === 'function' && navigator.canShare && navigator.canShare({ files: [file] });

      // デバイスタイプと共有API対応状況の確認

      if (canUseShareAPI) {
        try {
          await navigator.share({
            files: [file],
            title: `${stamp.name}のスタンプ`,
            text: `シヤチハタ動物園「${stamp.name}」のスタンプを獲得しました！`,
          });
          // スタンプ共有成功
        } catch (shareError) {
          // キャンセルの場合は静かに終了
          if (
            shareError instanceof Error &&
            (shareError.name === 'AbortError' || shareError.name === 'NotAllowedError' || shareError.message.toLowerCase().includes('cancel'))
          ) {
            console.log(`${stamp.name}のスタンプ共有: キャンセルされました`);
            return; // alertは表示しない
          }
          console.error(`${stamp.name}のスタンプ共有API使用エラー:`, shareError);
          throw shareError; // キャンセル以外のエラーは下位のエラーハンドラに渡す
        }
      } else {
        // 共有APIが使えない場合は通常のダウンロード処理
        console.info(`モバイルブラウザ限定サービスですが、Web Share APIが利用できませんでした。${stamp.name}のスタンプをダウンロードします。`);
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
      console.error(`${stamp.name}のスタンプ保存/共有エラー:`, e);

      let userMessage = `${stamp.name}のスタンプの保存/共有中に不明なエラーが発生しました.`;
      if (e instanceof Error) {
        if (e.message.includes('HTTP')) {
          userMessage = e.message;
        } else if (e.name === 'AbortError' || e.message.toLowerCase().includes('cancel')) {
          // このパスは上のcatchでreturnされるため通常到達しないが念のため
          console.log(`${stamp.name}のスタンプ共有操作がキャンセルされました（下位catch）。`);
          return;
        } else {
          const friendlyErrorMessage: Record<string, string> = {
            NetworkError: 'ネットワーク接続に問題があります。接続を確認して再度お試しください。',
            SecurityError: 'セキュリティ上の理由で処理を実行できませんでした。ブラウザの設定を確認してください。',
            QuotaExceededError: '端末の保存領域が不足しています。不要なデータを削除してください。',
            InvalidStateError: '前回の操作がまだ完了していません。時間をおいて再度お試しください。',
            default: '画像の保存/共有中にエラーが発生しました。しばらくしてから再試行してください。',
          };
          userMessage = friendlyErrorMessage[e.name] || friendlyErrorMessage.default;
        }
      }
      alert(userMessage);
    } finally {
      setTimeout(() => {
        setIsSharingStamp(false);
        setProcessingStampId(null);
      }, 1000);
    }
  };

  return (
    <div className='min-h-screen bg-white px-4 py-8'>
      <div className='flex items-center w-full mb-6'>
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
          <span className='text-4xl'>🦁</span>
        </motion.div>
        <div className='flex flex-col'>
          <div className='text-gray-600 text-xl font-bold relative z-0'>
            <span className='relative inline-block'>おめでとうございます 🎉</span>
          </div>
          <p className='text-gray-600 text-sm'>
            全ての音声スタンプを集めました！
            <br />
            記念画像はこちら👇
          </p>
        </div>
      </div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className='relative overflow-hidden transform-gpu hover:shadow-3xl transition-all mb-6'
        style={{
          perspective: '1000px',
          transformStyle: 'preserve-3d',
        }}>
        <div
          className='p-4 bg-gradient-to-r from-green-100 via-yellow-100 to-green-100 border-8 border-green-600 rounded-2xl'
          style={{
            boxShadow: '0 15px 30px rgba(34, 197, 94, 0.3), 0 10px 15px rgba(34, 197, 94, 0.2)',
            transform: 'rotateX(5deg)',
            transformStyle: 'preserve-3d',
          }}>
          <div className='p-2 relative' style={{ transform: 'translateZ(20px)' }}>
            <Image
              src='/images/complete_special.png'
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

      <div className='flex gap-4 flex-wrap justify-center mb-8'>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`px-8 py-4 bg-green-500 text-white text-lg rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-3 ${isDownloading ? 'opacity-80 cursor-wait' : ''}`}
          style={{ backgroundColor: '#22c55e' }}>
          {isDownloading ? (
            <svg className='w-6 h-6 animate-pulse' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
            </svg>
          ) : (
            <DownloadIcon />
          )}
          {isDownloading ? 'ダウンロード中...' : 'コンプリート画像を保存'}
        </button>
      </div>

      {/* 30%OFFクーポン */}
      <div className='w-full mb-8 bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-xl shadow-xl border-2 border-orange-200'>
        <h3 className='text-xl font-bold text-center text-orange-600 mb-4'>🎉 コンプリート特典 🎉</h3>
        <p className='text-gray-700 text-center mb-6'>売店でご利用いただける30%OFFクーポンをプレゼント！</p>

        <div className='flex justify-center mb-6'>
          <div className='relative'>
            <Image src='/images/coupon.png' alt='30%OFFクーポン' width={360} height={270} className='rounded-lg shadow-lg' />
            {isExchanged && (
              <div className='absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center'>
                <div className='bg-white px-6 py-3 rounded-full shadow-lg'>
                  <span className='text-lg font-bold text-green-600'>✓ 使用済み</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className='text-sm text-gray-600 text-center mb-4'>売店にてこの画面を係員にお見せください</p>

        <div className='bg-gray-100 p-4 rounded-lg border border-gray-300'>
          <p className='text-sm text-gray-600 text-center mb-2'>↓係員用 使用確認ボタン</p>
          <p className='text-xs text-red-600 text-center mb-4'>来園者様自身で操作しないでください</p>

          {!isExchanged ? (
            <button
              onClick={handleExchange}
              disabled={isLoading}
              className={`w-full px-8 py-3 rounded-full shadow-lg transition-all hover:shadow-xl active:scale-95 flex items-center justify-center gap-2 ${
                isLoading ? 'bg-yellow-500 cursor-wait' : 'bg-red-500 hover:bg-red-600'
              } text-white`}>
              {isLoading ? (
                <>
                  <svg className='w-5 h-5 animate-spin' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                    />
                  </svg>
                  <span>処理中...</span>
                </>
              ) : (
                <span>クーポンを使用する</span>
              )}
            </button>
          ) : (
            <div className='w-full px-8 py-3 bg-gray-300 text-gray-600 rounded-full text-center'>✓ クーポン使用済み</div>
          )}
        </div>

        {isExchanged && <p className='text-sm text-green-600 text-center mt-4 font-semibold'>素敵なお買い物ありがとうございました！</p>}
      </div>

      {/* エクストラボーナスセクション */}
      <div className='w-full mb-8 bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl shadow-xl border-2 border-purple-200'>
        <h3 className='text-xl font-bold text-center text-purple-600 mb-4'>🎰 エクストラボーナス 🎰</h3>
        <p className='text-gray-700 text-center mb-6'>
          さらに特別なプレゼントが当たる
          <br />
          チャンス！
        </p>

        {!showRoulette ? (
          <>
            <motion.div
              className='flex justify-center mb-4'
              whileHover={!hasSpunRoulette ? { scale: 1.05 } : {}}
              whileTap={!hasSpunRoulette ? { scale: 0.95 } : {}}>
              {!hasSpunRoulette ? (
                <button
                  onClick={handleSpinRoulette}
                  className='px-12 py-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-md font-bold rounded-full shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3'>
                  <span className='text-2xl'>🎲</span>
                  <span className='text-md'>ルーレットを回す</span>
                  <span className='text-2xl'>🎯</span>
                </button>
              ) : (
                <div className='px-12 py-6 bg-gray-300 text-gray-600 text-xl font-bold rounded-full shadow-lg flex items-center gap-3'>
                  <span className='text-2xl'>✅</span>
                  <span>ルーレット済み</span>
                  <span className='text-2xl'>🎁</span>
                </div>
              )}
            </motion.div>

            {wonPrize && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-6 rounded-lg shadow-lg border-2 ${
                  wonPrize === '😢 ハズレ'
                    ? 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-300'
                    : 'bg-gradient-to-r from-purple-100 to-pink-100 border-purple-300'
                }`}>
                <p className={`text-center text-xl font-bold mb-3 ${wonPrize === '😢 ハズレ' ? 'text-gray-700' : 'text-purple-700'}`}>
                  {wonPrize === '😢 ハズレ' ? '😢 残念！ 😢' : '🎊 獲得した賞品 🎊'}
                </p>
                <div className='bg-white p-4 rounded-md shadow-inner'>
                  <p className='text-center text-2xl mb-2'>{wonPrize}</p>
                  {wonPrize !== '😢 ハズレ' && <p className='text-center text-sm text-gray-600'>受付でこの画面をお見せください</p>}
                  {wonPrize === '😢 ハズレ' && <p className='text-center text-sm text-gray-600'>また次回チャレンジしてください！</p>}
                </div>
                {wonPrize !== '😢 ハズレ' && <p className='text-center text-sm text-purple-600 mt-3 font-semibold'>受付でこの画面をお見せください</p>}
              </motion.div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className='flex justify-center'>
            <RouletteWheel onSpinComplete={handleRouletteComplete} />
          </motion.div>
        )}

        <p className='text-sm text-gray-600 text-center mt-4'>※ おひとり様1回限り</p>
      </div>

      <div className='w-full mb-8'>
        <p className='text-gray-600 text-center text-lg font-semibold mb-4'>🎬 シヤチハタ動物園の魅力をご紹介！</p>
        <div className='bg-gradient-to-br from-green-50 to-blue-50 p-6 rounded-xl shadow-md'>
          <p className='text-gray-700 text-center mb-4'>かわいい動物たちが待っています 🐘🦒🐧</p>
          <p className='text-gray-600 text-sm text-center'>また遊びに来てくださいね！</p>
        </div>
      </div>

      <div className='mb-8 shadow-lg rounded-lg p-4 w-full'>
        <h3 className='text-black text-md font-bold text-center mb-4'>✨ スタンプコレクション ✨</h3>
        <div className='grid grid-cols-5 gap-4'>
          {collectedStamps.map((id) => {
            const stamp = STAMPS.find((s) => s.id === id);
            if (!stamp) return null;

            // 各スタンプ専用の処理中フラグを保持する状態変数
            const isThisStampSharing = isSharingStamp && processingStampId === stamp.id;

            return (
              <div
                key={id}
                className={`flex aspect-square rounded-md overflow-hidden relative ${isThisStampSharing ? 'opacity-90 cursor-wait' : 'cursor-pointer active:scale-95'} transition-all duration-200`}
                onClick={() => !isSharingStamp && handleSaveStamp(stamp)}>
                <Image src={stamp.image} alt={stamp.name} width={100} height={100} className='object-cover w-full h-full' />
                {isThisStampSharing ? (
                  <div className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-50'>
                    <svg className='w-8 h-8 text-white animate-pulse' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                      />
                    </svg>
                  </div>
                ) : (
                  <div className='absolute inset-0 flex items-center justify-center'>
                    <svg className='w-8 h-8 text-white opacity-25' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                      />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className='flex justify-center mb-8'>
        <Link
          href='/'
          className='px-8 py-3 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 transition-all hover:shadow-xl active:scale-95'>
          ホームに戻る
        </Link>
      </div>

      {/* 確認アラート */}
      {showConfirmation && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white p-6 rounded-xl shadow-xl max-w-sm w-full'>
            <h3 className='text-black text-lg font-bold mb-4'>クーポン使用の確認</h3>
            <p className='mb-6 text-gray-600'>このクーポンを使用しますか？</p>
            <div className='flex justify-end gap-3'>
              <button onClick={() => setShowConfirmation(false)} className='px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400'>
                キャンセル
              </button>
              <button onClick={confirmExchange} className='px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600'>
                使用する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ルーレットモーダル */}
      {showRoulette && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className='fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4'>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className='bg-white p-8 rounded-2xl shadow-2xl max-w-lg w-full relative'>
            <button onClick={() => setShowRoulette(false)} className='absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl'>
              ✕
            </button>
            <h3 className='text-2xl font-bold text-center text-purple-600 mb-6'>🎰 エクストラボーナスルーレット 🎰</h3>
            <RouletteWheel onSpinComplete={handleRouletteComplete} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
