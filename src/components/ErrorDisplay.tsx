'use client';

import React from 'react';
import { EFPError, EFPErrorType } from '@/hooks/useEFP2'; // EFPError型をインポート

// テストモードの定数。必要に応じて page.tsx などから渡すように変更も検討。
const TEST_MODE = process.env.NODE_ENV === 'development'; // 環境変数で切り替え推奨

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
const ErrorDisplay: React.FC<{ error: EFPError; onRetry?: () => void; onClear: () => void }> = ({ error, onRetry, onClear }) => {
  const പൊതുവായപരിഹാരം = 'しばらくしてからもう一度お試しください。解決しない場合は、アプリを再起動するか、ページを更新してみてください。'; // 一般的な解決策
  let specificSolution = '';

  switch (error.type) {
    case EFPErrorType.NotSupported:
      specificSolution = 'お使いのブラウザやデバイスでは、この機能をご利用いただけません。別のブラウザ（Chrome、Safariなど）でお試しください。';
      break;
    case EFPErrorType.PermissionDenied:
      specificSolution = 'マイクの使用が許可されていません。ブラウザや端末の設​​定で、このサイトのマイクへのアクセスを許可してください。';
      break;
    case EFPErrorType.StreamStartFailed:
      specificSolution =
        'マイクの起動に失敗しました。他のアプリがマイクを使用中でないか確認してください。それでも解決しない場合は、端末を再起動してみてください。';
      break;
    case EFPErrorType.SDKLoadFailed:
      specificSolution =
        '音響検知エンジンの読み込みに失敗しました。通信環境の良い場所で再度お試しいただくか、しばらく時間をおいてからお試しください。';
      break;
    case EFPErrorType.SDKInitFailed:
    case EFPErrorType.AudioProcessingInitFailed:
      specificSolution = '音響処理の準備に失敗しました。ページを更新してもう一度お試しください。';
      break;
    case EFPErrorType.StreamStopFailed:
      specificSolution =
        '録音の停止処理中に問題が発生しました。アプリの動作に影響はないかもしれませんが、念のためページを更新することをお勧めします。';
      break;
    default:
      specificSolution = പൊതുവായപരിഹാരം;
  }

  return (
    <div className='fixed inset-x-0 bottom-10 z-50 flex justify-center px-4'>
      <div className='w-full max-w-md rounded-lg bg-red-100 p-4 shadow-lg'>
        <div className='flex items-start'>
          <div className='flex-shrink-0'>
            <svg
              className='h-6 w-6 text-red-500'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
              strokeWidth='1.5'
              stroke='currentColor'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'
              />
            </svg>
          </div>
          <div className='ml-3 flex-1'>
            <p className='text-sm font-medium text-red-800'>エラーが発生しました</p>
            <p className='mt-1 text-sm text-red-700'>{error.message}</p>
            {specificSolution && <p className='mt-1 text-sm text-red-600'>{specificSolution}</p>}
            {TEST_MODE && error.details && <p className='mt-2 text-xs text-gray-500'>詳細: {error.details}</p>}
          </div>
          <div className='ml-4 flex-shrink-0'>
            <button
              type='button'
              onClick={onClear}
              className='inline-flex rounded-md bg-red-100 text-red-500 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-100'>
              <span className='sr-only'>閉じる</span>
              <svg className='h-5 w-5' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor' aria-hidden='true'>
                <path d='M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z' />
              </svg>
            </button>
          </div>
        </div>
        {onRetry && (
          <div className='mt-3 flex justify-end'>
            <button
              type='button'
              onClick={onRetry}
              className='rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600'>
              再試行
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay;
