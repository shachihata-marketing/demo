'use client';
// Next.js の dynamic import を使用して、クライアントサイドでのみ読み込むコンポーネントを指定します。
// これにより、サーバーサイドレンダリング (SSR) 時にはこれらのコンポーネントは読み込まれず、
// ブラウザ環境でのみ動作するライブラリ (例: windowオブジェクトを参照するもの) を安全に使用できます。
import dynamic from 'next/dynamic';

// react-confetti ライブラリをクライアントサイドでのみ動的にインポートします。
// ssr: false オプションはサーバーサイドレンダリングを無効にすることを意味します。
const ReactConfetti = dynamic(() => import('react-confetti'), { ssr: false });

// lottie-react ライブラリをクライアントサイドでのみ動的にインポートします。
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Reactのコア機能 (useEffect, useState, useCallback, useRef) をインポートします。
// useEffect: 副作用フック。コンポーネントのライフサイクルや特定の値の変更に応じて処理を実行します。
// useState: 状態管理フック。コンポーネント内で状態を保持し、更新します。
// useCallback: メモ化されたコールバック関数を返すフック。不要な再レンダリングを防ぎます。
// useRef: DOM要素への参照や、レンダリング間で値を保持するためのフック。
import React, { useEffect, useState, useCallback, useRef } from 'react';

// framer-motion ライブラリから、アニメーション関連のコンポーネントをインポートします。
// motion: HTML要素にアニメーションを追加するための基本コンポーネント。
// AnimatePresence: 要素の追加・削除時にアニメーションを適用するためのコンポーネント。
import { motion, AnimatePresence } from 'framer-motion';

// Next.js のルーティング機能 (useRouter) をインポートします。
import { useRouter } from 'next/navigation';

// Supabase のクライアントサイド用 Auth Helpers (認証支援ライブラリ) をインポートします。
// これにより、ブラウザ環境でSupabaseの認証機能を容易に扱えます。
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Supabase の User 型情報をインポートします。型安全な開発に役立ちます。
import type { User } from '@supabase/auth-helpers-nextjs';

// カスタムフック useEFP2 と、そこで使用されるエラー型 (EFPError, EFPErrorType) をインポートします。
// useEFP2 は音響フィンガープリント認識機能を提供します。
import { useEFP2, EFPError, EFPErrorType } from '@/hooks/useEFP2';

// Next.js の Image コンポーネントをインポートします。画像の最適化や遅延読み込み機能を提供します。
import Image from 'next/image';

// スタンプラリーで使用するスタンプの情報 (STAMPS) をインポートします。
import { STAMPS } from '@/lib/stamps';
import DownloadIcon from '@/components/DownloadIcon'; // 追加
import ErrorDisplay from '@/components/ErrorDisplay'; // 追加

// ローカルストレージにデータを保存する際のキー名を定義した定数です。
// これにより、キー名を一元管理し、タイポによるエラーを防ぎます。
const STORAGE_KEY = 'collectedStamps';

// テストモードの有効/無効を切り替えるための定数です。
// true にするとテスト用の機能が有効になり、デプロイ前には false に変更します。
const TEST_MODE = false; // デプロイ前に false に変更

