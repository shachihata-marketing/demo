import { useState, useEffect } from "react"

// 音響フィンガープリントSDK (EFPKit2) のCDN URL。このURLからSDKが読み込まれます。
// 本番環境ではクエリパラメータでAPIキーを渡す必要がある
const getEfp2ModuleUrl = (apiKey?: string) => {
  const baseUrl = "https://websdk-cdn.airymedia.net/sdk/efpkit2/2.3/efpkit2.js"
  
  // APIキーが提供されている場合は常にクエリパラメータに含める
  if (apiKey) {
    // EFP2のドキュメントに基づいて正しいパラメータ名を使用
    // 'apikey' が最も一般的な形式
    return `${baseUrl}?apikey=${encodeURIComponent(apiKey)}`
  }
  
  // APIキーがない場合 - 本番環境ではログを出さない
  return baseUrl
}
// 音響フィンガープリントデータのURL。このデータとマイク入力を照合して音声を認識します。
// TODO: シヤチハタ動物園用の正しいフィンガープリントURLに更新が必要
const fpUrl =
  "https://triggerdb-cdn.airymedia.net/0196f81c-a612-7702-8a99-09010871a006/0196f81d-fb0d-7d7b-8613-86328d2138e0/6/packed.db"

// APIキーは引数として渡される

// エラーの種類を定義する列挙型。これにより、エラーの種類を明確に識別できます。
export enum EFPErrorType {
  NotSupported = 'NOT_SUPPORTED', // ブラウザがマイクや必要な音声処理機能に対応していない場合
  PermissionDenied = 'PERMISSION_DENIED', // ユーザーがマイクの使用許可を与えなかった場合
  StreamStartFailed = 'STREAM_START_FAILED', // マイクからの音声ストリーム開始に失敗した場合
  StreamStopFailed = 'STREAM_STOP_FAILED', // 音声ストリームの停止に失敗した場合
  SDKLoadFailed = 'SDK_LOAD_FAILED', // EFPKit2 SDKの読み込みに失敗した場合
  SDKInitFailed = 'SDK_INIT_FAILED', // EFPKit2 SDKの初期化に失敗した場合
  AudioProcessingInitFailed = 'AUDIO_PROCESSING_INIT_FAILED', // Web Audio APIなどの音声処理機能の初期化に失敗した場合
  Unknown = 'UNKNOWN', // その他の予期しないエラー
}

// エラー情報を保持するためのインターフェース（型定義）。
export interface EFPError {
  type: EFPErrorType; // 上記で定義したエラーの種類
  message: string; // ユーザーに表示するための、分かりやすいエラーメッセージ
  details?: string; // 開発者向けの詳細なエラー情報や、元のエラーオブジェクトの文字列表現など
}

// windowオブジェクトの型を拡張し、Safariなどのブラウザで標準とは異なる名前で存在する可能性のある
// webkitAudioContext をオプション（あってもなくても良い）として型定義に含めます。
interface ExtendedWindow extends Window {
  AudioContext?: typeof AudioContext; // 標準のAudioContext
  webkitAudioContext?: typeof AudioContext; // Safari用のwebkitAudioContext
}

// これらの変数は、音声認識処理全体で共有されるため、フックの外側で定義されています。
// スコープを限定し、意図しない変更を防ぐために、直接のエクスポートはされていません。
let stream: MediaStream | null = null // マイクからの音声ストリームを保持する変数
let audioContext: AudioContext | null = null // 音声処理を行うためのAudioContextオブジェクト
let audioSampleRate: number | null = null // AudioContextのサンプルレート
let recognizer: Recognizer | null = null // EFPKit2 SDKの認識エンジンインスタンス
let keepAliveInterval: NodeJS.Timeout | null = null // ストリーム維持用のインターバル

/**
 * useEFP2カスタムフック。音響フィンガープリント認識機能を提供します。
 * @returns {object} 以下のプロパティを含むオブジェクト:
 *  - meta: 認識結果のメタデータ（文字列）。認識されると更新されます。
 *  - isRec: 現在録音中（認識処理中）かどうかを示すブール値。
 *  - handleSwitchRec: 録音の開始/停止を切り替える非同期関数。
 *  - error: 発生したエラーの情報を保持するEFPErrorオブジェクト、またはエラーがない場合はnull。
 *  - setError: error状態を更新するための関数（主に内部エラー処理用）。
 */
