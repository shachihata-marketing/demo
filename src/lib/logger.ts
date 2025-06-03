/**
 * カスタムロガー - センシティブ情報をフィルタリング
 */

const SENSITIVE_PATTERNS = [
  'apikey:',
  'dk:',
  'campaign_id:',
  'sdkInitialized:',
  'need_decode_meta:',
  'eMaYe9yDYUY',
  'FAGKZP9BuM3k5Iud'
];

export const logger = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'production') return;
    
    const message = args.join(' ');
    const containsSensitive = SENSITIVE_PATTERNS.some(pattern => 
      message.includes(pattern)
    );
    
    if (!containsSensitive) {
      console.log(...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  
  error: (...args: unknown[]) => {
    console.error(...args);
  }
};

// グローバルconsoleを上書き（オプション）
if (typeof window !== 'undefined') {
  (window as Window & { originalConsole?: { log: typeof console.log; debug: typeof console.debug; info: typeof console.info } }).originalConsole = {
    log: console.log,
    debug: console.debug,
    info: console.info
  };
}