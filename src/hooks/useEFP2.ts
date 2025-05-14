import { useState, useEffect } from "react"

// 音響フィンガープリントSDK (EFPKit2) のCDN URL。このURLからSDKが読み込まれます。
const efp2ModuleUrl =
  "https://websdk-v2-cdn.evixar.com/sdk/efpkit2/2.1/efpkit2.js"
// 音響フィンガープリントデータのURL。このデータとマイク入力を照合して音声を認識します。
const fpUrl =
  "https://websdk-v2-cdn.evixar.com/fingerprint/shachihata_setosen_2025/2/packed.db"

// 環境変数からAPIキーを読み込む
const apiKey = process.env.NEXT_PUBLIC_EFP_API_KEY;

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
let recognier: Recognizer | null = null // EFPKit2 SDKの認識エンジンインスタンス

/**
 * useEFP2カスタムフック。音響フィンガープリント認識機能を提供します。
 * @returns {object} 以下のプロパティを含むオブジェクト:
 *  - meta: 認識結果のメタデータ（文字列）。認識されると更新されます。
 *  - isRec: 現在録音中（認識処理中）かどうかを示すブール値。
 *  - handleSwitchRec: 録音の開始/停止を切り替える非同期関数。
 *  - error: 発生したエラーの情報を保持するEFPErrorオブジェクト、またはエラーがない場合はnull。
 *  - setError: error状態を更新するための関数（主に内部エラー処理用）。
 */
