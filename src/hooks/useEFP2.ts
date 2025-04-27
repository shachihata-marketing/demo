import { useState, useEffect } from "react"

const efp2ModuleUrl =
  "https://websdk-v2-cdn.evixar.com/sdk/efpkit2/2.1/efpkit2.js" // FingerPrint SDK CDNのURL
const fpUrl =
  "https://websdk-v2-cdn.evixar.com/fingerprint/shachihata_setosen_2025/2/packed.db" // FingerPrintデータのURL

// 以下は変更しないでください。
let stream: MediaStream | null = null
let audioContext: AudioContext | null = null
let audioSampleRate: number | null = null
let recognier: Recognizer | null = null

export const useEFP2 = (apiKey: string) => {
  const [meta, setMeta] = useState<string | null>(null)
  const [isRec, setIsRec] = useState(false)
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt')
  const [error, setError] = useState<string | null>(null)

  // マイク権限の確認
  useEffect(() => {
    const checkMicPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        setMicPermission(result.state)
        
        result.addEventListener('change', () => {
          setMicPermission(result.state)
        })
      } catch (error) {
        console.error("マイク権限の確認エラー:", error)
        setError("マイクの権限を確認できませんでした")
      }
    }

    checkMicPermission()
  }, [])

  const handleSwitchRec = async () => {
    console.log("handleSwitchRec called, current isRec:", isRec)
    try {
      if (isRec) {
        // 停止処理の前に状態を更新（UIをすぐに反映するため）
        setIsRec(false)
        console.log("Stopping recording...")
        await recordStop()
      } else {
        if (micPermission === 'denied') {
          setError('マイクの使用が許可されていません。ブラウザの設定から許可してください。')
          return
        }
        console.log("Starting recording...")
        await recordStart()
      }
    } catch (error) {
      console.error("音声認識エラー:", error)
      setError("音声認識の開始/停止に失敗しました")
      setIsRec(false)
    }
  }

  async function recordStart() {
    const userMedia = navigator.mediaDevices.getUserMedia
    if (userMedia == null) {
      setError("getUserMediaがサポートされていません")
      return
    }

    const audioConfig = {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    }

    // iOS devices need different audio configuration
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      audioConfig.echoCancellation = true
      audioConfig.autoGainControl = true
      audioConfig.noiseSuppression = true
    } else {
      audioConfig.echoCancellation = false
      audioConfig.autoGainControl = true
      audioConfig.noiseSuppression = true
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: audioConfig,
      })
      await handleMediaDevicesOpened(mediaStream)
      console.log("audio stream on")
      setMeta(null)
      // 状態更新を確実に実行
      setIsRec(true)
      console.log("isRec set to true")
      setError(null)
    } catch (error) {
      console.error("audio stream failed:", error)
      setError("音声ストリームの開始に失敗しました")
      throw error
    }
  }

  function recordStop() {
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
        audioContext?.close()

        stream = null
        audioContext = null
        audioSampleRate = null
        recognier = null
      }
      console.log("audio stream off")
      // 念のための二重保証として、ここでも状態更新
      setIsRec(false)
      console.log("isRec set to false")
      setError(null)
      return Promise.resolve()
    } catch (error) {
      console.error("audio stream stop failed:", error)
      setError("音声ストリームの停止に失敗しました")
      throw error
    }
  }

  const handleMediaDevicesOpened = async (_stream: MediaStream) => {
    stream = _stream
    audioContext = new (window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext)()
    audioSampleRate = audioContext.sampleRate
    console.log("audio sample rate: ", audioSampleRate)
    const source = audioContext.createMediaStreamSource(stream)
    const efp2 = await importEFP2()
    const create_recognizer = efp2.default
    recognier = await create_recognizer(audioContext, fpUrl, apiKey)
    if (recognier) {
      if (audioSampleRate) {
        recognier.change_samplerate(audioSampleRate)
      }
      recognier.on_detect = function (result) {
        setMeta(result.meta)
      }
      source.connect(recognier.node)
      if (audioContext?.destination) {
        recognier.node.connect(audioContext.destination)
      }
    }
  }

  // デバッグ用: isRecの変更を監視
  useEffect(() => {
    console.log("isRec state changed:", isRec)
  }, [isRec])

  return { meta, isRec, handleSwitchRec, micPermission, error }
}

async function importEFP2() {
  const response = await fetch(efp2ModuleUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch module: ${response.statusText}`)
  }

  const scriptText = await response.text()
  const absoluteScriptText = scriptText.replace(
    /from\s+['"](\.\/[^'"]+)['"]/g,
    (match, p1) => {
      const absoluteUrl = new URL(p1, efp2ModuleUrl).href
      return `from '${absoluteUrl}'`
    },
  )
  const blob = new Blob([absoluteScriptText], {
    type: "application/javascript",
  })
  const blobUrl = URL.createObjectURL(blob)

  return import(/* webpackIgnore: true */ blobUrl)
}

type Recognizer = {
  change_samplerate: (sampleRate: number) => void
  on_detect: (result: { meta: string; pos: number }) => void
  node: AudioNode
}
