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
import { useEFP2, EFPErrorType } from '@/hooks/useEFP2';
import Image from 'next/image';
import { STAMPS } from '@/lib/stamps';

// ローカルストレージキー
const STORAGE_KEY = 'collectedStamps';

// テストモード設定 - 環境変数で制御
const TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

// 開発環境の設定確認 - 本番環境では無効化

// エラータイプ定義
type ErrorType = 'NetworkError' | 'DatabaseError' | 'LocalStorageError' | 'PermissionError' | 'UnknownError';

// 安全な操作の結果型
type SafeResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: ErrorType;
};

// 安全なローカルストレージ操作
const safeLocalStorage = {
  get: (key: string): SafeResult<string> => {
    try {
      const value = localStorage.getItem(key);
      return { success: true, data: value || undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: 'LocalStorageError' as ErrorType,
      };
    }
  },

  set: (key: string, value: string): SafeResult<void> => {
    try {
      localStorage.setItem(key, value);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: 'LocalStorageError' as ErrorType,
      };
    }
  },

  remove: (key: string): SafeResult<void> => {
    try {
      localStorage.removeItem(key);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorType: 'LocalStorageError' as ErrorType,
      };
    }
  },
};

// エラー監視とログ記録
const errorMonitor = {
  log: (error: string, context: string, errorType: ErrorType = 'UnknownError') => {
    try {
      const timestamp = new Date().toISOString();
      const errorLog = {
        timestamp,
        error,
        context,
        errorType,
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      // ローカルストレージに蓄積（分析用）
      const logs = safeLocalStorage.get('errorLogs');
      const existingLogs = logs.success && logs.data ? JSON.parse(logs.data) : [];
      existingLogs.push(errorLog);

      // 最新100件のみ保持
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }

      safeLocalStorage.set('errorLogs', JSON.stringify(existingLogs));
    } catch {
      // エラーログ記録自体のエラーは無視
    }
  },

  clear: () => {
    safeLocalStorage.remove('errorLogs');
  },
};

// 自動復旧メカニズム
const autoRecovery = {
  // 状態の自動バックアップ
  backupState: (stamps: number[], completed: boolean) => {
    try {
      const backup = {
        stamps,
        completed,
        timestamp: Date.now(),
      };
      safeLocalStorage.set('stateBackup', JSON.stringify(backup));
    } catch (e) {
      errorMonitor.log(String(e), 'State backup failed', 'LocalStorageError');
    }
  },

  // 状態の復元
  restoreState: (): SafeResult<{ stamps: number[]; completed: boolean } | null> => {
    try {
      const backup = safeLocalStorage.get('stateBackup');
      if (backup.success && backup.data) {
        const parsed = JSON.parse(backup.data);
        const isRecent = Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000; // 24時間以内

        if (isRecent && Array.isArray(parsed.stamps) && typeof parsed.completed === 'boolean') {
          return { success: true, data: { stamps: parsed.stamps, completed: parsed.completed } };
        }
      }
      return { success: true, data: null };
    } catch (e) {
      errorMonitor.log(String(e), 'State restore failed', 'LocalStorageError');
      return { success: false, error: String(e), errorType: 'LocalStorageError' };
    }
  },

  // アプリケーション状態のリセット
  resetToSafeState: () => {
    try {
      const keysToReset = [STORAGE_KEY, 'isCompleted', 'stateBackup'];
      keysToReset.forEach((key) => safeLocalStorage.remove(key));

      // ページリロード
      setTimeout(() => window.location.reload(), 1000);
      return { success: true };
    } catch (e) {
      errorMonitor.log(String(e), 'Safe state reset failed', 'UnknownError');
      return { success: false, error: String(e), errorType: 'UnknownError' };
    }
  },
};