export const useEFP2 = (apiKey: string) => {
  // 本番環境での初期化確認
  useEffect(() => {
    // 本番環境ではログ出力を無効化
    // APIキーの検証
    if (!apiKey || apiKey.length < 10) {
      setError({
        type: EFPErrorType.SDKInitFailed,
        message: 'APIキーが無効です。管理者に連絡してください。',
        details: 'Invalid or missing API key'
      });
    }
  }, [apiKey])
  
  // 認識された音響パターンのメタデータを保持するstate。初期値はnull。
  const [meta, setMeta] = useState<string | null>(null)
  // 現在録音中（認識処理がアクティブ）かどうかを示すstate。初期値はfalse。
  const [isRec, setIsRec] = useState(false)
  // エラー情報を保持するstate。EFPError型、またはエラーがない場合はnull。初期値はnull。
  const [error, setError] = useState<EFPError | null>(null)
  // 現在のデバイスがAndroidかどうかを示すstate。初期値はfalse。
  // Android特有の処理を行うために使用します。
  const [isAndroid, setIsAndroid] = useState(false)

  // コンポーネントのマウント時（初回レンダリング後）に一度だけ実行される副作用フック。
  // ユーザーエージェント文字列を調べてAndroidデバイスかどうかを判定し、isAndroid stateを更新します。
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase(); // ブラウザのユーザーエージェント文字列を小文字で取得
    const isAndroidDevice = /android/i.test(userAgent); // "android"という文字列が含まれているか正規表現でテスト
    setIsAndroid(isAndroidDevice); // 結果をisAndroid stateにセット
  }, []); // 第2引数の依存配列が空なので、マウント時にのみ実行
  
  /**
   * 録音の開始と停止を切り替える関数。
   * isRecの状態に基づいて、recordStartまたはrecordStopを呼び出します。
   * Androidデバイスの場合、状態変更をより確実に反映するための特別な処理が含まれています。
   */
  const handleSwitchRec = async () => {
    try {
      if (isRec) {
        // 現在録音中の場合、停止処理を実行
        await recordStop();
        // Android端末では、状態更新が非同期で行われることによるUIの不整合を防ぐため、
        // 明示的にisRecの状態をfalseに更新します。
        if (isAndroid) {
          setIsRec(false);
        }
      } else {
        // 現在停止中の場合、開始処理を実行
        await recordStart();
        // Android端末では、同様にisRecの状態をtrueに明示的に更新します。
        if (isAndroid) {
          setIsRec(true);
        }
      }
      return Promise.resolve(); // 処理成功
    } catch (error) {
      // recordStart/recordStop内でエラーが発生した場合、そのエラーを呼び出し元に伝播させます。
      // これにより、UI側でエラーに応じた処理を行うことができます。
      throw error;
    }
  }

  /**
   * マイクからの録音（音響認識）を開始する非同期関数。
   * マイクへのアクセス許可を要求し、音声ストリームを取得後、
   * handleMediaDevicesOpened関数を呼び出して音声処理の初期化を行います。
   * @throws {Error} マイクアクセスや音声ストリーム取得に関するエラー。
   */
  async function recordStart() {
    try {
      // 前回のエラーをクリア
      setError(null);
      
      // navigator.mediaDevicesの存在チェック
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setError({
          type: EFPErrorType.NotSupported,
          message: "お使いのブラウザは、マイク機能に対応していません。",
          details: "navigator.mediaDevices.getUserMedia is not available.",
        });
        return;
      }
      
      // HTTPSチェックは削除 - HTTP環境でも動作可能にする
      // 注意: 一部のブラウザではHTTPSが必要な場合がありますが、その場合はgetUserMediaでエラーが出ます
    } catch (error) {
      // 初期チェックエラー
      setError({
        type: EFPErrorType.Unknown,
        message: "初期化エラーが発生しました。",
        details: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    // マイクから音声を取得する際のオーディオ設定。
    // エコーキャンセル、自動ゲイン制御、ノイズ抑制の各オプションを設定します。
    const audioConfig = {
      echoCancellation: false, // エコー除去機能
      autoGainControl: false,  // 自動音量調整機能
      noiseSuppression: false, // ノイズ抑制機能
    }

    // iOSデバイス（iPhone, iPad, iPod）の場合、デフォルトのオーディオ設定では
    // 音声が途切れるなどの問題が発生することがあるため、特定の設定を有効にします。
    // これはiOSのWeb Audio APIの実装やプライバシー機能に関連する挙動の違いによるものです。
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      audioConfig.echoCancellation = true
      audioConfig.autoGainControl = true
      audioConfig.noiseSuppression = true
    } else {
      // iOS以外のデバイス（Android、PCなど）での設定。
      // Android 13では音声処理機能の組み合わせによって問題が発生することがある
      const userAgent = navigator.userAgent.toLowerCase();
      const isAndroid = /android/i.test(userAgent);
      const androidVersion = isAndroid ? parseInt(userAgent.match(/android\s(\d+)/)?.[1] || '0') : 0;
      
      if (isAndroid && androidVersion >= 13) {
        // Android 13以降の専用設定
        audioConfig.echoCancellation = false // Android 13では無効化
        audioConfig.autoGainControl = true
        audioConfig.noiseSuppression = false // Android 13では無効化
      } else {
        // その他のAndroidやPCでの設定
        audioConfig.echoCancellation = true
        audioConfig.autoGainControl = true
        audioConfig.noiseSuppression = true
      }
    }

    try {
      // ブラウザにマイクへのアクセス許可を要求し、音声ストリームを取得します。
      // video: false はビデオは不要であることを示します。
      // audio: audioConfig で上記で定義したオーディオ設定を使用します。
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: audioConfig,
      })
      // 音声ストリームの取得に成功したら、音声処理の初期化を行います。
      await handleMediaDevicesOpened(mediaStream, apiKey)
      
      // ストリームの状態を監視
      const audioTracks = mediaStream.getAudioTracks()
      if (audioTracks.length > 0) {
        const track = audioTracks[0]
        
        // トラックの終了イベントを監視
        track.addEventListener('ended', () => {
          setError({
            type: EFPErrorType.StreamStopFailed,
            message: 'マイクが切断されました。再度お試しください。',
            details: 'MediaStreamTrack ended unexpectedly'
          })
          recordStop()
        })
        
        // トラックのミュート状態を監視
        track.addEventListener('mute', () => {
          // マイクがミュートされた
        })
      }
      
      // 状態を更新
      setMeta(null) // 前回の認識結果をクリア
      setIsRec(true) // 録音中状態に設定
      setError(null) // エラー状態をクリア
      
      // 本番環境でのストリーム維持対策
      if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
        // 30秒ごとにストリームの状態をチェックし、必要に応じて再接続
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval)
        }
        keepAliveInterval = setInterval(() => {
          if (stream && stream.active) {
            const tracks = stream.getAudioTracks()
            if (tracks.length > 0 && tracks[0].readyState === 'live') {
              // ストリーム状態: 正常
            } else {
              // ストリーム状態: 異常を検出
              setError({
                type: EFPErrorType.StreamStopFailed,
                message: 'マイクの接続が切れました。再度お試しください。',
                details: 'Stream track is not live'
              })
              recordStop()
            }
          }
        }, 30000) // 30秒ごと
      }
    } catch (error) {
      // マイクの起動に失敗した場合のエラーハンドリング
      let errorType = EFPErrorType.StreamStartFailed;
      let message = "マイクの起動に失敗しました。";
      const details = error instanceof Error ? error.toString() : String(error);
      
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            errorType = EFPErrorType.PermissionDenied;
            message = "マイクの使用が許可されていません。ブラウザの設定を確認してください。";
            break;
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            errorType = EFPErrorType.NotSupported;
            message = "マイクが見つかりません。デバイスが正しく接続されているか確認してください。";
            break;
          case 'NotReadableError':
          case 'TrackStartError':
            errorType = EFPErrorType.StreamStartFailed;
            message = "マイクが他のアプリケーションで使用されています。他のアプリを終了してから再度お試しください。";
            break;
          case 'OverconstrainedError':
          case 'ConstraintNotSatisfiedError':
            errorType = EFPErrorType.StreamStartFailed;
            message = "お使いのデバイスが音声入力の要件を満たしていません。";
            break;
          case 'SecurityError':
            errorType = EFPErrorType.PermissionDenied;
            message = "セキュリティ設定によりマイクへのアクセスがブロックされています。";
            break;
          case 'AbortError':
            errorType = EFPErrorType.StreamStartFailed;
            message = "マイクの起動が中断されました。もう一度お試しください。";
            break;
          default:
            // デバイス特有のエラーメッセージを追加
            const userAgent = navigator.userAgent.toLowerCase();
            const isAndroid = /android/i.test(userAgent);
            const androidVersion = isAndroid ? parseInt(userAgent.match(/android\s(\d+)/)?.[1] || '0') : 0;
            if (isAndroid && androidVersion >= 13) {
              message = "Android 13でマイクの起動に失敗しました。他のアプリがマイクを使用していないか確認してください。";
            }
        }
      }
      
      setError({
        type: errorType,
        message: message,
        details: details,
      });
      throw error; // エラーを呼び出し元に伝播
    }
  }

  /**
   * マイクからの録音（音響認識）を停止する関数。
   * 音声ストリームのトラックを停止し、AudioContextをクローズ（解放）します。
   * Androidデバイス特有の停止処理も含まれます。
   * @returns {Promise<void>} 処理が完了したことを示すPromise。
   * @throws {Error} ストリーム停止処理中にエラーが発生した場合。
   */
  function recordStop() {
    try {
      // エラーをクリア
      setError(null);
      
      if (stream) { // 音声ストリームが存在する場合のみ処理
        // Androidデバイスでは、標準の停止処理だけでは完全にトラックが解放されないことがあるため、
        // 各トラックを個別に停止する処理を追加しています。
        if (isAndroid) {
          try {
            stream.getTracks().forEach((track) => {
              track.stop(); // 個々のメディアトラック（この場合はオーディオトラック）を停止
            });
          } catch (_trackError) {
            // トラック停止中に警告が発生した場合、コンソールに出力します。
            // これは致命的なエラーではない可能性が高いため、警告として扱います。
            // Android: トラック停止中に警告
          }
        }

        // 全てのデバイスで共通の停止処理
        stream.getTracks().forEach((track) => track.stop()) // ストリーム内の全トラックを停止
        audioContext?.close() // AudioContextが存在すればクローズ（リソース解放）

        // グローバル変数をリセット
        stream = null
        audioContext = null
        audioSampleRate = null
        recognizer = null
      }
      // keepAliveインターバルをクリア
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval)
        keepAliveInterval = null
      }
      // 状態を更新
      setIsRec(false) // 録音中状態を解除
      setError(null) // エラー状態をクリア
      return Promise.resolve() // 処理成功
    } catch (error) {
      // ストリーム停止処理中にエラーが発生した場合
      setError({
        type: EFPErrorType.StreamStopFailed,
        message: "音声ストリームの停止に失敗しました。",
        details: error instanceof Error ? error.toString() : String(error),
      })
      throw error // エラーを呼び出し元に伝播
    }
  }

  /**
   * 音声ストリーム取得成功後に呼び出される、音声処理の初期化を行う非同期関数。
   * AudioContextの準備、EFPKit2 SDKの読み込みと初期化、認識エンジンの設定を行います。
   * @param _stream {MediaStream} マイクから取得した音声ストリーム。
   * @param apiKey {string} EFP2 APIキー
   * @throws {Error} AudioContextの初期化失敗、SDKの読み込み失敗、SDKの初期化失敗など。
   */
  const handleMediaDevicesOpened = async (_stream: MediaStream, apiKey: string) => {
    try {
      stream = _stream // グローバル変数に音声ストリームを保存

      // AudioContextのインスタンス化。ブラウザ間の互換性を考慮し、
      // window.AudioContext または window.webkitAudioContext (Safari等) を使用します。
      const WindowAudioContext = (window as ExtendedWindow).AudioContext || (window as ExtendedWindow).webkitAudioContext;
      if (!WindowAudioContext) {
        // どちらのAudioContextも見つからない場合は、ブラウザが非対応と判断します。
        setError({
          type: EFPErrorType.NotSupported,
          message: "お使いのブラウザは音声処理機能に対応していません。最新のChrome、Safari、Firefoxをお使いください。",
          details: "AudioContext and webkitAudioContext are not available.",
        });
        stream.getTracks().forEach(track => track.stop()); // ストリームを停止
        setIsRec(false); // 録音状態を解除
        throw new Error("AudioContext not supported"); // エラーをスローして処理中断
      }
      
      // AudioContext設定の最適化
      const audioContextOptions: AudioContextOptions = {};
      const userAgent = navigator.userAgent.toLowerCase();
      const isIOS = /iphone|ipad|ipod/i.test(userAgent);
      const isAndroid = /android/i.test(userAgent);
      const androidVersion = isAndroid ? parseInt(userAgent.match(/android\s(\d+)/)?.[1] || '0') : 0;
      
      // 環境に応じた設定
      if (typeof window !== 'undefined') {
        // 低レイテンシーモード
        audioContextOptions.latencyHint = 'interactive';
        
        // デバイス別サンプルレート設定
        if (isAndroid && androidVersion >= 13) {
          // Android 13は自動設定（デバイスのデフォルトを使用）
          // audioContextOptions.sampleRate は設定しない
        } else if (isIOS) {
          // iOSは48kHz固定
          audioContextOptions.sampleRate = 48000;
        } else {
          // その他は48kHz
          audioContextOptions.sampleRate = 48000;
        }
      }
      
      audioContext = new WindowAudioContext(audioContextOptions); // AudioContextを生成
      
      // AudioContextの状態を確認し、suspendedの場合はresumeする
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume()
          // AudioContextをresume
        } catch {
          // AudioContext resumeエラー
        }
      }
      
      // 本番環境での追加チェック - 本番ではログを出さない
      
      // audioContextが正常に初期化されたか（nullでないか）を確認します。
      // 通常、new演算子は成功すればインスタンスを返しますが、極稀なケースや
      // ブラウザのバグなどで失敗する可能性も考慮し、念のためチェックします。
      if (!audioContext) {
        setError({
            type: EFPErrorType.NotSupported, // または適切なエラータイプ（例: AudioProcessingInitFailed）
            message: "音声処理機能の初期化に失敗しました。ブラウザが対応していない可能性があります。",
            details: "Failed to initialize AudioContext instance.",
        });
        stream.getTracks().forEach(track => track.stop());
        setIsRec(false);
        throw new Error("Failed to initialize AudioContext instance");
      }

      audioSampleRate = audioContext.sampleRate // AudioContextのサンプルレートを取得・保存
      // MediaStreamSourceNodeを作成。これがマイク入力をAudioContextの処理パイプラインに接続するエントリーポイントとなります。
      const source = audioContext.createMediaStreamSource(stream)
      
      let efp2; // EFPKit2 SDKモジュールを格納する変数
      try {
        // 外部のEFPKit2 SDKを動的にインポートします。
        efp2 = await importEFP2(apiKey)
      } catch (sdkError) {
        // SDKの読み込みに失敗した場合のエラー処理
        setError({
          type: EFPErrorType.SDKLoadFailed,
          message: "音響検知エンジンの読み込みに失敗しました。通信環境の良い場所で再度お試しください。",
          details: sdkError instanceof Error ? sdkError.toString() : String(sdkError),
        })
        // リソースを解放
        stream.getTracks().forEach(track => track.stop())
        audioContext?.close() // audioContextがnullでなければクローズ
        setIsRec(false) // 録音状態を解除
        throw new Error("SDK読み込み失敗") // エラーをスロー
      }
      
      // EFPKit2 SDKから認識エンジン作成関数を取得
      const create_recognizer = efp2.default
      // 認識エンジンを非同期で作成。AudioContext、フィンガープリントデータURL、APIキーを渡します。
      recognizer = await create_recognizer(audioContext, fpUrl, apiKey)
      if (recognizer) { // 認識エンジンが正常に作成された場合
        if (audioSampleRate) {
          // 認識エンジンに現在のAudioContextのサンプルレートを設定
          recognizer.change_samplerate(audioSampleRate)
        }
        // 音声が検出された際のコールバック関数を設定
        recognizer.on_detect = function (result: { meta: string; pos: number }) {
          // 検出されたメタデータをstateに保存。これによりUIが更新されます。
          setMeta(result.meta)
        }
        // 音声入力(source)を認識エンジン(recognizer.node)に接続
        source.connect(recognizer.node)
        // 認識エンジンの出力をAudioContextの最終出力（通常はスピーカー）に接続。
        // これにより、マイク入力が（加工されていれば加工後の）スピーカーから聞こえるようになります。
        // 聞こえないようにする場合は、この行をコメントアウトするか、GainNodeを挟んでgainを0にします。
        // recognizer.node.connect(audioContext.destination) // スピーカー出力は不要なのでコメントアウト 
      }
    } catch (error) {
      // このtryブロック内で発生したエラーの包括的なハンドリング
      // （AudioContext初期化、SDK読み込み、認識エンジン作成など）
      if (stream) {
        stream.getTracks().forEach(track => track.stop()) // ストリームを停止
      }
      if (audioContext) {
        // AudioContextのクローズ処理もエラーを発生させる可能性があるため、try-catchで囲みます。
        try {
            audioContext.close();
        } catch (_closeError) {
            // クローズ時のエラーは主要なエラーではないため、警告としてログに出力するに留めます。
            // AudioContext close error during cleanup
        }
      }
      setIsRec(false) // 録音状態を解除

      // 既に特定のエラータイプとして処理されているエラー（AudioContext未サポート、SDK読み込み失敗など）でなければ、
      //汎用の初期化失敗エラーとして設定します。
      if (!(error instanceof Error && (error.message === "AudioContext not supported" || error.message === "SDK読み込み失敗" || error.message === "Failed to initialize AudioContext instance"))) {
        setError({
          type: EFPErrorType.AudioProcessingInitFailed,
          message: "音声処理の初期化中に予期せぬエラーが発生しました。",
          details: error instanceof Error ? error.toString() : String(error),
        });
      }
      throw error // 元のエラーを再スローして呼び出し元に伝えます
    }
  }

  // フックが提供する値や関数をオブジェクトとして返します。
  // これにより、このフックを使用するコンポーネントはこれらの値にアクセスできます。
  return { meta, isRec, handleSwitchRec, error, setError }
}

