/**
 * デバイス能力チェックユーティリティ
 * ブラウザとデバイスの機能を安全にチェックし、互換性を確保します
 */

// バッテリー情報の型定義（Battery Status APIは標準化されていないため）
interface BatteryManager {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
}

// ネットワーク情報の型定義（Network Information APIの拡張）
interface NetworkInformation {
  downlink?: number;
  downlinkMax?: number;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  rtt?: number;
  saveData?: boolean;
  type?: 'bluetooth' | 'cellular' | 'ethernet' | 'none' | 'wifi' | 'wimax' | 'other' | 'unknown';
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
}

// Navigator拡張型定義
interface ExtendedNavigator extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

// デバイス能力の結果型
export interface DeviceCapabilities {
  microphone: boolean;
  webAudio: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  webShare: boolean;
  permissions: boolean;
  battery: boolean;
  network: boolean;
  online: boolean;
  cookieEnabled: boolean;
  serviceWorker: boolean;
  https: boolean;
  details: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    viewport: string;
    deviceMemory?: number;
    hardwareConcurrency?: number;
  };
}

// バッテリー状態の結果型
export interface BatteryStatus {
  supported: boolean;
  level?: number;
  charging?: boolean;
  chargingTime?: number;
  dischargingTime?: number;
  lowPowerMode?: boolean;
  criticalLevel?: boolean;
}

// ネットワーク状態の結果型
export interface NetworkStatus {
  supported: boolean;
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: string;
  slowConnection?: boolean;
}

/**
 * デバイスの能力を包括的にチェックする
 * @returns {Promise<DeviceCapabilities>} デバイス能力の詳細情報
 */
export async function checkDeviceCapabilities(): Promise<DeviceCapabilities> {
  const capabilities: DeviceCapabilities = {
    microphone: false,
    webAudio: false,
    localStorage: false,
    sessionStorage: false,
    webShare: false,
    permissions: false,
    battery: false,
    network: false,
    online: false,
    cookieEnabled: false,
    serviceWorker: false,
    https: false,
    details: {
      userAgent: '',
      platform: '',
      language: '',
      screenResolution: '',
      viewport: '',
    },
  };

  try {
    // マイクロフォンサポートチェック
    capabilities.microphone = Boolean(
      navigator.mediaDevices && 
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );

    // Web Audio APIサポートチェック
    capabilities.webAudio = Boolean(
      'AudioContext' in window || 
      'webkitAudioContext' in window
    );

    // LocalStorageサポートチェック
    try {
      if (typeof localStorage !== 'undefined') {
        const testKey = '__deviceCapTest__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        capabilities.localStorage = true;
      }
    } catch {
      capabilities.localStorage = false;
    }

    // SessionStorageサポートチェック
    try {
      if (typeof sessionStorage !== 'undefined') {
        const testKey = '__deviceCapTest__';
        sessionStorage.setItem(testKey, 'test');
        sessionStorage.removeItem(testKey);
        capabilities.sessionStorage = true;
      }
    } catch {
      capabilities.sessionStorage = false;
    }

    // Web Share APIサポートチェック
    capabilities.webShare = Boolean(
      navigator.share && 
      typeof navigator.share === 'function'
    );

    // Permissions APIサポートチェック
    capabilities.permissions = Boolean(
      navigator.permissions && 
      typeof navigator.permissions.query === 'function'
    );

    // Battery Status APIサポートチェック
    const extNav = navigator as ExtendedNavigator;
    capabilities.battery = Boolean(
      extNav.getBattery && 
      typeof extNav.getBattery === 'function'
    );

    // Network Information APIサポートチェック
    capabilities.network = Boolean(
      extNav.connection || 
      extNav.mozConnection || 
      extNav.webkitConnection
    );

    // オンライン状態チェック
    capabilities.online = navigator.onLine || false;

    // Cookieサポートチェック
    capabilities.cookieEnabled = navigator.cookieEnabled || false;

    // Service Workerサポートチェック
    capabilities.serviceWorker = Boolean(
      'serviceWorker' in navigator && 
      typeof navigator.serviceWorker === 'object'
    );

    // HTTPSチェック
    capabilities.https = window.location.protocol === 'https:';

    // デバイス詳細情報
    capabilities.details = {
      userAgent: navigator.userAgent || '',
      platform: navigator.platform || '',
      language: navigator.language || '',
      screenResolution: `${screen.width || 0}x${screen.height || 0}`,
      viewport: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      deviceMemory: 'deviceMemory' in navigator ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined,
      hardwareConcurrency: navigator.hardwareConcurrency,
    };

  } catch (error) {
    // グローバルエラーが発生してもアプリは継続
    console.error('Device capability check error:', error);
  }

  return capabilities;
}