// Homeコンポーネント (このページのメインコンポーネント) の定義です。
export default function Home() {
  // Next.js のルーターインスタンスを取得します。ページ遷移などに使用します。
  const router = useRouter();
  // Supabase のクライアントサイド用クライアントインスタンスを作成します。
  // これを通じてデータベース操作や認証処理を行います。
  const supabase = createClientComponentClient();
  // 音響フィンガープリントSDK (useEFP2フック) に渡すAPIキーです。
  // 本番環境では環境変数など、より安全な方法で管理することが推奨されます。
  // --- State定義ここから ---
  // アプリケーションの主要なローディング状態を管理するstate。
  // データのフェッチ中など、ユーザー操作を一時的にブロックしたい場合にtrueにします。初期値はfalse。
  const [isLoading, setIsLoading] = useState(false);
  // 現在ログインしているユーザーの情報を保持するstate。
  // SupabaseのUser型、または未ログイン時はnull。初期値はnull。
  const [user, setUser] = useState<User | null>(null);
  // マイクの使用許可が拒否されたかどうかを示すstate。
  // trueの場合、ユーザーに許可を促すUIを表示するなどの制御に使います。初期値はfalse。
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  // マイク許可設定のガイドを表示するかどうかを管理するstate。
  // マイクが拒否された際に、設定方法の案内を表示するためにtrueにします。初期値はfalse。
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  // スタンプラリーをコンプリートしたかどうかを示すstate。
  // ローカルストレージから初期値を読み込みます。読み込みに失敗した場合はfalse。
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isCompleted') === 'true';
    } catch {
      return false;
    }
  });
  // 自動サインインを許可するかどうかを示すstate。
  // ローカルストレージやセッションストレージの設定、またはリセット状態に基づいて初期値を決定します。
  const [allowAutoSignIn, setAllowAutoSignIn] = useState<boolean>(() => {
    try {
      // ローカルストレージで 'allowAutoSignIn' が 'false' なら自動サインイン無効
      const lsDisabled = localStorage.getItem('allowAutoSignIn') === 'false';
      // セッションストレージで 'allowAutoSignIn' が 'false' なら自動サインイン無効
      const ssDisabled = sessionStorage.getItem('allowAutoSignIn') === 'false';
      // 'justReset' が 'true' (リセット直後) なら自動サインイン無効
      const justReset = localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true';
      // 上記いずれかの条件に当てはまらなければ自動サインインを許可 (true)
      return !(lsDisabled || ssDisabled || justReset);
    } catch {
      // ローカルストレージアクセスエラー時はデフォルトで許可 (true)
      return true;
    }
  });

  // --- カスタムフックの利用 ---
  // useEFP2 カスタムフックを呼び出し、音響認識に必要な機能や状態を取得します。
  // meta: 認識された音響パターンのメタデータ (nullまたは文字列)。
  // isRec: 現在録音中 (音響認識処理中) かどうかを示すブール値。
  // handleSwitchRec: 録音の開始/停止をトグルする非同期関数。
  // error: useEFP2フック内部で発生したエラー情報 (EFPError型またはnull)。efpPluginErrorとしてエイリアス。
  // setError: useEFP2フック内部のエラー状態を更新する関数。efpPluginErrorとしてエイリアス。
  const { meta, isRec, handleSwitchRec, error: efpPluginError, setError: setEfpPluginError } = useEFP2();

  // UI層で表示するために加工・管理されるエラー情報を保持するstate。
  // useEFP2からのエラー(efpPluginError)や、UI操作起因のエラーなどをここにセットします。
  const [displayedError, setDisplayedError] = useState<EFPError | null>(null);

  // useEffectフック: isRec (録音状態) の変更をコンソールに出力します (デバッグ用)。
  // このuseEffectは、isRecの値が変わるたびに実行されます。
  // 本番環境では削除またはコメントアウトすることが望ましいです。
  useEffect(() => {
    // console.log('Page component: isRec state changed:', isRec); // デバッグ用なので削除
  }, [isRec]); // 依存配列に isRec を指定

  // useEffectフック: collectedStamps (収集済みスタンプ) の初期値をローカルストレージから読み込みます。
  // コンポーネントのマウント時に一度だけ実行されます。
  // ローカルストレージからの読み込みに失敗した場合は空の配列 [] を初期値とします。
  const [collectedStamps, setCollectedStamps] = useState<number[]>(() => {
    try {
      // ローカルストレージから STORAGE_KEY ('collectedStamps') で保存された値を取得
      const stored = localStorage.getItem(STORAGE_KEY);
      // 値が存在すればJSONとしてパースし、そうでなければ空配列を返す
      return stored ? JSON.parse(stored) : [];
    } catch {
      // 例外発生時 (パース失敗など) は空配列を返す
      return [];
    }
  });

  // useEffectフック: collectedStamps stateが変更されるたびに、その内容をローカルストレージに保存します。
  // これにより、ユーザーがページを再読み込みしたりブラウザを閉じたりしても、獲得したスタンプの情報が保持されます。
  useEffect(() => {
    try {
      // collectedStamps配列をJSON文字列に変換してローカルストレージに保存
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectedStamps));
    } catch (e) {
      // ローカルストレージへの書き込みに失敗した場合のエラー処理
      console.error('localStorage書き込みエラー:', e); // これは残す価値あり
      // プライベートブラウジングモードかどうかを判定 (localStorageがnullになる場合がある)
      const isPrivateMode = !window.localStorage;
      if (isPrivateMode) {
        alert('プライベートブラウジングモードではスタンプラリーのデータを保存できません。通常モードでご利用ください。');
      } else {
        alert('データの保存に失敗しました。端末の空き容量を確認してください。');
      }
    }
  }, [collectedStamps]); // 依存配列に collectedStamps を指定

  // 新しくスタンプを獲得した際に、そのスタンプ情報を一時的に保持するstate。
  // スタンプ獲得時のアニメーション表示などに使用されます。初期値はnull。
  const [newStamp, setNewStamp] = useState<(typeof STAMPS)[0] | null>(null);
  // 8個目のスタンプを獲得した際にお祝いメッセージを表示するためのstate。
  // 初期値はfalse。
  const [showEightStampsMessage, setShowEightStampsMessage] = useState(false);

  /* eslint-disable react-hooks/exhaustive-deps */
  const checkCompletedStatus = useCallback(
    async (userId: string) => {
      try {
        // console.log('Checking completed status for user:', userId); // デバッグ用なので削除
        // 'user_stamps'テーブルから該当ユーザーのスタンプ情報を取得
        const { data: stampData } = await supabase.from('user_stamps').select('stamps').eq('user_id', userId).single();
        // 全スタンプを収集済みかどうかの判定
        const collectedAll = stampData?.stamps && Array.isArray(stampData.stamps) && stampData.stamps.length === STAMPS.length;

        // 'users'テーブルから該当ユーザーの情報を取得 (存在しない場合も考慮してmaybeSingle)
        const { data: userData } = await supabase.from('users').select('id, completed').eq('id', userId).maybeSingle();
        let dbCompleted = false; // DB上のコンプリート状態

        if (userData) {
          // ユーザーレコードが存在する場合
          dbCompleted = userData.completed || false;
          if (collectedAll && !dbCompleted) {
            // 全スタンプ収集済みで、DB上は未完了の場合、DBを更新
            // console.log('全スタンプ収集済み。completedをtrueに更新します'); // デバッグ用なので削除
            const { error: updateError } = await supabase.from('users').upsert({ id: userId, completed: true }).eq('id', userId);
            if (updateError) throw updateError; // 更新エラー時は例外スロー
            dbCompleted = true;
          }
        } else {
          // ユーザーレコードが存在しない場合、新規作成
          // console.log('ユーザーレコードが存在しないため新規作成します'); // デバッグ用なので削除
          const { error: insertError } = await supabase.from('users').insert({ id: userId, completed: collectedAll });
          if (insertError) throw insertError; // 挿入エラー時は例外スロー
          dbCompleted = collectedAll;
        }
        // console.log('Database completed status:', dbCompleted); // デバッグ用なので削除
        // ローカルのisCompleted stateとローカルストレージをDBの状態に合わせる
        setIsCompleted(dbCompleted);
        localStorage.setItem('isCompleted', dbCompleted.toString());
      } catch (error) {
        // エラー発生時はコンソールに出力（ユーザー通知は状況に応じて検討）
        console.error('コンプリート状態確認エラー:', error); // これは残す価値あり
      }
    },
    [supabase] // supabaseクライアントインスタンスが変更されたら再生成 (通常は初回のみ)
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  // useEffectフック: ユーザー認証状態の監視とセッション管理を行います。
  // - allowAutoSignInがtrueの場合、マウント時にセッションを読み込もうとします。
  // - 認証状態の変更 (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED) を監視し、user stateを更新します。
  // - リセット直後 (justResetフラグがtrue) の場合は認証処理をスキップします。
  useEffect(() => {
    let unmounted = false; // コンポーネントがアンマウントされたかを示すフラグ
    // リセット直後かどうかを判定するヘルパー関数
    const isJustReset = () => {
      return localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true';
    };

    if (isJustReset()) {
      // リセット直後は認証状態監視をスキップ
      // console.log('自動サインイン無効のため、認証状態監視をスキップします'); // デバッグ用なので削除
      return () => {}; // クリーンアップ関数は空
    }
    if (!allowAutoSignIn) {
      // 自動サインインが無効な場合もスキップ
      // console.log('自動サインイン無効のため、認証状態監視をスキップします'); // デバッグ用なので削除
      return () => {};
    }

    // セッション情報を非同期で読み込む関数
    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (unmounted) return; // アンマウントされていたら処理中断

        if (localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true') {
          // リセット直後の場合、フラグを削除してユーザー情報をクリア
          // console.log('リセット直後のため、認証処理をスキップします'); // デバッグ用なので削除
          localStorage.removeItem('justReset');
          sessionStorage.removeItem('justReset');
          setUser(null);
          return;
        }
        if (!allowAutoSignIn) {
          // 自動サインインが無効な場合、ユーザー情報をクリア
          // console.log('自動サインイン無効のため、認証状態監視をスキップします'); // デバッグ用なので削除
          setUser(null);
          return;
        }

        if (session) {
          // セッションが存在すれば、ユーザー情報をセット
          setUser(session.user);
          // console.log('セッション読み込み完了:', session.user.id); // デバッグ用なので削除
        } else {
          // セッションが存在しなければ、ユーザー情報をクリア
          setUser(null);
          // console.log('セッションなし'); // デバッグ用なので削除
        }
      } catch (error) {
        console.error('セッション読み込みエラー:', error); // これは残す価値あり
      }
    };

    if (!user) {
      // user stateがまだセットされていない（初期状態など）場合、セッション読み込みを試みる
      loadSession();
    }

    // Supabaseの認証状態変更を購読 (subscribe)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isJustReset()) {
        // リセット直後は認証状態の変更を無視
        // console.log('リセット直後のため、認証状態変更を無視します'); // デバッグ用なので削除
        return;
      }
      const hasUser = !!session?.user; // セッションにユーザー情報があるか
      // console.log(`Auth state changed: {hasUser: ${hasUser}, event: '${event}'}`); // デバッグ用なので削除

      if (event === 'SIGNED_OUT') {
        // サインアウトした場合、ユーザー情報、収集スタンプ、コンプリート状態をリセット
        setUser(null);
        setCollectedStamps([]);
        setIsCompleted(false);
      } else if (hasUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        // サインインまたはトークン更新の場合、ユーザー情報をセット
        setUser(session.user);
      }
    });

    // コンポーネントがアンマウントされる際のクリーンアップ関数
    const unmountCleanup = () => {
      unmounted = true; // アンマウントフラグを立てる
      subscription?.unsubscribe(); // 認証状態変更の購読を解除
    };

    return unmountCleanup;
  }, [supabase.auth, allowAutoSignIn, user]); // supabase.auth, allowAutoSignIn, user のいずれかが変更されたら再実行

  // useEffectフック: ユーザーが存在し、かつリセット中でない場合に、定期的にコンプリート状態を確認します。
  // これは、複数のデバイスでスタンプラリーを進行させている場合に、他のデバイスでのコンプリート状態を
  // 最新に保つための処理ですが、現在は checkCompletedStatus の呼び出しがコメントアウトされています。
  // 必要に応じてコメントアウトを解除してください。
  useEffect(() => {
    if (!user) return; // ユーザーがいなければ何もしない
    // リセット中かどうかを判定するヘルパー関数
    const isResetting = () => {
      return localStorage.getItem('justReset') === 'true' || sessionStorage.getItem('justReset') === 'true';
    };
    if (isResetting()) {
      // リセット中の場合はチェックをスキップ
      // console.log('リセット中のため、完了状態チェックをスキップします'); // デバッグ用なので削除
      return () => {};
    }

    const CHECK_INTERVAL_MS = 5000; // チェック間隔 (ミリ秒)
    let intervalId: NodeJS.Timeout | null = null;
    // console.log('完了状態チェックインターバルを設定します'); // デバッグ用なので削除
    intervalId = setInterval(() => {
      if (isResetting()) {
        // インターバル実行時にリセット中になった場合もスキップし、インターバルをクリア
        // console.log('リセット実行中のため、チェックをスキップします'); // デバッグ用なので削除
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }
      // console.log('完了状態の定期チェックを実行します'); // デバッグ用なので削除
      // checkCompletedStatus(user.id); // ★注意: この行は現在コメントアウトされています。
      // 定期的なDBポーリングによるコンプリート状態同期が必要な場合は解除してください。
      // ただし、頻繁なDBアクセスはコストやパフォーマンスに影響する可能性があります。
    }, CHECK_INTERVAL_MS);

    if (!isResetting()) {
      // マウント時（またはuser, checkCompletedStatus変更時）にも一度実行
      // checkCompletedStatus(user.id); // ★注意: こちらも上記と同様の理由でコメントアウトされています。
    }

    // コンポーネントアンマウント時または依存配列の変更前にインターバルをクリア
    return () => {
      if (intervalId) {
        // console.log('完了状態チェックインターバルをクリアします'); // デバッグ用なので削除
        clearInterval(intervalId);
      }
    };
  }, [user, checkCompletedStatus]); // user または checkCompletedStatus が変更されたら再実行

  // useEffectフック: ユーザー情報 (user) が更新された際に、そのユーザーの収集済みスタンプ情報を
  // Supabaseデータベースから取得し、collectedStamps stateを更新します。
  useEffect(() => {
    if (!user) return; // ユーザーがいなければ何もしない
    const fetchStamps = async () => {
      try {
        // 'user_stamps'テーブルから該当ユーザーのスタンプ情報を取得
        const { data, error } = await supabase.from('user_stamps').select('stamps').eq('user_id', user.id).single();
        // PGRST116エラー (レコードなし) は、新規ユーザーなどの正常なケースなので、エラーとして扱わない
        if (error && error.code !== 'PGRST116') throw error;
        if (data?.stamps) {
          // データがあればcollectedStamps stateを更新
          setCollectedStamps(data.stamps);
        }
      } catch (error) {
        console.error('スタンプ取得エラー:', error); // これは残す価値あり
      }
    };
    fetchStamps();
  }, [user, supabase]); // user または supabaseクライアントが変更されたら再実行

  // useEffectフック: 収集済みスタンプ (collectedStamps) またはユーザー情報 (user) が変更された際に、
  // 現在のcollectedStampsの内容をSupabaseデータベースに保存（更新または新規作成）します。
  useEffect(() => {
    if (!user) return; // ユーザーがいなければ何もしない
    const saveStamps = async () => {
      try {
        // 'user_stamps'テーブルにユーザーIDとスタンプ配列を保存 (upsert: 存在すれば更新、なければ挿入)
        const { error } = await supabase.from('user_stamps').upsert({ user_id: user.id, stamps: collectedStamps }, { onConflict: 'user_id' });
        if (error) throw error; // エラーがあればスロー
      } catch (error) {
        console.error('スタンプ保存エラー:', error); // これは残す価値あり
      }
    };
    try {
      saveStamps();
    } catch (e) {
      // saveStamps内の非同期エラーは上記catchで捕捉されるが、同期的なエラーや
      // 呼び出し自体の問題があった場合のためにここでも捕捉
      console.error('スタンプ保存実行エラー:', e); // これは残す価値あり
    }
  }, [collectedStamps, user, supabase]); // collectedStamps, user, supabaseクライアントのいずれかが変更されたら再実行

  // --- 関数定義ここから ---

  /**
   * マイクの使用許可状態を確認し、必要に応じてUIを更新する非同期関数。
   * - `navigator.permissions` API を使用してマイクの許可状態 ('granted', 'denied', 'prompt') を取得します。
   * - 許可が拒否されている (`denied`) 場合:
   *   - `micPermissionDenied` state を true に設定。
   *   - `showPermissionGuide` state を true に設定し、許可設定のガイドを表示。
   *   - `displayedError` state にマイク許可拒否のエラー情報を設定。
   *   - `false` を返します。
   * - 許可されている (`granted`) または確認待ち (`prompt`) の場合:
   *   - `micPermissionDenied` state を false に設定。
   *   - `displayedError` state を null にクリア。
   *   - `true` を返します。
   * - `navigator.permissions` API が利用できない、またはエラーが発生した場合は、
   *   エラー情報を `displayedError` に設定し、`true` を返します (処理を続行させるため)。
   * @returns {Promise<boolean>} マイク使用許可を要求できる状態であれば true、既に拒否されていれば false。
   */
  const checkMicrophonePermission = async () => {
    try {
      // navigator.permissions API を使用してマイクの許可状態を問い合わせる
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permissionStatus.state === 'denied') {
        // 許可が拒否されている場合
        setMicPermissionDenied(true); // state更新
        setShowPermissionGuide(true); // ガイド表示
        setDisplayedError({
          // エラー表示
          type: EFPErrorType.PermissionDenied,
          message: 'マイクの使用が許可されていません。ブラウザまたはOSの設定を確認してください。',
        });
        return false; // 処理中断のシグナル
      } else if (permissionStatus.state === 'granted') {
        // 許可されている場合
        setMicPermissionDenied(false);
        setDisplayedError(null); // エラー表示クリア
        return true; // 処理続行のシグナル
      } else {
        // 確認待ち (prompt) の場合 (またはその他の状態)
        setMicPermissionDenied(false);
        setDisplayedError(null);
        return true; // 処理続行のシグナル
      }
    } catch (error) {
      // パーミッション確認中にエラーが発生した場合
      console.error('パーミッション確認エラー:', error); // これは残す価値あり
      setDisplayedError({
        type: EFPErrorType.Unknown,
        message: 'マイクの許可状態を確認できませんでした。',
        details: error instanceof Error ? error.toString() : String(error),
      });
      return true; // 不明な場合は続行可能と見なす（ユーザーに再度許可を求める流れになる）
    }
  };

  /**
   * 匿名ユーザーとしてSupabaseにサインアップし、マイク許可を得て音響認識を開始する非同期関数。
   * 「スタート」ボタンが押された際に呼び出されます。
   * 1. isLoading stateをtrueに設定（ローディング表示開始）。
   * 2. 既存のエラー表示をクリア。
   * 3. checkMicrophonePermissionでマイク許可状態を確認。
   *    - 既に拒否されていれば、設定ガイドを表示して終了。
   * 4. navigator.mediaDevices.getUserMediaでマイクへのアクセスを要求。
   *    - ユーザーが許可すれば、micPermissionGrantedをtrueに。
   *    - 拒否またはエラーがあれば、エラー表示をして終了。
   * 5. マイク許可が得られたら、supabase.auth.signInAnonymouslyで匿名認証。
   *    - 認証エラー時はエラー表示をして終了。
   *    - 認証成功後、ユーザー情報がなければエラー表示をして終了。
   * 6. 匿名ユーザーのスタンプ記録をSupabase上で初期化（または確認）。
   *    - upsert処理でエラーが発生しても、処理は続行（エラーは表示）。
   * 7. 自動サインインを許可する設定をローカルストレージに保存。
   * 8. handleSwitchRecを呼び出して音響認識を開始。
   * エラー発生時や処理完了時にはisLoading stateをfalseに戻します。
   */
  const handleAnonymousSignUp = async () => {
    try {
      setIsLoading(true); // ローディング開始
      setMicPermissionDenied(false); // マイク拒否状態をリセット
      setDisplayedError(null); // 既存のエラー表示をクリア
      if (setEfpPluginError) setEfpPluginError(null); // 音響認識フック内のエラーもクリア

      // まずマイク許可状態を確認
      const canRequestPermission = await checkMicrophonePermission();

      if (!canRequestPermission) {
        // 既に許可が明確に「拒否」されている場合は、設定ガイドが表示されているはずなので、ここで終了。
        setIsLoading(false); // ローディング終了
        return;
      }

      // マイク許可を要求 (getUserMedia はユーザーに許可ダイアログを表示する)
      let micPermissionGranted = false;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          // console.log('マイク許可が成功しました'); // デバッグ用なので削除
          setMicPermissionDenied(false); // 許可されたので拒否状態を解除
          micPermissionGranted = true;
        } catch (micError) {
          // マイク許可の取得に失敗した場合 (ユーザーが拒否、または他のエラー)
          console.error('マイク許可エラー:', micError); // これは残す価値あり
          setMicPermissionDenied(true); // 拒否状態に設定
          setShowPermissionGuide(true); // 設定ガイド表示
          // エラーの種類に応じて表示するメッセージを分ける
          if (micError instanceof Error && (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError')) {
            setDisplayedError({
              type: EFPErrorType.PermissionDenied,
              message: 'マイクの使用が許可されませんでした。ブラウザの設定でマイクへのアクセスを許可してください。',
              details: micError.toString(),
            });
          } else {
            setDisplayedError({
              type: EFPErrorType.StreamStartFailed, // より一般的なマイク起動失敗として
              message: 'マイクの起動に失敗しました。他のアプリがマイクを使用中でないか確認してください。',
              details: micError instanceof Error ? micError.toString() : String(micError),
            });
          }
          setIsLoading(false); // ローディング終了
          return; // マイク許可がないと進めないため終了
        }
      }

      // マイク許可が得られた場合のみ、認証処理へ進む
      if (micPermissionGranted) {
        const { data: authData, error: signInError } = await supabase.auth.signInAnonymously();

        if (signInError) {
          // 匿名認証に失敗した場合
          console.error('認証エラー:', signInError);
          setDisplayedError({
            type: EFPErrorType.Unknown, // 認証関連のエラータイプを別途定義しても良い
            message: '認証に失敗しました。電波の良いところで再度お試しください。',
            details: signInError.message,
          });
          setIsLoading(false);
          return;
        }

        if (!authData || !authData.user) {
          // 認証は成功したが、ユーザー情報が取得できなかった場合 (通常は起こりにくい)
          console.error('認証成功しましたが、ユーザー情報がありません。');
          setDisplayedError({
            type: EFPErrorType.Unknown,
            message: '認証処理中に予期せぬ問題が発生しました。',
            details: 'User object missing after anonymous sign in.',
          });
          setIsLoading(false);
          return;
        }

        const newAnonUser = authData.user; // 新しく作成された匿名ユーザー情報

        // Supabaseの'user_stamps'テーブルに、この新規匿名ユーザーのレコードを初期化 (または確認)
        // stampsカラムは空配列で初期化。user_idが競合した場合は何もしない (upsertのonConflict挙動)。
        try {
          const { error: upsertError } = await supabase
            .from('user_stamps')
            .upsert({ user_id: newAnonUser.id, stamps: [] }, { onConflict: 'user_id' });

          if (upsertError) {
            // スタンプ記録の初期化に失敗した場合 (DBエラーなど)
            console.error('ユーザーのスタンプ記録の初期化に失敗:', upsertError); // これは残す価値あり
            setDisplayedError({
              type: EFPErrorType.Unknown,
              message: 'ユーザーデータの初期設定に失敗しました。スタンプが正しく保存されない場合があります。',
              details: upsertError.message,
            });
            // エラーが発生しても、認証自体は成功しているので処理を続行するかどうかは要件次第。
            // ここでは続行し、エラーメッセージのみ表示する方針。
          } else {
            // console.log('ユーザーのスタンプ記録を初期化/確認しました:', newAnonUser.id); // デバッグ用なので削除
          }
        } catch (catchedUpsertError) {
          // upsert処理自体が例外をスローした場合 (Supabaseクライアントの問題など)
          console.error('ユーザーのスタンプ記録の初期化中に予期せぬ例外:', catchedUpsertError); // これは残す価値あり
          setDisplayedError({
            type: EFPErrorType.Unknown,
            message: 'ユーザーデータの初期設定中に予期せぬエラーが発生しました。',
            details: catchedUpsertError instanceof Error ? catchedUpsertError.toString() : String(catchedUpsertError),
          });
        }

        // 匿名サインインに成功したら、次回以降の自動サインインを許可するフラグをlocalStorageに保存
        localStorage.setItem('allowAutoSignIn', 'true');
        setAllowAutoSignIn(true); // stateも更新

        // 認証とユーザー初期化が完了したので、音響認識を開始
        await handleSwitchRec();
      }
    } catch (error) {
      // このtry-catchブロック内で予期せぬエラーが発生した場合の包括的なハンドリング
      console.error('匿名認証または音声認識開始エラー:', error); // これは残す価値あり
      if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
        // useEFP2フックからスローされた構造化されたエラーオブジェクトの場合
        setDisplayedError(error as EFPError);
      } else {
        // その他の一般的なJavaScriptエラーの場合
        setDisplayedError({
          type: EFPErrorType.Unknown,
          message: '予期せぬエラーが発生しました。通信環境の良い場所で再度お試しください。',
          details: error instanceof Error ? error.toString() : String(error),
        });
      }
      // エラー発生時はローディング状態を解除
      setIsLoading(false);
    }
  };

  // useEffectフック: useEFP2フックからのエラー (efpPluginError) を監視します。
  // efpPluginError に値がセットされた場合、それをUI表示用の displayedError stateにもセットします。
  // これにより、音響認識処理中のエラーがユーザーに通知されます。
  // 注意: isRec (録音状態) の変更は、エラーハンドリングの複雑さを避けるため、ここでは直接行いません。
  //       useEFP2フック側でエラー発生時にisRecを適切に管理する責任を持ちます。
  useEffect(() => {
    if (efpPluginError) {
      // 音響認識フックでエラーが発生した場合
      console.warn('EFP Plugin Error:', efpPluginError); // これは残す価値あり。警告としてコンソールに出力。
      setDisplayedError(efpPluginError); // UI表示用のエラーstateにセット

      // (コメントアウトされた旧ロジックに関する注釈)
      // 以前はここでisRecをfalseにする処理があったが、useEFP2フックとの状態同期の
      // 競合を避けるため削除。エラー発生時のisRecの制御はuseEFP2フックに委ねる。
      // if (isRec && efpPluginError.type !== EFPErrorType.StreamStopFailed) {
      //   // setIsRec(false);
      // }
    } else {
      // efpPluginErrorがnullになった場合 (エラーが解消された、または初期状態)
      // displayedErrorをここでnullにすると、UI起因の他のエラー表示まで消してしまう可能性があるため、
      // このuseEffectはefpPluginErrorからdisplayedErrorへの一方的な伝播のみを担当する。
      // displayedErrorのクリアは、エラー表示コンポーネントの閉じるボタンなど、他の場所で行う。
    }
  }, [efpPluginError]); // efpPluginError が変更された時のみ実行

  // useEffectフック: 音響認識結果 (meta) の変更を監視します。
  // 新しいメタデータ (meta) があり、かつそれが未獲得のスタンプIDと一致する場合に、
  // collectedStamps stateを更新し、newStamp stateに獲得したスタンプ情報をセットします。
  // さらに、8個目のスタンプ獲得時や全スタンプコンプリート時の特別な処理も行います。
  useEffect(() => {
    if (!meta) return; // 音響認識結果がなければ何もしない
    try {
      // STAMPSマスタから、認識されたmeta IDに一致するスタンプを探す
      const matchedStamp = STAMPS.find((stamp) => stamp.meta === meta);
      // 一致するスタンプがあり、かつそれがまだ収集されていない場合
      if (matchedStamp && !collectedStamps.includes(matchedStamp.id)) {
        // 収集済みスタンプのリストを更新
        const updatedStamps = [...collectedStamps, matchedStamp.id];
        setCollectedStamps(updatedStamps);
        setNewStamp(matchedStamp); // 新規獲得スタンプとしてUIに通知 (アニメーション用)

        // 8個目のスタンプを獲得したかどうかのチェック (7個持っていて、今回で8個目になった場合)
        if (collectedStamps.length === 7 && updatedStamps.length === 8) {
          try {
            // スタンプ獲得アニメーションの表示時間を考慮し、少し遅れてお祝いメッセージを表示
            setTimeout(() => {
              setShowEightStampsMessage(true);
            }, 4000); // 4秒後 (アニメーション時間に合わせて調整)
          } catch (error) {
            console.error('お祝いメッセージ表示エラー:', error);
            // エラーが発生してもスタンプ収集は継続
          }
        }

        // 全てのスタンプを集めた場合
        if (updatedStamps.length === STAMPS.length) {
          try {
            // 少し待ってからコンプリートページに遷移
            setTimeout(async () => {
              try {
                // 遷移前にレコーディングを停止
                if (isRec) {
                  console.log('コンプリートページへの遷移前にレコーディングを停止します');
                  await handleSwitchRec();
                }

                router.push('/complete');
              } catch (e) {
                console.error('ページ遷移エラー:', e);
                // 遷移できない場合も静かに失敗
              }
            }, 2000);
          } catch (error) {
            console.error('コンプリートページ遷移エラー:', error);
            // エラーが発生してもスタンプ収集は継続
          }
        }
      }
    } catch (error) {
      console.error('スタンプ処理エラー:', error);
      // エラーが発生してもアプリを停止させない
    }
  }, [meta, collectedStamps, router, handleSwitchRec, isRec]);

  // コンポーネント内部:
  const isRecRef = useRef(false);

  // isRec の状態が変わったときにref値も更新
  useEffect(() => {
    isRecRef.current = isRec;
    console.log('isRec ref 更新:', isRecRef.current);
  }, [isRec]);

  // 音響検知ボタンのハンドラー
  const handleAudioDetection = useCallback(async () => {
    // 現在の状態をref経由で取得
    const currentIsRec = isRecRef.current;
    console.log('音響検知ボタンがクリックされました。現在のisRec:', currentIsRec);
    setDisplayedError(null); // ボタンクリック時に過去のエラー表示をクリア
    if (setEfpPluginError) setEfpPluginError(null); // useEFP2の内部エラーもクリア

    try {
      // Android端末でのUI更新遅延対策：
      // 実際の処理前に暫定的にUI状態を更新（ユーザーフィードバック）
      const tempButtonElement = document.querySelector('.audio-detection-button');
      if (tempButtonElement) {
        if (currentIsRec) {
          tempButtonElement.classList.replace('bg-red-500', 'bg-[#004ea2]');
          const spanElement = tempButtonElement.querySelector('span');
          if (spanElement) {
            spanElement.textContent = '📢 音響検知スタート';
          }
        } else {
          tempButtonElement.classList.replace('bg-[#004ea2]', 'bg-red-500');
          const spanElement = tempButtonElement.querySelector('span');
          if (spanElement) {
            spanElement.textContent = '停止';
          }
        }
      }

      // Androidでの処理状態追跡用
      const isAndroid = /android/i.test(navigator.userAgent.toLowerCase());
      if (isAndroid) {
        console.log('Android端末を検出しました - 特別処理を適用');
      }

      if (currentIsRec) {
        console.log('録音停止処理を開始します...');

        // hookの停止処理
        await handleSwitchRec();
        console.log('停止処理を実行しました');

        // Androidでの追加処理
        if (isAndroid) {
          console.log('Android: 追加の状態管理処理');
          // 強制的な状態参照の更新
          isRecRef.current = false;
        }

        // 追加の強制停止処理
        if (typeof window !== 'undefined' && navigator.mediaDevices) {
          try {
            const streams = await navigator.mediaDevices.getUserMedia({ audio: true });
            streams.getTracks().forEach((track) => {
              console.log('トラックを強制停止します:', track.kind, track.id);
              track.stop();
            });
            console.log('すべてのオーディオトラックを強制停止しました');
          } catch (mediaError) {
            console.log('メディアデバイスの停止中にエラー（無視可能）:', mediaError);
          }
        }
      } else {
        console.log('録音開始処理を開始します...');

        // 開始前にクリーンアップ
        if (typeof window !== 'undefined' && navigator.mediaDevices) {
          try {
            const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            testStream.getTracks().forEach((track) => track.stop());
          } catch {
            // エラー無視（変数を完全に省略）
          }
        }

        await handleSwitchRec();

        // Androidでの追加処理
        if (isAndroid) {
          console.log('Android: 追加の状態管理処理');
          // 強制的な状態参照の更新
          isRecRef.current = true;
        }
      }

      // 状態確認を遅延実行
      setTimeout(() => {
        // 常に最新の状態参照
        console.log('音響検知ボタンクリック後の最終状態 isRec:', isRecRef.current);

        // Androidでは追加の状態確認
        if (isAndroid) {
          // ボタンのUIと状態の不一致がある場合は修正
          const audioButton = document.querySelector('.audio-detection-button');
          if (audioButton) {
            const buttonSpan = audioButton.querySelector('span');
            const expectedClass = isRecRef.current ? 'bg-red-500' : 'bg-[#004ea2]';
            const expectedText = isRecRef.current ? '停止' : '📢 音響検知スタート';

            // 必要に応じてボタンの表示を修正
            if (!audioButton.classList.contains(expectedClass.split(' ')[0])) {
              console.log('Android: ボタン表示を修正します');
              if (isRecRef.current) {
                audioButton.classList.replace('bg-[#004ea2]', 'bg-red-500');
              } else {
                audioButton.classList.replace('bg-red-500', 'bg-[#004ea2]');
              }

              if (buttonSpan && buttonSpan.textContent !== expectedText) {
                buttonSpan.textContent = expectedText;
              }
            }
          }
        }
      }, 1000);
    } catch (error) {
      console.error('音響検知処理エラー:', error);
      if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
        // useEFP2からの構造化されたエラーの場合
        setDisplayedError(error as EFPError);
      } else {
        setDisplayedError({
          type: EFPErrorType.Unknown,
          message: '音響検知の処理中にエラーが発生しました。',
          details: error instanceof Error ? error.toString() : String(error),
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase, handleSwitchRec, router, setEfpPluginError]); // setEfpPluginErrorを依存配列に追加

  // スタンプ保存ハンドラー
  const [isSharingStamp, setIsSharingStamp] = useState(false);

  /**
   * 獲得したスタンプ画像を保存または共有する非同期関数。
   * - isSharingStamp state を使用して、同時に複数の共有処理が実行されるのを防ぎます。
   * - スタンプ画像を指定されたURLからフェッチし、Blobオブジェクトとして取得します。
   * - navigator.share API (Web Share API) が利用可能なモバイル環境では、共有ダイアログを表示します。
   *   - ユーザーが共有をキャンセルした場合は、エラーとして扱わず静かに処理を終了します。
   *   - 共有APIの使用中にその他のエラーが発生した場合は、それをスローして上位のcatchブロックで処理させます。
   * - 共有APIが利用できない環境 (デスクトップブラウザなど) では、画像をファイルとしてダウンロードするフォールバック処理を行います。
   *   - ダウンロード用の<a>要素を動的に作成し、クリックイベントを発火させた後、要素を削除します。
   * - 処理中に発生したエラー (ネットワークエラー、セキュリティエラーなど) は包括的にcatchし、
   *   エラーの種類に応じたフレンドリーなメッセージをalertでユーザーに通知します。
   * - 処理完了後 (成功・失敗問わず)、isSharingStamp stateを少し遅延させてからfalseに戻し、
   *   UI操作に余裕を持たせつつ、次の共有操作を受け付けられるようにします。
   * @param stamp 保存または共有するスタンプオブジェクト。(STAMPS配列の要素と同じ型)
   */
  const handleSaveStamp = useCallback(
    async (stamp: (typeof STAMPS)[number]) => {
      // 既に共有操作が進行中なら早期リターン
      if (isSharingStamp) {
        console.log('他のスタンプの共有処理が進行中です。しばらくお待ちください。');
        return;
      }

      try {
        setIsSharingStamp(true);

        // 画像を取得
        const res = await fetch(stamp.image);
        if (!res.ok) throw new Error('画像の取得に失敗しました');

        const blob = await res.blob();
        const file = new File([blob], `stamp_${stamp.name}.jpg`, { type: blob.type });

        // モバイルでの共有APIをサポートしているかチェック
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const canUseShareAPI = isMobile && typeof navigator.share === 'function' && navigator.canShare && navigator.canShare({ files: [file] });

        console.log('デバイスタイプ:', isMobile ? 'モバイル' : 'デスクトップ');
        console.log('共有API対応状況:', canUseShareAPI ? '対応' : '非対応');

        if (canUseShareAPI) {
          try {
            // 共有APIを使用
            await navigator.share({
              files: [file],
              title: `${stamp.station_name}駅のスタンプ`,
              text: `名鉄スタンプラリー「${stamp.name}」のスタンプを獲得しました！`,
            });
            console.log('共有成功');
          } catch (shareError) {
            // キャンセルの場合は静かに終了
            if (
              shareError instanceof Error &&
              (shareError.name === 'AbortError' || shareError.name === 'NotAllowedError' || shareError.message.includes('cancel'))
            ) {
              console.log('共有操作: キャンセルされました');
              return;
            }
            console.error('共有API使用エラー:', shareError);
            throw shareError; // キャンセル以外のエラーは下位のエラーハンドラに渡す
          }
        } else {
          // 共有APIが使えない場合は通常のダウンロード処理
          console.log('共有API非対応のため、通常のダウンロード処理を実行します');
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
        console.error('スタンプ保存/共有エラー:', e);

        // エラータイプ別のメッセージ
        const friendlyErrorMessage: Record<string, string> = {
          NetworkError: 'ネットワーク接続に問題があります。接続を確認して再度お試しください。',
          SecurityError: '共有機能へのアクセスが許可されていません。',
          QuotaExceededError: '保存領域が不足しています。不要なデータを削除してください。',
          InvalidStateError: '前回の共有がまだ完了していません。時間をおいて再度お試しください。',
          default: '画像の保存中にエラーが発生しました。しばらくしてから再試行してください。',
        };

        // ユーザーに通知
        const errorName = e instanceof Error ? e.name : 'default';
        alert(friendlyErrorMessage[errorName] || friendlyErrorMessage.default);
      } finally {
        // 少し遅延させて共有状態をリセット（UI操作に余裕を持たせる）
        setTimeout(() => {
          setIsSharingStamp(false);
        }, 1000);
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

  /**
   * スタンプラリーのデータをリセットして、最初から再チャレンジできるようにする非同期関数。
   * 「再チャレンジする」ボタン (コンプリート後に表示) が押された際に呼び出されます。
   * 1. isLoading state を true に設定。
   * 2. 'justReset' フラグをローカルストレージとセッションストレージに設定し、リセット処理中であることを示す。
   * 3. 関連するstate (user, collectedStamps, isCompleted, allowAutoSignIn) を初期状態にリセット。
   * 4. ローカルストレージから主要なデータ (STORAGE_KEY, isExchangedなど) およびSupabase関連の認証トークンを削除。
   * 5. ログイン中のユーザーIDが存在すれば、Supabaseデータベース上の'user_stamps'テーブルと'users'テーブルの関連レコードをリセット。
   *    - 'user_stamps' の stamps 配列を空に更新。
   *    - 'users' の completed フラグを false に更新。
   * 6. Supabaseからサインアウトを実行。
   * 7. リセット完了のアラートを表示。
   * 8. 短い遅延の後、'justReset' フラグをクリアし、ページをリロードして完全に初期状態に戻す。
   * - エラー発生時はエラーメッセージをアラート表示し、リロードを試みる。
   */
  const handleRechallenge = async () => {
    try {
      setIsLoading(true);

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
        try {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        } catch (e) {
          console.error(`キー '${key}' の削除中にエラーが発生しました:`, e);
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
        } catch (dbError) {
          console.error('データベースリセット中にエラーが発生しました:', dbError);
        }
      }

      // Supabaseからサインアウト
      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.error('サインアウト中にエラーが発生しました:', signOutError);
      }

      console.log('リセット完了。ページをリロードします...');
      alert('リセットが完了しました。最初からやり直します。');

      // リロード前にリセットフラグをクリア
      setTimeout(() => {
        localStorage.removeItem('justReset');
        sessionStorage.removeItem('justReset');
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('再チャレンジエラー:', error);
      alert('リセット中にエラーが発生しました。ページをリロードします。');
      // エラーが発生しても強制的にリロード
      window.location.reload();
    }
  };

  /**
   * アプリケーションの全データをリセットする非同期関数。
   * 「すべてリセット」ボタンが押された際に呼び出されます。
   * - window.confirm でユーザーに最終確認を求め、同意が得られない場合は処理を中断します。
   * - 処理内容は handleRechallenge とほぼ同様で、各種stateのクリア、ローカルストレージ/セッションストレージのクリア、
   *   データベースの関連レコードのリセット、Supabaseからのサインアウトを行います。
   * - 主な違いは、この関数がユーザーによる明示的な全データ削除操作である点と、
   *   リセット後のメッセージや挙動が若干異なる場合がある点です（このコードではほぼ共通）。
   * - エラーハンドリングも handleRechallenge と同様に行います。
   * @async
   */
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
  }, [supabase, user]);

  /**
   * useEffectフック: isCompleted stateの更新ロジック。
   * collectedStamps (収集済みスタンプの数) が STAMPS.length (全スタンプ数) に達し、
   * かつ isCompleted がまだ false で、user が存在する場合に isCompleted を true に更新します。
   * 同時にローカルストレージの 'isCompleted' も 'true' に設定し、
   * Supabaseの 'users' テーブルの該当ユーザーの 'completed' カラムも true に更新します。
   * これにより、スタンプラリーのコンプリート状態を永続化し、他コンポーネントやセッション間でも同期します。
   * @listens collectedStamps
   * @listens isCompleted
   * @listens user
   * @listens supabase
   */
  useEffect(() => {
    // スタンプが10個集まった場合はisCompletedをtrueに設定
    if (collectedStamps.length === STAMPS.length && !isCompleted && user) {
      setIsCompleted(true);
      localStorage.setItem('isCompleted', 'true');

      // Supabaseにも反映
      try {
        supabase.from('users').upsert({ id: user.id, completed: true }).eq('id', user.id);
      } catch (error) {
        console.error('Completed状態の更新に失敗:', error);
      }
    }
  }, [collectedStamps, isCompleted, user, supabase]);

  /**
   * エラー情報を表示し、再試行やクリアの操作を提供するReactコンポーネント。
   * @param {object} props - コンポーネントのプロパティ。
   * @param {EFPError} props.error - 表示するエラーオブジェクト (type, message, detailsを含む)。
   * @param {() => void} [props.onRetry] - 「再試行」ボタンが押されたときに呼び出されるコールバック関数 (オプション)。
   * @param {() => void} props.onClear - 「閉じる」ボタンまたはエラー表示自体がクリアされるべきときに呼び出されるコールバック関数。
   * @returns {JSX.Element} エラー表示用のUI要素。
   * エラータイプに応じて、具体的な解決策のヒントを表示します。
   * TEST_MODEがtrueの場合、エラーの詳細(details)も表示されます。
   */

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

          {/* {(locationError || audioError) && (
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
          )} */}

          {/* <div className='text-center text-md mt-4 text-gray-700 p-4 bg-yellow-50 border-2 border-yellow-400 shadow-md animate-pulse'>
            <div className='flex items-center justify-center mb-2'>
              <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6 text-yellow-500 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z'
                />
              </svg>
              <span className='font-bold text-yellow-700'>スタンプラリーを楽しむために</span>
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
          </div> */}

          <div className='w-full mt-6 bg-yellow-100 border border-red-400 text-gray-700 px-4 py-3 rounded relative' role='alert'>
            <p className='text-lg font-bold'>参加中のお客様へご案内</p>
            <p className='text-sm my-2'>
              ① 最初の栄町駅では<span className='font-bold text-lg'>電車出発予定時刻の1分前</span>までに
              <span className='font-bold text-lg text-[#004ea2]'>「スタートボタン」</span>
              を押してください
            </p>
            <p className='text-md mb-2'>② マイクの使用を許可してください</p>
            <p className='text-md mb-2'>
              ③ 下部のボタンが<span className='font-bold text-red-600 text-lg'>「赤い停止ボタン」</span>に変わっていることを確認してください
            </p>
            <p className='text-md mb-2'>④ 電車に乗車中はブラウザから移動しないでください</p>
            <p className='text-md mb-2'>⑤ ブラウザのプライベートモードではスタンプを取得できません</p>
          </div>

          {/* <div className='w-full border border-red-400 text-gray-700 px-4 py-3 rounded relative' role='alert'>
            <p className='text-md font-bold'>お願い</p>
            <p className='text-xs my-2'>
              ① 下部のボタンが<span className='font-bold text-red-600'>赤い停止ボタン</span>に変わっていることを確認してください
            </p>
            <p className='text-xs mb-2'>② 電車に乗車中はブラウザから移動しないでください</p>
          </div> */}

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
                    スタンプ<span className='text-red-600 text-3xl'>8</span>個以上集めて
                    <br />
                    景品をGET！
                  </span>
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

              {/* コンプリートページへボタン - 尾張旭まち案内の右横に配置 */}
              {collectedStamps.length >= 8 && (
                <div className='relative rounded-md overflow-hidden'>
                  <motion.button
                    onClick={async () => {
                      // 遷移前にレコーディングを停止
                      if (isRec) {
                        console.log('コンプリートページへの遷移前にレコーディングを停止します');
                        await handleSwitchRec();
                      }
                      router.push('/complete');
                    }}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className='aspect-square rounded-md overflow-hidden bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex flex-col items-center justify-center p-2'>
                    <span className='text-2xl mb-1'>🎉</span>
                    <span className='text-center text-xs'>
                      コンプリート
                      <br />
                      ページへ
                    </span>
                    <svg
                      className='w-4 h-4 mt-1'
                      fill='none'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      viewBox='0 0 24 24'
                      stroke='currentColor'>
                      <path d='M13 7l5 5m0 0l-5 5m5-5H6'></path>
                    </svg>
                  </motion.button>
                  {/* ダミーの駅名スペース（レイアウト調整用） */}
                  <div className='text-center'>
                    <span className='text-transparent' style={{ fontSize: '10px', lineHeight: 0.8 }}>
                      　
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

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
        <div className='fixed px-4 bottom-4 left-0 right-0 flex justify-center sm:w-auto sm:mx-auto sm:left-1/2 sm:-translate-x-1/2 max-w-md sm:max-w-lg'>
          {user ? (
            collectedStamps.length === STAMPS.length ? (
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
                } text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl max-w-sm mx-auto audio-detection-button`}
                onClick={handleAudioDetection}>
                <span className='text-xl'>{isRec ? '停止' : '📢 音響検知スタート'}</span>
              </button>
            )
          ) : (
            <button
              onClick={handleAnonymousSignUp}
              disabled={isLoading}
              className='w-full h-12 rounded-full flex items-center justify-center bg-[#004ea2] hover:bg-[#004ea2] text-white shadow-xl transform transition-all active:scale-95 hover:shadow-2xl max-w-sm mx-auto'>
              <span className='text-xl'>{isLoading ? '登録中...' : 'スタート'}</span>
            </button>
          )}
        </div>

        {/* すべてリセットボタン - 常に表示 */}
        <div className='fixed top-2 right-2 z-50'>
          <button
            onClick={handleResetAll}
            className='px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-xs shadow hover:bg-gray-300 transition-colors'>
            すべてリセット
          </button>
        </div>

        {/* スタンプ獲得アニメーション */}
        <AnimatePresence>{newStamp && <StampCollectionAnimation stamp={newStamp} onComplete={() => setNewStamp(null)} />}</AnimatePresence>

        {/* 8個のスタンプ達成お祝いメッセージ */}
        <AnimatePresence>
          {showEightStampsMessage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 backdrop-blur-sm'
              onClick={() => setShowEightStampsMessage(false)}>
              <motion.div
                initial={{ scale: 0.5, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                transition={{ type: 'spring', damping: 12 }}
                className='bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-2xl shadow-2xl text-white text-center max-w-sm mx-4'
                onClick={(e) => e.stopPropagation()}>
                <div className='text-5xl mb-4'>🎉</div>
                <h2 className='text-2xl font-bold mb-3'>おめでとうございます！</h2>
                <p className='mb-4'>8個のスタンプを集めました！</p>
                <p className='text-sm mb-6'>これでコンプリートページで景品と交換できます！</p>

                <button
                  onClick={async () => {
                    // async を追加
                    if (isRec) {
                      // 追加
                      console.log('コンプリートページへの遷移前にレコーディングを停止します（8個達成モーダル）');
                      await handleSwitchRec(); // 追加
                    }
                    router.push('/complete');
                  }}
                  className='bg-white text-purple-600 font-bold py-2 px-6 rounded-full hover:bg-gray-100 transform hover:scale-105 transition-all'>
                  コンプリートページへ
                </button>

                <button
                  onClick={() => setShowEightStampsMessage(false)}
                  className='mt-3 text-white/80 underline text-sm block w-full hover:text-white'>
                  あとでする
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* テスト用: スタンプ数操作ボタン */}
        {TEST_MODE && (
          <div className='fixed bottom-20 left-0 right-0 flex justify-center gap-2 z-50 md:gap-4 flex-wrap'>
            <button
              onClick={() => {
                // 8個のスタンプをランダムに選択
                const randomStamps = [...Array(STAMPS.length)]
                  .map((_, i) => i + 1)
                  .sort(() => 0.5 - Math.random())
                  .slice(0, 8);
                setCollectedStamps(randomStamps);

                // ローカルストレージにも保存
                localStorage.setItem(STORAGE_KEY, JSON.stringify(randomStamps));

                // ユーザーがログインしている場合はSupabaseにも保存
                if (user) {
                  supabase
                    .from('user_stamps')
                    .upsert({ user_id: user.id, stamps: randomStamps }, { onConflict: 'user_id' })
                    .then(({ error }) => {
                      if (error) console.error('スタンプ保存エラー:', error);
                      else console.log('テスト用：8個のスタンプを設定しました');
                    });
                }

                // お祝いメッセージを表示（既に8個ある場合は表示しない）
                if (collectedStamps.length < 8) {
                  setTimeout(() => {
                    setShowEightStampsMessage(true);
                  }, 500);
                }
              }}
              className='px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-md shadow-md'>
              テスト: 8個のスタンプを設定
            </button>

            <button
              onClick={() => {
                // 9個のスタンプをランダムに選択（8個+1）
                const randomStamps = [...Array(STAMPS.length)]
                  .map((_, i) => i + 1)
                  .sort(() => 0.5 - Math.random())
                  .slice(0, 9);
                setCollectedStamps(randomStamps);

                localStorage.setItem(STORAGE_KEY, JSON.stringify(randomStamps));

                if (user) {
                  supabase
                    .from('user_stamps')
                    .upsert({ user_id: user.id, stamps: randomStamps }, { onConflict: 'user_id' })
                    .then(({ error }) => {
                      if (error) console.error('スタンプ保存エラー:', error);
                      else console.log('テスト用：9個のスタンプを設定しました');
                    });
                }
              }}
              className='px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-md'>
              テスト: 9個のスタンプを設定
            </button>

            <button
              onClick={() => {
                // 10個のスタンプを全て設定
                const allStamps = [...Array(STAMPS.length)].map((_, i) => i + 1);
                setCollectedStamps(allStamps);

                localStorage.setItem(STORAGE_KEY, JSON.stringify(allStamps));

                if (user) {
                  supabase
                    .from('user_stamps')
                    .upsert({ user_id: user.id, stamps: allStamps }, { onConflict: 'user_id' })
                    .then(({ error }) => {
                      if (error) console.error('スタンプ保存エラー:', error);
                      else console.log('テスト用：10個のスタンプを設定しました');
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
                        console.log('コンプリートページへの遷移前にレコーディングを停止します');
                        await handleSwitchRec();
                      }

                      console.log('コンプリートページへ自動遷移します');
                      router.push('/complete');
                    } catch (e) {
                      console.error('ページ遷移エラー:', e);
                    }
                  }, 1500);
                } catch (error) {
                  console.error('コンプリートページ遷移エラー:', error);
                }
              }}
              className='px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-md'>
              テスト: 10個のスタンプを設定
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
                      if (error) console.error('スタンプリセットエラー:', error);
                      else console.log('テスト用：スタンプをリセットしました');
                    });
                }
              }}
              className='px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-md'>
              テスト: スタンプリセット
            </button>

            {/* 追加のデバッグボタンここから */}
            <button
              onClick={() => {
                setDisplayedError({
                  type: EFPErrorType.Unknown, // より適切な型があればそれに変更
                  message: 'テスト用のネットワークエラーが発生しました。',
                  details: 'Simulated network request failure.',
                });
              }}
              className='px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-md'>
              テスト: ネットワークエラー
            </button>
            <button
              onClick={() => {
                setDisplayedError({
                  type: EFPErrorType.SDKLoadFailed,
                  message: 'テスト用のSDK読み込みエラーが発生しました。',
                  details: 'Simulated SDK load failure for testing.',
                });
              }}
              className='px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-md shadow-md'>
              テスト: SDK読み込み失敗
            </button>
            <button
              onClick={() => {
                setMicPermissionDenied(true);
                setShowPermissionGuide(true);
                setDisplayedError({
                  type: EFPErrorType.PermissionDenied,
                  message: 'テストのためマイク許可が拒否されました。',
                  details: 'Simulated microphone permission denied.',
                });
              }}
              className='px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md shadow-md'>
              テスト: マイク許可拒否
            </button>
            {/* 追加のデバッグボタンここまで */}
          </div>
        )}

        {/* Confetti animation loaded dynamically on client */}
        {showConfetti && <ReactConfetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={200} />}

        {/* エラー表示 */}
        {displayedError && (
          <ErrorDisplay
            error={displayedError}
            onClear={() => {
              setDisplayedError(null);
              if (!isRec && displayedError.type !== EFPErrorType.NotSupported) {
                // 必要に応じて再試行ロジック
              }
            }}
            onRetry={
              (displayedError.type === EFPErrorType.SDKLoadFailed ||
                displayedError.type === EFPErrorType.SDKInitFailed ||
                displayedError.type === EFPErrorType.AudioProcessingInitFailed ||
                displayedError.type === EFPErrorType.StreamStartFailed ||
                displayedError.type === EFPErrorType.Unknown) &&
              user
                ? () => {
                    if (user) {
                      handleAudioDetection();
                    } else {
                      handleAnonymousSignUp();
                    }
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}

/**
 * 新しいスタンプを獲得した際に表示されるアニメーションコンポーネント。
 * 電車が横切り、その後スタンプが花火と共に表示される演出を行います。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {(typeof STAMPS)[0]} props.stamp - 表示するスタンプのオブジェクト。
 * @param {() => void} props.onComplete - アニメーション完了時に呼び出されるコールバック関数。
 * 内部で Lottieアニメーション (花火) を使用しており、関連するJSONファイルをフェッチします。
 * アニメーションのシーケンス:
 * 1. 電車が画面を横切る (約1.5秒)。
 * 2. 電車が消えた後、スタンプ画像が拡大・バウンスしながら表示される (約1秒)。
 * 3. スタンプ表示と同時に花火のLottieアニメーションが再生される。
 * 4. スタンプ表示から約2.5秒後 (合計約4秒後) に onComplete コールバックが実行される。
 */
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
          <div className='absolute inset-0 opacity-0 animate-stamp rounded-2xl' />
          <Image src={stamp.image} alt={stamp.station_name} width={320} height={320} className='rounded-2xl shadow-2xl' />
        </motion.div>
      )}
    </div>
  );
};