// グローバルエラーハンドラー
const setupGlobalErrorHandlers = () => {
  // 未処理のエラーをキャッチ
  window.addEventListener('error', (event) => {
    errorMonitor.log(event.error?.message || event.message, 'Global error handler', 'UnknownError');
  });

  // Promise rejection をキャッチ
  window.addEventListener('unhandledrejection', (event) => {
    errorMonitor.log(String(event.reason), 'Unhandled promise rejection', 'UnknownError');
    event.preventDefault(); // エラーの伝播を防ぐ
  });
};

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  // const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  // const [locationError, setLocationError] = useState<string | null>(null);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  // isCompletedはローカルストレージとの同期にのみ使用し、表示条件はcollectedStamps.lengthで判断
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

  // 本番環境と同じように環境変数を使用
  // 一時的にハードコード（本番環境での緊急対応）
  const APIKEY = 'eMaYe9yDYUY2wQWsCnlUehaiTjAmpP9KRm9nx4apBnL3E6VhL51E8qCOD+K6sva3EtboAQQ9a0Zq2YFbmOOyDa1vEhBxAPSGkuGYErAjFiTdGx20X9go8f+Q0YvCkD+Xq1gqu4Ks1/qaGD7M/J6UKzHo9NqEGj+ah55c9vL206Rs4hXcgTn9L2K9SunHh1wDAsdA704RbTnzRNQ2bqSIKblf63VFZEBkwdb/DEU+l04XXwXyGEjV1n69Dy31ZIoB';

  // APIキーの検証
  useEffect(() => {
    // APIキー確認 (本番環境デバッグ) - コンソールログを削除
    
    if (!APIKEY) {
      // EFP2 APIキーが設定されていません
      alert('APIキーが設定されていません。管理者に連絡してください。');
    }
  }, []);

  const { meta, isRec, handleSwitchRec, error: efpError } = useEFP2(APIKEY);

  // EFPエラーの監視
  useEffect(() => {
    if (efpError) {
      // EFPエラーを検出
      // マイク切断エラーの場合は自動的に録音を停止
      if (efpError.type === EFPErrorType.StreamStopFailed || efpError.message.includes('マイクが切断されました')) {
        if (isRec) {
          // マイク切断を検出したため録音を停止
          // isRecの状態は既にfalseになっているはずなので、UIの更新のみ
        }
      }
    }
  }, [efpError, isRec]);

  // グローバルエラーハンドラーの設定
  useEffect(() => {
    setupGlobalErrorHandlers();
  }, []);

  const [collectedStamps, setCollectedStamps] = useState<number[]>(() => {
    const stored = safeLocalStorage.get(STORAGE_KEY);
    if (stored.success && stored.data) {
      try {
        const parsed = JSON.parse(stored.data);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        errorMonitor.log(String(e), 'CollectedStamps initialization parse error', 'LocalStorageError');
        return [];
      }
    }
    return [];
  });
  // collectedStampsが更新されるたび、localStorageにも保存
  useEffect(() => {
    const saveResult = safeLocalStorage.set(STORAGE_KEY, JSON.stringify(collectedStamps));

    if (!saveResult.success) {
      errorMonitor.log(saveResult.error || 'Unknown localStorage error', 'CollectedStamps save failed', 'LocalStorageError');

      // プライベートモード検出の改善
      let isPrivateMode = false;
      try {
        const testKey = '__private_mode_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
      } catch {
        isPrivateMode = true;
      }

      if (isPrivateMode) {
        alert('プライベートブラウジングモードではスタンプラリーのデータを保存できません。通常モードでご利用ください。');
      } else {
        alert('データの保存に失敗しました。端末の空き容量を確認してください。');
      }
    } else {
      // 成功時はバックアップも作成
      autoRecovery.backupState(collectedStamps, isCompleted);
    }
  }, [collectedStamps, isCompleted]);

  // 定期的なヘルスチェック
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      try {
        // ローカルストレージの健全性チェック
        const testResult = safeLocalStorage.set('health_check', Date.now().toString());
        if (!testResult.success) {
          errorMonitor.log('LocalStorage health check failed', 'Health check', 'LocalStorageError');
        } else {
          safeLocalStorage.remove('health_check');
        }

        // 状態の整合性チェック
        if (collectedStamps.length > STAMPS.length) {
          errorMonitor.log('Invalid stamp count detected', 'State integrity check', 'UnknownError');
          // 自動修正
          setCollectedStamps((prev) => prev.slice(0, STAMPS.length));
        }
      } catch (e) {
        errorMonitor.log(String(e), 'Health check execution failed', 'UnknownError');
      }
    }, 30000); // 30秒間隔

    return () => clearInterval(healthCheckInterval);
  }, [collectedStamps.length]); // スタンプ数が変わったときに再実行

  const [newStamp, setNewStamp] = useState<(typeof STAMPS)[0] | null>(null);
  const [isProcessingStamp, setIsProcessingStamp] = useState(false); // 重複処理防止用

  // 位置情報の取得（1回だけ）
  // useEffect(() => {
  //   if (!navigator.geolocation) {
  //     setLocationError('位置情報が利用できません');
  //     return;
  //   }

  //   navigator.geolocation.getCurrentPosition(
  //     (position) => {
  //       setLocation({
  //         latitude: position.coords.latitude,
  //         longitude: position.coords.longitude,
  //       });
  //     },
  //     (error) => {
  //       console.error('位置情報エラー:', error);
  //       setLocationError('位置情報の取得に失敗しました');
  //     }
  //   );
  // }, []);

  // Supabaseとの同期を試みる関数（非ブロッキング）
  const syncWithSupabase = useCallback(
    async (userId: string, stamps: number[], isCompleted: boolean) => {
      // バックグラウンドで非同期に実行、エラーがあってもゲームは継続
      try {
        await supabase.from('user_stamps').upsert(
          {
            user_id: userId,
            stamps: stamps,
            is_completed: isCompleted,
          },
          { onConflict: 'user_id' }
        );
      } catch (error) {
        // エラーは記録するだけで、ゲームには影響させない
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
      return () => {};
    }

    // 自動サインインが許可されていない場合は何もしない
    if (!allowAutoSignIn) {
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
          localStorage.removeItem('justReset');
          sessionStorage.removeItem('justReset');
          setUser(null);
          return;
        }

        // 自動サインインが無効の場合はセッションを使用しない
        if (!allowAutoSignIn) {
          setUser(null);
          return;
        }

        if (session) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      } catch {
        // セッション読み込みエラーは無視
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
        return;
      }

      const hasUser = !!session?.user;

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

  // 定期的なSupabaseへのバックアップ（30秒ごと）
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      const completed = collectedStamps.length === STAMPS.length;
      // 非ブロッキングでバックアップ
      syncWithSupabase(user.id, collectedStamps, completed);
    }, 30000); // 30秒ごと

    return () => clearInterval(intervalId);
  }, [user, collectedStamps, syncWithSupabase]);

  // Supabaseからのデータ取得を試みる（ローカルストレージが優先）
  useEffect(() => {
    if (!user) return;

    // 非同期でSupabaseからデータを取得するが、ローカルストレージのデータを優先
    const tryFetchFromSupabase = async () => {
      try {
        const { data, error } = await supabase.from('user_stamps').select('stamps, is_completed').eq('user_id', user.id).maybeSingle();

        if (!error && data) {
          // ローカルストレージにデータがない場合のみSupabaseのデータを使用
          const localStamps = safeLocalStorage.get(STORAGE_KEY);
          if (!localStamps.success || !localStamps.data) {
            if (data.stamps) {
              setCollectedStamps(data.stamps);
              safeLocalStorage.set(STORAGE_KEY, JSON.stringify(data.stamps));
            }
            if (data.is_completed !== undefined) {
              setIsCompleted(data.is_completed);
              safeLocalStorage.set('isCompleted', data.is_completed.toString());
            }
          }
        }
      } catch (error) {
        // Supabaseエラーは無視して、ローカルで継続
        // Supabase fetch failed, using local data
      }
    };

    // 非ブロッキングで実行
    tryFetchFromSupabase();
  }, [user, supabase]);

  // collectedStampsの変更をバックグラウンドでSupabaseに同期
  useEffect(() => {
    if (!user) return;

    // デバウンスタイマーを使用して、頻繁な更新を避ける
    const timer = setTimeout(() => {
      const completed = collectedStamps.length === STAMPS.length;
      // 非ブロッキングでSupabaseに同期
      syncWithSupabase(user.id, collectedStamps, completed);
    }, 1000); // 1秒後に同期

    return () => clearTimeout(timer);
  }, [collectedStamps, user, syncWithSupabase]);

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
      // パーミッション確認エラー
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

      // マイク許可を先に要求
      let micPermissionGranted = false;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // マイクへのアクセスを要求
          await navigator.mediaDevices.getUserMedia({ audio: true });
          // マイク許可が成功しました
          setMicPermissionDenied(false);
          micPermissionGranted = true;
        } catch (micError) {
          // マイク許可エラー
          setMicPermissionDenied(true);
          setShowPermissionGuide(true);
          setIsLoading(false);
          return; // マイク許可がないなら認証しない
        }
      }

      // マイク許可が得られたら認証処理
      if (micPermissionGranted) {
        // Supabase設定を確認
        try {
          const { data, error } = await supabase.auth.signInAnonymously();

          if (error) {
            // 認証エラーの処理

            // エラーの詳細をログに記録
            errorMonitor.log(error.message || 'Unknown auth error', 'Anonymous sign-in failed', 'NetworkError');

            // より具体的なエラーメッセージを表示
            let errorMessage = 'ログインに失敗しました。';

            if (error.message?.includes('Invalid API key')) {
              errorMessage =
                'Supabase APIキーが無効です。\n\nSupabaseダッシュボードから最新のanon keyを取得して、.env.localファイルのNEXT_PUBLIC_SUPABASE_ANON_KEYを更新してください。';
              // Supabase Anon Key が無効です

              // ローカルモードで続行
              // Supabase認証に失敗したため、ローカルモードで動作
              const dummyUserId = `local-user-${Date.now()}`;
              setUser({ id: dummyUserId } as User);

              // サインイン成功したら自動サインインを許可
              localStorage.setItem('allowAutoSignIn', 'true');
              setAllowAutoSignIn(true);

              // 音声認識を開始
              await handleSwitchRec();
              return;
            } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
              errorMessage = 'ネットワーク接続を確認してください。Wi-Fiまたはモバイルデータが有効になっているか確認してください。';
            } else if (error.message?.includes('rate limit')) {
              errorMessage = 'アクセスが集中しています。しばらく待ってから再度お試しください。';
            } else if (error.message?.includes('CORS') || error.message?.includes('blocked')) {
              errorMessage = 'セキュリティ設定により接続がブロックされています。別のブラウザでお試しください。';
            } else if (error.message?.includes('Anonymous sign-ins are disabled')) {
              errorMessage = 'システム設定エラーが発生しました。管理者にお問い合わせください。';
            } else {
              errorMessage = `エラーが発生しました: ${error.message || '不明なエラー'}\n\nページを再読み込みしてもう一度お試しください。`;
            }

            alert(errorMessage);
            setIsLoading(false);
            return;
          }

          // 認証成功
          // 認証成功
          
          // user_stampsテーブルに初期レコードを作成
          if (data.user) {
            try {
              await supabase.from('user_stamps').upsert({
                user_id: data.user.id,
                stamps: [],
                is_completed: false,
                is_redeemed: false
              }, { onConflict: 'user_id' });
              // user_stamps初期レコード作成成功
            } catch (error) {
              // user_stamps初期レコード作成エラー
              // エラーがあっても継続
            }
          }

          // サインイン成功したら自動サインインを許可
          localStorage.setItem('allowAutoSignIn', 'true');
          setAllowAutoSignIn(true);

          // 音声認識を開始
          await handleSwitchRec();
        } catch {
          // 予期しないエラー - ローカルモードで継行
          const dummyUserId = `local-user-${Date.now()}`;
          setUser({ id: dummyUserId } as User);

          // サインイン成功したら自動サインインを許可
          localStorage.setItem('allowAutoSignIn', 'true');
          setAllowAutoSignIn(true);

          // 音声認識を開始
          await handleSwitchRec();
        }
      }
    } catch {
      alert('エラーが発生しました。再度試してください。');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!meta || isProcessingStamp) return;

    // EFP検出時のメタデータをログ出力
    // EFP検出 - メタデータを処理

    try {
      const matchedStamp = STAMPS.find((stamp) => stamp.meta === meta);
      // マッチング結果を確認

      if (matchedStamp && !collectedStamps.includes(matchedStamp.id)) {
        setIsProcessingStamp(true); // 処理中フラグをセット
        // 新しいスタンプを追加
        // 安全にスタンプを追加
        const updatedStamps = [...collectedStamps, matchedStamp.id];
        setCollectedStamps(updatedStamps);
        setNewStamp(matchedStamp);

        // 処理完了後にフラグをリセット
        setTimeout(() => setIsProcessingStamp(false), 1000);

        // バックアップ作成
        autoRecovery.backupState(updatedStamps, updatedStamps.length === STAMPS.length);


        // 全てのスタンプを集めた場合
        if (updatedStamps.length === STAMPS.length) {
          try {
            // 少し待ってからコンプリートページに遷移
            setTimeout(async () => {
              try {
                // 遷移前にレコーディングを停止
                if (isRec) {
                  // コンプリートページへの遷移前にレコーディングを停止
                  await handleSwitchRec();
                }

                router.push('/complete');
              } catch (e) {
                errorMonitor.log(String(e), 'Failed to navigate to complete page', 'UnknownError');
                // 遷移できない場合も静かに失敗
              }
            }, 2000);
          } catch (error) {
            errorMonitor.log(String(error), 'Failed to setup completion navigation', 'UnknownError');
            // エラーが発生してもスタンプ収集は継続
          }
        }
      }
    } catch (error) {
      errorMonitor.log(String(error), 'Critical stamp processing error', 'UnknownError');
      // 重大なエラーが発生した場合は自動復旧を試みる
      const recovery = autoRecovery.restoreState();
      if (recovery.success && recovery.data) {
        setCollectedStamps(recovery.data.stamps);
        setIsCompleted(recovery.data.completed);
      }
    }
  }, [meta, collectedStamps, router, handleSwitchRec, isRec, isProcessingStamp]);

  // 音響検知ボタンのハンドラー
  const handleAudioDetection = useCallback(async () => {
    // 音響検知ボタンがクリックされました
    try {
      await handleSwitchRec();
      // 確実に変更が反映されるよう、少し遅延させてコンソールに状態を出力
      setTimeout(() => {
        // 音響検知ボタンクリック後の状態を確認
      }, 500);
    } catch (error) {
      // 音声認識エラー
      // エラータイプに応じたメッセージを表示
      if (efpError) {
        if (efpError.type === EFPErrorType.PermissionDenied) {
          alert('マイクへのアクセスが拒否されました。\n\nブラウザの設定でマイクの使用を許可してから、もう一度お試しください。');
          setShowPermissionGuide(true);
        } else if (efpError.type === EFPErrorType.StreamStopFailed || efpError.message.includes('マイクが切断されました')) {
          alert('マイクの接続が切れました。\n\nもう一度「音声検知スタート」ボタンを押してください。');
        } else {
          alert(`音声認識エラー: ${efpError.message}\n\nページを再読み込みしてから、もう一度お試しください。`);
        }
      } else {
        alert('音声認識の開始に失敗しました。\n\nページを再読み込みしてから、もう一度お試しください。');
      }
    }
  }, [isRec, handleSwitchRec, efpError]);

  // スタンプ保存ハンドラー
  const [isSharingStamp, setIsSharingStamp] = useState(false);

  const handleSaveStamp = useCallback(
    async (stamp: (typeof STAMPS)[number]) => {
      // 既に共有操作が進行中なら早期リターン
      if (isSharingStamp) {
        // 他のスタンプの共有処理が進行中
        return;
      }

      try {
        setIsSharingStamp(true);

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
        // エラータイプ別のメッセージ
        const friendlyErrorMessage = {
          NetworkError: '画像の読み込みに失敗しました。ネットワーク接続を確認してください。',
          SecurityError: 'セキュリティ上の理由でダウンロードできません。',
          QuotaExceededError: '端末の空き容量が不足しています。',
          default: '画像の保存中にエラーが発生しました。しばらくしてから再試行してください。',
        };

        // ユーザーに通知
        const errorKey = e instanceof Error ? e.name : 'default';
        const message = friendlyErrorMessage[errorKey as keyof typeof friendlyErrorMessage] || friendlyErrorMessage.default;
        alert(message);
      } finally {
        // 少し遅延させて共有状態をリセット（UI操作に余裕を持たせる）
        setTimeout(() => {
          setIsSharingStamp(false);
        }, 250);
      }
    },
    [isSharingStamp]
  );

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

      // 全てのデータをリセット

      // リセットフラグを設定
      localStorage.setItem('justReset', 'true');
      sessionStorage.setItem('justReset', 'true');

      // ユーザー状態をクリア
      setUser(null);
      setCollectedStamps([]);
      setIsCompleted(false);
      setAllowAutoSignIn(false);

      // ローカルストレージのクリア - キーを定数として一元管理
      const keysToRemove = [STORAGE_KEY, 'isExchanged', 'isCompleted', 'allowAutoSignIn', 'isCouponUsed', 'hasSpunRoulette', 'localUserId'];

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
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (e) {
          // キー削除中にエラーが発生
        }
      });

      // ユーザーIDがある場合はデータベースもリセット
      if (user?.id) {
        try {
          // user_stampsテーブルのリセット
          await supabase.from('user_stamps').upsert(
            {
              user_id: user.id,
              stamps: [],
              is_completed: false,
              is_redeemed: false,
            },
            {
              onConflict: 'user_id',
            }
          );
        } catch (dbError) {
          // データベースリセット中にエラー
        }
      }

      // Supabaseからサインアウト
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        // サインアウト中にエラー
      }

      // リセット完了。ページをリロード
      alert('リセットが完了しました。最初からやり直します。');

      // リロード前にリセットフラグをクリア
      setTimeout(() => {
        localStorage.removeItem('justReset');
        sessionStorage.removeItem('justReset');
        window.location.reload();
      }, 500);
    } catch (error) {
      // 再チャレンジエラー
      alert('リセット中にエラーが発生しました。ページをリロードします。');
      // エラーが発生しても強制的にリロード
      window.location.reload();
    } finally {
      setIsLoading(false);
    }
  };

  // リセットALLボタンの関数
  const handleResetAll = useCallback(async () => {
    const isConfirmed = window.confirm('全てのデータをリセットしますか？この操作は元に戻せません。');
    if (!isConfirmed) return;

    try {
      // 全てのデータをリセット

      // リセットフラグを設定
      localStorage.setItem('justReset', 'true');
      sessionStorage.setItem('justReset', 'true');

      // ユーザー状態をクリア
      setUser(null);
      setCollectedStamps([]);
      setIsCompleted(false);
      setAllowAutoSignIn(false);

      // ローカルストレージのクリア - キーを定数として一元管理
      const keysToRemove = [STORAGE_KEY, 'isExchanged', 'isCompleted', 'allowAutoSignIn', 'isCouponUsed', 'hasSpunRoulette', 'localUserId'];

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
            is_completed: false,
            is_redeemed: false,
          },
          {
            onConflict: 'user_id',
          }
        );
      }

      // Supabaseからサインアウト
      await supabase.auth.signOut();

      // リセット完了。ページをリロード
      alert('リセットが完了しました。ページをリロードします。');

      // リロード前にリセットフラグをクリア
      setTimeout(() => {
        localStorage.removeItem('justReset');
        sessionStorage.removeItem('justReset');
        window.location.reload();
      }, 500);
    } catch (error) {
      // リセット中にエラー
      alert(`リセット中にエラーが発生しました: ${error}`);

      // エラーが発生した場合でもリセットフラグをクリア
      localStorage.removeItem('justReset');
      sessionStorage.removeItem('justReset');
    }
  }, [supabase, user]);

  // useEffectでisCompletedの更新ロジックを追加
  useEffect(() => {
    // スタンプが10個集まった場合はisCompletedをtrueに設定
    if (collectedStamps.length === STAMPS.length && !isCompleted && user) {
      setIsCompleted(true);
      localStorage.setItem('isCompleted', 'true');

      // バックグラウンドでSupabaseにも反映（エラーがあってもゲームは継続）
      if (user) {
        syncWithSupabase(user.id, collectedStamps, true);
      }
    }
  }, [collectedStamps, isCompleted, user, supabase, syncWithSupabase]);

  return (
    <div className='min-h-screen bg-gradient-to-b from-orange-50 via-white to-yellow-50 flex flex-col'>
      <main className='flex-1 flex flex-col items-center overflow-y-auto w-full md:pb-0 pb-24 px-4 relative'>
        {/* 浮遊するアニメーション要素 */}
        <motion.div
          className='absolute top-20 left-4 text-4xl pointer-events-none'
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}>
          🎈
        </motion.div>
        <motion.div
          className='absolute top-40 right-4 text-3xl pointer-events-none'
          animate={{
            y: [0, 20, 0],
            x: [0, -10, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}>
          ⭐
        </motion.div>
        <motion.div
          className='absolute bottom-32 left-8 text-3xl pointer-events-none md:bottom-20'
          animate={{
            y: [0, -15, 0],
            rotate: [-20, 20, -20],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}>
          🎆
        </motion.div>
        <motion.div
          className='w-full -mx-4 overflow-hidden shadow-lg hover:shadow-xl transition-shadow'
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}>
          <Image src='/images/hero1.png' alt='top' width={2048} height={1000} className='w-full h-auto object-cover' />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className='w-full bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-orange-300 text-gray-700 px-4 py-3 rounded-xl relative mx-auto max-w-full shadow-md'
          role='alert'>
          <div className='flex items-center mb-2'>
            <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className='text-2xl mr-2'>
              🎪
            </motion.span>
            <p className='text-lg font-bold text-orange-600'>ご来園のお客様へご案内</p>
          </div>
          <div className='space-y-1'>
            <p className='text-sm flex items-start'>
              <span className='text-lg mr-2'>①</span>
              <span>
                動物の近くや園内各所で
                <span className='font-bold text-lg text-[#004ea2] mx-1'>「スタートボタン」</span>
                を押してください。
              </span>
            </p>
            <p className='text-sm flex items-start'>
              <span className='text-lg mr-2'>②</span>
              <span>マイクの使用を許可してください</span>
            </p>
            <p className='text-sm flex items-start'>
              <span className='text-lg mr-2'>③</span>
              <span>
                下部のボタンが<span className='font-bold text-red-600 text-lg mx-1'>「赤い停止ボタン」</span>に変わっていることを確認してください
              </span>
            </p>
            <p className='text-sm flex items-start'>
              <span className='text-lg mr-2'>④</span>
              <span>音声を検知中はブラウザから移動しないでください</span>
            </p>
            <p className='text-sm flex items-start'>
              <span className='text-lg mr-2'>⑤</span>
              <span>ブラウザのプライベートモードではスタンプを取得できません</span>
            </p>
          </div>
        </motion.div>

        {/* スタンプと線路のグリッド */}
        <motion.div
          className='w-full max-w-2xl my-4 p-4 bg-white shadow-lg rounded-2xl'
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}>
          {/* かわいいタイトル */}
          <div className='flex mb-6 items-center justify-center'>
            <motion.div className='flex items-center' initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5 }}>
              <motion.span
                className='text-4xl mr-2'
                animate={{
                  y: [0, -5, 0],
                  rotate: [-10, 10, -10],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: 'easeInOut',
                }}>
                🦁
              </motion.span>
              <motion.div
                className='bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent'
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                style={{ backgroundSize: '200% 200%' }}>
                <h2 className='text-lg font-bold'>スタンプコンプリートで</h2>
                <p className='text-sm font-semibold'>限定画像・クーポンをGET！</p>
              </motion.div>
              <motion.span
                className='text-4xl ml-2'
                animate={{
                  y: [0, -5, 0],
                  rotate: [10, -10, 10],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: 'easeInOut',
                  delay: 0.5,
                }}>
                🎆
              </motion.span>
            </motion.div>
          </div>

          <motion.div className='grid grid-cols-2 gap-4' initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
            {STAMPS.map((stamp, index) => (
              <div key={stamp.id} className='relative rounded-md overflow-hidden'>
                {/* 線路の描画（最後のスタンプ以外） */}
                {index < STAMPS.length - 1 && (
                  <motion.div
                    className='absolute top-1/2 left-[calc(100%_-_8px)] w-[calc(100%_+_16px)] h-2 -z-10 track-bg'
                    initial={{ scaleX: 0, transformOrigin: 'left' }}
                    animate={{ scaleX: collectedStamps.includes(stamp.id) && collectedStamps.includes(STAMPS[index + 1].id) ? 1 : 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  />
                )}

                {/* スタンプ */}
                <motion.div
                  className={`aspect-square rounded-md overflow-hidden group relative`}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: 'spring', stiffness: 300 }}>
                  <Image
                    src={stamp.image}
                    alt={stamp.name}
                    fill
                    className={`object-cover transition-opacity duration-300 ${collectedStamps.includes(stamp.id) ? 'opacity-100' : 'opacity-5'}`}
                  />
                  {collectedStamps.includes(stamp.id) ? (
                    <>
                      <motion.div
                        className='absolute -top-2 -right-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center text-white font-bold text-xs shadow-md'
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 10 }}>
                        ✓
                      </motion.div>
                      <button
                        onClick={() => handleSaveStamp(stamp)}
                        className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300'>
                        <DownloadIcon className='w-6 h-6 text-white opacity-0 group-hover:opacity-100' />
                      </button>
                    </>
                  ) : (
                    <div className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300'>
                      <motion.span
                        className='text-gray-500 text-4xl font-bold opacity-70'
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 3 }}>
                        ❓
                      </motion.span>
                    </div>
                  )}
                </motion.div>

                {/* エリア名 */}
                <div className='text-center mt-1'>
                  <motion.span
                    className={`${collectedStamps.includes(stamp.id) ? 'text-green-600 font-bold' : 'text-gray-500'}`}
                    style={{ fontSize: '10px', lineHeight: 0.8 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.1 }}>
                    {stamp.name}
                    {collectedStamps.includes(stamp.id) && ' ✓'}
                  </motion.span>
                </div>
              </div>
            ))}

            {/* コンプリートページへボタン - 尾張旭まち案内の右横に配置 */}
            {collectedStamps.length === STAMPS.length && (
              <div className='relative rounded-md overflow-hidden'>
                <motion.button
                  onClick={async () => {
                    // 遷移前にレコーディングを停止
                    if (isRec) {
                      // コンプリートページへの遷移前にレコーディングを停止
                      await handleSwitchRec();
                    }
                    router.push('/complete');
                  }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className='aspect-square rounded-md overflow-hidden bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white font-bold shadow-lg hover:shadow-xl transition-all flex flex-col items-center justify-center p-2 relative group'>
                  <div className='absolute inset-0 bg-gradient-to-br from-yellow-400 via-pink-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
                  <motion.span
                    className='text-2xl mb-1 z-10'
                    animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 4, repeatDelay: 2 }}>
                    🎉
                  </motion.span>
                  <span className='text-center text-xs z-10'>
                    コンプリート
                    <br />
                    ページへ
                  </span>
                  <svg
                    className='w-4 h-4 mt-1 z-10'
                    fill='none'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    viewBox='0 0 24 24'
                    stroke='currentColor'>
                    <path d='M13 7l5 5m0 0l-5 5m5-5H6'></path>
                  </svg>
                </motion.button>
                {/* ダミーのエリア名スペース（レイアウト調整用） */}
                <div className='text-center'>
                  <span className='text-transparent' style={{ fontSize: '10px', lineHeight: 0.8 }}>
                    　
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* マイク許可のガイドモーダル */}
        {showPermissionGuide && micPermissionDenied && (
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
        <div className='fixed px-8 bottom-4 left-0 right-0 flex justify-center md:relative md:bottom-auto md:mt-8 md:mb-4 md:px-0'>
          {user ? (
            collectedStamps.length === STAMPS.length ? (
              <button
                className='w-full h-12 md:h-16 rounded-full flex items-center justify-center bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl max-w-sm md:max-w-none mx-auto relative overflow-hidden group'
                onClick={handleRechallenge}
                disabled={isLoading}>
                <motion.span className='text-xl flex items-center' animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  {isLoading ? '処理中...' : '🔄 再チャレンジする'}
                </motion.span>
              </button>
            ) : (
              <button
                className={`w-full h-12 md:h-16 rounded-md flex items-center justify-center ${
                  isRec
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 animate-pulse'
                    : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600'
                } text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl max-w-sm md:max-w-none mx-auto relative overflow-hidden group`}
                onClick={handleAudioDetection}>
                <motion.span
                  className='text-xl flex items-center'
                  animate={isRec ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 1 }}>
                  {isRec ? '⏹️ 停止' : '🎤 音声検知スタート'}
                </motion.span>
              </button>
            )
          ) : (
            <button
              onClick={handleAnonymousSignUp}
              disabled={isLoading}
              className='w-full h-12 md:h-16 rounded-md flex items-center justify-center bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl max-w-sm md:max-w-none mx-auto relative overflow-hidden group'>
              <div className='absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300' />
              <motion.span className='text-xl flex items-center' whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {isLoading ? '登録中...' : '🎈 スタート'}
              </motion.span>
            </button>
          )}
        </div>

        {/* すべてリセットボタン - 常に表示 */}
        <motion.div
          className='fixed top-2 right-2 z-50 md:absolute'
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1 }}>
          <button
            onClick={handleResetAll}
            className='px-3 py-1 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800 rounded-full text-xs shadow hover:from-gray-300 hover:to-gray-400 transition-all transform hover:scale-105'>
            🔄 リセット
          </button>
        </motion.div>

        {/* スタンプ獲得アニメーション */}
        <AnimatePresence>{newStamp && <StampCollectionAnimation stamp={newStamp} onComplete={() => setNewStamp(null)} />}</AnimatePresence>


        {/* テスト用: スタンプ数操作ボタン */}
        {TEST_MODE && (
          <div className='fixed bottom-20 left-0 right-0 flex justify-center gap-2 z-50 flex-wrap md:relative md:bottom-auto md:mt-4 md:mb-4'>

            <button
              onClick={() => {
                // 4個のスタンプを全て設定
                const allStamps = [...Array(STAMPS.length)].map((_, i) => i + 1);
                setCollectedStamps(allStamps);

                localStorage.setItem(STORAGE_KEY, JSON.stringify(allStamps));

                if (user) {
                  supabase
                    .from('user_stamps')
                    .upsert({ user_id: user.id, stamps: allStamps }, { onConflict: 'user_id' })
                    .then(({ error }) => {
                      if (error) {
                        // スタンプ保存エラー
                      } else {
                        // テスト用：4個のスタンプを設定しました
                      }
                    });
                }

                // isCompletedも更新
                setIsCompleted(true);
                localStorage.setItem('isCompleted', 'true');

                // 自動遷移処理（本来のスタンプ収集時と同じ挙動に）
                try {
                  // スタンプ獲得アニメーションが表示されない場合は短い遅延で十分
                  setTimeout(async () => {
                    try {
                      // 遷移前にレコーディングを停止
                      if (isRec) {
                        // コンプリートページへの遷移前にレコーディングを停止
                        await handleSwitchRec();
                      }

                      // コンプリートページへ自動遷移
                      router.push('/complete');
                    } catch (e) {
                      // ページ遷移エラー
                    }
                  }, 1500);
                } catch (error) {
                  // コンプリートページ遷移エラー
                }
              }}
              className='px-4 py-2 md:px-6 md:py-3 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-md'>
              テスト: 全スタンプを設定
            </button>

            <button
              onClick={() => {
                // スタンプをリセット
                setCollectedStamps([]);
                localStorage.setItem(STORAGE_KEY, JSON.stringify([]));

                if (user) {
                  supabase
                    .from('user_stamps')
                    .upsert({ user_id: user.id, stamps: [] }, { onConflict: 'user_id' })
                    .then(({ error }) => {
                      if (error) {
                        // スタンプリセットエラー
                      } else {
                        // テスト用：スタンプをリセットしました
                      }
                    });
                }
              }}
              className='px-4 py-2 md:px-6 md:py-3 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-md'>
              テスト: スタンプリセット
            </button>
          </div>
        )}

        {/* Confetti animation loaded dynamically on client */}
        {showConfetti && <ReactConfetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} />}
      </main>
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
        .catch((err) => {
          // Lottie JSON 読み込みエラー
        });
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
          initial={{ scale: 0, rotate: 0 }}
          animate={{
            scale: [0, 1.5, 1],
            rotate: [0, 360, 720],
          }}
          transition={{
            duration: 1.5,
            ease: 'easeOut',
          }}
          className='text-8xl'>
          🎊
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
          <div className='absolute inset-0 opacity-0 animate-stamp rounded-2xl' />
          <Image src={stamp.image} alt={stamp.name} width={320} height={320} className='rounded-2xl shadow-2xl' />
        </motion.div>
      )}
    </div>
  );
};