export const useEFP2 = () => {
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
   * @returns {Promise<void>} 処理が完了したことを示すPromise。
   * @throws {Error} recordStartまたはrecordStop内で発生したエラーを再スローします。
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
    // navigator.mediaDevices.getUserMedia APIの存在を確認。
    // このAPIがないブラウザはマイク機能に対応していません。
    const userMedia = navigator.mediaDevices.getUserMedia
    if (userMedia == null) {
      setError({
        type: EFPErrorType.NotSupported,
        message: "お使いのブラウザは、マイク機能に対応していません。",
        details: "navigator.mediaDevices.getUserMedia is not available.",
      })
      return // これ以上処理を進められないため終了
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
      // こちらも最適な設定値は環境やSDKの要件により調整されることがあります。
      audioConfig.echoCancellation = false
      audioConfig.autoGainControl = true // Androidではtrueの方が安定する場合がある
      audioConfig.noiseSuppression = true
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
      await handleMediaDevicesOpened(mediaStream)
      
      // 状態を更新
      setMeta(null) // 前回の認識結果をクリア
      setIsRec(true) // 録音中状態に設定
      setError(null) // エラー状態をクリア
    } catch (error) {
      // マイクの起動に失敗した場合のエラーハンドリング
      let errorType = EFPErrorType.StreamStartFailed;
      let message = "マイクの起動に失敗しました。";
      // エラーオブジェクトのnameプロパティを確認し、ユーザーが許可しなかった場合のエラーかどうかを判定
      if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) {
        errorType = EFPErrorType.PermissionDenied;
        message = "マイクの使用が許可されていません。";
      }
      setError({
        type: errorType,
        message: message,
        details: error instanceof Error ? error.toString() : String(error), // エラーの詳細情報を格納
      })
      throw error // エラーを呼び出し元に伝播
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
      if (stream) { // 音声ストリームが存在する場合のみ処理
        // Androidデバイスでは、標準の停止処理だけでは完全にトラックが解放されないことがあるため、
        // 各トラックを個別に停止する処理を追加しています。
        if (isAndroid) {
          try {
            stream.getTracks().forEach((track) => {
              track.stop(); // 個々のメディアトラック（この場合はオーディオトラック）を停止
            });
          } catch (trackError) {
            // トラック停止中に警告が発生した場合、コンソールに出力します。
            // これは致命的なエラーではない可能性が高いため、警告として扱います。
            console.warn("Android: トラック停止中に警告:", trackError);
          }
        }

        // 全てのデバイスで共通の停止処理
        stream.getTracks().forEach((track) => track.stop()) // ストリーム内の全トラックを停止
        audioContext?.close() // AudioContextが存在すればクローズ（リソース解放）

        // グローバル変数をリセット
        stream = null
        audioContext = null
        audioSampleRate = null
        recognier = null
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
   * @throws {Error} AudioContextの初期化失敗、SDKの読み込み失敗、SDKの初期化失敗など。
   */
  const handleMediaDevicesOpened = async (_stream: MediaStream) => {
    try {
      stream = _stream // グローバル変数に音声ストリームを保存

      // AudioContextのインスタンス化。ブラウザ間の互換性を考慮し、
      // window.AudioContext または window.webkitAudioContext (Safari等) を使用します。
      const WindowAudioContext = (window as ExtendedWindow).AudioContext || (window as ExtendedWindow).webkitAudioContext;
      if (!WindowAudioContext) {
        // どちらのAudioContextも見つからない場合は、ブラウザが非対応と判断します。
        setError({
          type: EFPErrorType.NotSupported,
          message: "お使いのブラウザは音声処理機能に対応していません。",
          details: "AudioContext and webkitAudioContext are not available.",
        });
        stream.getTracks().forEach(track => track.stop()); // ストリームを停止
        setIsRec(false); // 録音状態を解除
        throw new Error("AudioContext not supported"); // エラーをスローして処理中断
      }
      audioContext = new WindowAudioContext(); // AudioContextを生成
      
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
        efp2 = await importEFP2()
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
      recognier = await create_recognizer(audioContext, fpUrl, apiKey)
      if (recognier) { // 認識エンジンが正常に作成された場合
        if (audioSampleRate) {
          // 認識エンジンに現在のAudioContextのサンプルレートを設定
          recognier.change_samplerate(audioSampleRate)
        }
        // 音声が検出された際のコールバック関数を設定
        recognier.on_detect = function (result: { meta: string; pos: number }) {
          // 検出されたメタデータをstateに保存。これによりUIが更新されます。
          setMeta(result.meta)
        }
        // 音声入力(source)を認識エンジン(recognier.node)に接続
        source.connect(recognier.node)
        // 認識エンジンの出力をAudioContextの最終出力（通常はスピーカー）に接続。
        // これにより、マイク入力が（加工されていれば加工後の）スピーカーから聞こえるようになります。
        // 聞こえないようにする場合は、この行をコメントアウトするか、GainNodeを挟んでgainを0にします。
        recognier.node.connect(audioContext.destination) 
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
        } catch (closeError) {
            // クローズ時のエラーは主要なエラーではないため、警告としてログに出力するに留めます。
            console.warn("AudioContext close error during cleanup:", closeError);
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
 * @returns {Promise<any>} インポートされたSDKモジュール。
 * @throws {Error} SDKのフェッチ失敗、テキスト化失敗、Blob URLからのインポート失敗など。
 */
async function importEFP2() {
  try {
    // SDKのURLからJavaScriptファイルをフェッチ（ダウンロード）します。
    const response = await fetch(efp2ModuleUrl)

    //レスポンスが正常（HTTPステータスコード200番台）でなければエラーをスローします。
    if (!response.ok) {
      throw new Error(`SDKモジュールの取得に失敗しました (HTTPステータス: ${response.status} ${response.statusText})。ネットワーク接続を確認してください。`);
    }

    // レスポンスボディをテキストとして取得します。これがSDKのJavaScriptコードです。
    const scriptText = await response.text()
    // SDK内部で使われている可能性のある相対パスのimport文 (例: `from './utils'`) を、
    // 元のSDK URLを基準とした絶対パスに書き換えます。
    // これにより、Blob URLからモジュールを読み込む際に相対パスの解決が正しく行われるようになります。
    const absoluteScriptText = scriptText.replace(
      /from\s+['"](\.\/[^'"]+)['"]/g, // `from './xxx'` や `from "./xxx"` のようなパターンにマッチ
      (match, p1) => { // p1 は './xxx' の部分
        const absoluteUrl = new URL(p1, efp2ModuleUrl).href // 相対パスを絶対URLに変換
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
