import { useState } from "react"

const efp2ModuleUrl =
  "https://websdk-v2-cdn.evixar.com/sdk/efpkit2/1.0/efpkit2.js" // FingerPrint SDK CDNのURL
const fpUrl =
  "https://websdk-v2-cdn.evixar.com/fingerprint/shachihata_test/2/packed.db" // FingerPrintデータのURL

// 以下は変更しないでください。
let stream: MediaStream | null = null
let audioContext: AudioContext | null = null
let audioSampleRate: number | null = null
let recognier: Recognizer | null = null
export const useEFP2 = (apiKey: string) => {
  const [meta, setMeta] = useState<string | null>(null)
  const [isRec, setIsRec] = useState(false)

  const handleSwitchRec = async () => {
    if (isRec) {
      recordStop()
    } else {
      recordStart()
    }
  }

  async function recordStart() {
    const userMedia = navigator.mediaDevices.getUserMedia
    if (userMedia == null) {
      console.error("getUserMedia is not supported")
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

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: audioConfig,
    })
    try {
      await handleMediaDevicesOpened(mediaStream)
      console.log("audio stream on")
      setMeta(null)
      setIsRec(true)
    } catch {
      console.log("audio stream failed")
    }
  }

  function recordStop() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      audioContext?.close()

      stream = null
      audioContext = null
      audioSampleRate = null
      recognier = null
    }
    console.log("audio stream off")
    setIsRec(false)
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

  return { meta, isRec, handleSwitchRec }
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