/**
 * バッテリー状態を安全にチェックする
 * @returns {Promise<BatteryStatus>} バッテリー状態情報
 */
export async function checkBatteryStatus(): Promise<BatteryStatus> {
  const status: BatteryStatus = {
    supported: false,
  };

  try {
    const extNav = navigator as ExtendedNavigator;
    
    if (extNav.getBattery && typeof extNav.getBattery === 'function') {
      try {
        const battery = await extNav.getBattery();
        status.supported = true;
        status.level = battery.level;
        status.charging = battery.charging;
        status.chargingTime = battery.chargingTime;
        status.dischargingTime = battery.dischargingTime;
        
        // 低電力モード判定（20%以下）
        status.lowPowerMode = battery.level < 0.2;
        // クリティカルレベル判定（5%以下）
        status.criticalLevel = battery.level < 0.05;
      } catch {
        // Battery API呼び出しエラーを静かに処理
        status.supported = false;
      }
    }
  } catch {
    // グローバルエラーを静かに処理
    status.supported = false;
  }

  return status;
}

/**
 * ネットワーク状態を安全にチェックする
 * @returns {NetworkStatus} ネットワーク状態情報
 */
export function checkNetworkStatus(): NetworkStatus {
  const status: NetworkStatus = {
    supported: false,
    online: false,
  };

  try {
    // オンライン状態
    status.online = navigator.onLine || false;

    // Network Information API
    const extNav = navigator as ExtendedNavigator;
    const connection = extNav.connection || extNav.mozConnection || extNav.webkitConnection;

    if (connection) {
      status.supported = true;
      status.effectiveType = connection.effectiveType;
      status.downlink = connection.downlink;
      status.rtt = connection.rtt;
      status.saveData = connection.saveData;
      status.type = connection.type;

      // 低速接続判定
      status.slowConnection = 
        connection.effectiveType === 'slow-2g' || 
        connection.effectiveType === '2g' ||
        (connection.downlink !== undefined && connection.downlink < 1);
    }
  } catch {
    // ネットワーク情報取得エラーを静かに処理
  }

  return status;
}

/**
 * ブラウザがプライベートモードかどうかを検出する
 * @returns {Promise<boolean>} プライベートモードの場合true
 */
export async function detectPrivateMode(): Promise<boolean> {
  try {
    // 1. LocalStorage テスト
    try {
      localStorage.setItem('__pmTest__', 'test');
      localStorage.removeItem('__pmTest__');
    } catch {
      return true;
    }

    // 2. IndexedDB テスト
    if ('indexedDB' in window) {
      try {
        const db = await new Promise<boolean>((resolve) => {
          const deleteReq = indexedDB.deleteDatabase('__pmTest__');
          deleteReq.onsuccess = () => {
            const openReq = indexedDB.open('__pmTest__', 1);
            openReq.onerror = () => resolve(true);
            openReq.onsuccess = () => {
              openReq.result.close();
              indexedDB.deleteDatabase('__pmTest__');
              resolve(false);
            };
          };
          deleteReq.onerror = () => resolve(true);
        });
        return db;
      } catch {
        return true;
      }
    }

    // 3. FileSystem API テスト (Chrome)
    if ('webkitRequestFileSystem' in window) {
      try {
        await new Promise<void>((resolve, reject) => {
          (window as Window & { webkitRequestFileSystem?: (type: number, size: number, successCallback: () => void, errorCallback: () => void) => void }).webkitRequestFileSystem!(
            0, 0,
            () => resolve(),
            () => reject()
          );
        });
      } catch {
        return true;
      }
    }

    // 4. Safari特有のチェック
    if (navigator.vendor && navigator.vendor.includes('Apple')) {
      try {
        (window as Window & { openDatabase?: (name: null, version: null, displayName: null, estimatedSize: null) => void }).openDatabase!(null, null, null, null);
      } catch {
        return true;
      }
    }

    return false;
  } catch {
    // 検出エラーの場合は安全のためfalseを返す
    return false;
  }
}