/**
 * EFPKit2 SDKモジュールを動的にインポートする非同期関数。
 * SDKのJavaScriptファイルをフェッチし、相対パスを絶対パスに書き換えた後、
 * Blob URLを作成してimport()構文でモジュールとして読み込みます。
 * これにより、CORSの問題を回避しつつ、外部スクリプトをESモジュールとして扱えます。
 */
async function importEFP2(apiKey?: string) {
  try {
    // EFP2 SDKのログを事前に抑制
    if (typeof window !== 'undefined') {
      const originalLog = console.log;
      // 一時的にconsole.logを無効化
      console.log = function(...args: unknown[]) {
        const logString = args.join(' ');
        if (logString.includes('apikey:') || 
            logString.includes('dk:') || 
            logString.includes('campaign_id:') ||
            logString.includes('sdkInitialized:') ||
            logString.includes('need_decode_meta:')) {
          return;
        }
        originalLog.apply(console, args);
      };
    }
    
    // SDKのURLを生成（APIキーはクエリパラメータとして含める）
    const sdkUrl = getEfp2ModuleUrl(apiKey)
    
    // SDK取得開始
    
    // シンプルなfetchリクエスト（ヘッダーは不要の可能性）
    const response = await fetch(sdkUrl)

    //レスポンスが正常（HTTPステータスコード200番台）でなければエラーをスローします。
    if (!response.ok) {
      // SDK取得エラー
      
      // 401エラーの場合は認証の問題
      if (response.status === 401) {
        throw new Error(`SDKの認証に失敗しました。APIキーが正しいか確認してください。(HTTPステータス: ${response.status})`)
      }
      
      // 503エラーの場合はサービス利用不可
      if (response.status === 503) {
        throw new Error(`音声認識サービスが一時的に利用できません。しばらく待ってから再度お試しください。(HTTPステータス: ${response.status})`)
      }
      
      throw new Error(`SDKモジュールの取得に失敗しました (HTTPステータス: ${response.status} ${response.statusText})。ネットワーク接続を確認してください。`);
    }

    // レスポンスボディをテキストとして取得します。これがSDKのJavaScriptコードです。
    let scriptText = await response.text()
    
    // SDKコード内のconsole.log呼び出しを無効化
    // APIキーを含むログ出力を抑制
    scriptText = scriptText.replace(
      /console\.(log|debug|info)\s*\([^)]*apikey[^)]*\)/gi,
      '/* console.log suppressed */'
    );
    scriptText = scriptText.replace(
      /console\.(log|debug|info)\s*\([^)]*\b(dk|campaign_id|sdkInitialized|need_decode_meta)\b[^)]*\)/gi,
      '/* console.log suppressed */'
    );
    // SDK内部で使われている可能性のある相対パスのimport文 (例: `from './utils'`) を、
    // 元のSDK URLを基準とした絶対パスに書き換えます。
    // これにより、Blob URLからモジュールを読み込む際に相対パスの解決が正しく行われるようになります。
    const absoluteScriptText = scriptText.replace(
      /from\s+['"](\.\/[^'"]+)['"]/g, // `from './xxx'` や `from "./xxx"` のようなパターンにマッチ
      (_match, p1) => { // p1 は './xxx' の部分
        const absoluteUrl = new URL(p1, sdkUrl).href // 相対パスを絶対URLに変換
        return `from '${absoluteUrl}'` // 絶対URLを使ったimport文に置換
      },
    )
    // 書き換えたJavaScriptコードからBlobオブジェクトを作成します。
    // type: "application/javascript" は、このBlobがJavaScriptコードであることを示します。
    const blob = new Blob([absoluteScriptText], {
      type: "application/javascript",
    })
    // Blobオブジェクトから一時的なURL（Blob URL）を生成します。
    const blobUrl = URL.createObjectURL(blob)

    // Blob URLを動的import()で読み込みます。
    // /* webpackIgnore: true */ は、Webpackのようなバンドラがこのimportを静的に解決しようとせず、
    // 実行時まで遅延させるためのヒントです。
    return import(/* webpackIgnore: true */ blobUrl)
  } catch (e) {
    // フェッチ自体の失敗（ネットワークエラーなど）や、その他のエラーをここで捕捉します。
    if (e instanceof Error) {
        // 既にこの関数内で具体的なエラーメッセージが設定されている場合はそれを優先します。
        // これにより、より詳細なエラー原因をユーザーや開発者に伝えることができます。
        if (e.message.startsWith("SDKモジュールの取得に失敗しました") || e.message.startsWith("SDKモジュールの取得中にエラーが発生しました")) {
            throw e; // 既に設定されたエラーをそのままスロー
        }
        // その他の一般的なエラーの場合は、汎用的なメッセージと共に元のエラーメッセージを追加します。
        throw new Error(`SDKモジュールの取得中にエラーが発生しました: ${e.message}。ネットワーク接続を確認してください。`);
    }
    // 予期しない型のエラー（通常は発生しづらい）の場合は、不明なエラーとして扱います。
    throw new Error(`SDKモジュールの取得中に不明なエラーが発生しました。ネットワーク接続を確認してください。`);
  }
}

// EFPKit2 SDKの認識エンジン(Recognizer)の型定義。
// SDKのドキュメントや実際のオブジェクト構造に基づいて定義する必要があります。
type Recognizer = {
  change_samplerate: (sampleRate: number) => void // サンプルレート変更メソッド
  on_detect: (result: { meta: string; pos: number }) => void // 音声検出時のコールバック
  node: AudioNode // AudioContextに接続するためのAudioNode
}