/**
 * 互換性警告メッセージを生成する
 * @param capabilities デバイス能力情報
 * @param batteryStatus バッテリー状態情報
 * @param networkStatus ネットワーク状態情報
 * @returns {string[]} 警告メッセージの配列
 */
export function generateCompatibilityWarnings(
  capabilities: DeviceCapabilities,
  batteryStatus: BatteryStatus,
  networkStatus: NetworkStatus
): string[] {
  const warnings: string[] = [];

  try {
    // 必須機能のチェック
    if (!capabilities.microphone) {
      warnings.push('マイク機能が利用できません。ブラウザの設定を確認してください。');
    }

    if (!capabilities.webAudio) {
      warnings.push('音声処理機能が利用できません。最新のブラウザにアップデートしてください。');
    }

    if (!capabilities.localStorage && !capabilities.sessionStorage) {
      warnings.push('データ保存機能が利用できません。プライベートモードを解除してください。');
    }

    // HTTPSチェックは削除 - HTTP環境でも動作可能
    // if (!capabilities.https) {
    //   warnings.push('安全な接続（HTTPS）が必要です。');
    // }

    // バッテリー警告
    if (batteryStatus.supported && batteryStatus.criticalLevel) {
      warnings.push('バッテリー残量が非常に少ないです（5%以下）。充電してください。');
    } else if (batteryStatus.supported && batteryStatus.lowPowerMode) {
      warnings.push('バッテリー残量が少ないため、一部機能が制限される可能性があります。');
    }

    // ネットワーク警告
    if (!networkStatus.online) {
      warnings.push('インターネット接続がありません。');
    } else if (networkStatus.slowConnection) {
      warnings.push('通信速度が遅いため、一部機能が制限される可能性があります。');
    }

    if (networkStatus.saveData) {
      warnings.push('データセーバーモードが有効です。一部機能が制限される可能性があります。');
    }

  } catch {
    // 警告生成エラーを静かに処理
  }

  return warnings;
}

/**
 * ブラウザ互換性の詳細情報を取得する
 * @returns {object} ブラウザ情報
 */
export function getBrowserInfo() {
  try {
    const ua = navigator.userAgent;
    const info = {
      isChrome: /Chrome/.test(ua) && !/Edge/.test(ua),
      isFirefox: /Firefox/.test(ua),
      isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
      isEdge: /Edge/.test(ua),
      isSamsung: /SamsungBrowser/.test(ua),
      isOpera: /OPR/.test(ua) || /Opera/.test(ua),
      isIOS: /iPhone|iPad|iPod/.test(ua),
      isAndroid: /Android/.test(ua),
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
      version: '',
    };

    // バージョン取得
    if (info.isChrome) {
      const match = ua.match(/Chrome\/(\d+)/);
      info.version = match ? match[1] : '';
    } else if (info.isFirefox) {
      const match = ua.match(/Firefox\/(\d+)/);
      info.version = match ? match[1] : '';
    } else if (info.isSafari) {
      const match = ua.match(/Version\/(\d+)/);
      info.version = match ? match[1] : '';
    }

    return info;
  } catch {
    return {
      isChrome: false,
      isFirefox: false,
      isSafari: false,
      isEdge: false,
      isSamsung: false,
      isOpera: false,
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      version: '',
    };
  }
}