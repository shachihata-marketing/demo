'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { motion } from 'framer-motion';

// SSRを無効にしてWheelコンポーネントをインポート
const Wheel = dynamic(() => import('react-custom-roulette').then((mod) => mod.Wheel), { ssr: false });

interface RouletteWheelProps {
  onSpinComplete: (prize: string) => void;
}

export default function RouletteWheel({ onSpinComplete }: RouletteWheelProps) {
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeNumber, setPrizeNumber] = useState(0);

  const data = [
    {
      option: '🎯 あたり！',
      style: { backgroundColor: '#FFD700', textColor: '#333', fontSize: 20 },
      optionSize: 1,
    },
    {
      option: '😢 ハズレ',
      style: { backgroundColor: '#87CEEB', textColor: '#333', fontSize: 20 },
      optionSize: 1,
    },
    {
      option: '🎯 あたり！',
      style: { backgroundColor: '#FFB6C1', textColor: '#333', fontSize: 20 },
      optionSize: 1,
    },
    {
      option: '😢 ハズレ',
      style: { backgroundColor: '#98FB98', textColor: '#333', fontSize: 20 },
      optionSize: 1,
    },
    {
      option: '🎯 あたり！',
      style: { backgroundColor: '#DDA0DD', textColor: '#333', fontSize: 20 },
      optionSize: 1,
    },
    {
      option: '😢 ハズレ',
      style: { backgroundColor: '#F0E68C', textColor: '#333', fontSize: 20 },
      optionSize: 1,
    },
  ];

  const handleSpinClick = () => {
    if (!mustSpin) {
      const newPrizeNumber = Math.floor(Math.random() * data.length);
      setPrizeNumber(newPrizeNumber);
      setMustSpin(true);
      // デバッグ用ログ
      console.log(`ルーレット結果: Index ${newPrizeNumber} = ${data[newPrizeNumber].option}`);
    }
  };

  return (
    <div className='flex flex-col items-center'>
      {/* 装飾的な背景 */}
      <div className='relative p-8 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full shadow-2xl'>
        <div className='absolute inset-0 bg-white opacity-50 rounded-full'></div>
        <div className='relative'>
          <Wheel
            mustStartSpinning={mustSpin}
            prizeNumber={prizeNumber}
            data={data}
            onStopSpinning={() => {
              setMustSpin(false);
              // react-custom-rouletteのバグ対応：実際の停止位置を補正
              // ポインターが上（12時）にあるとき、インデックス0が右側から始まるため補正が必要
              const correctedIndex = (prizeNumber + 1) % data.length;
              const prize = data[correctedIndex].option;
              console.log(`ルーレット停止: Index ${prizeNumber} -> 補正後 ${correctedIndex} = ${prize}`);
              onSpinComplete(prize);
            }}
            fontSize={18}
            fontFamily='Arial'
            fontWeight='bold'
            textDistance={55}
            outerBorderColor='#8B5CF6'
            outerBorderWidth={8}
            innerRadius={30}
            innerBorderColor='#8B5CF6'
            innerBorderWidth={8}
            radiusLineColor='#ffffff'
            radiusLineWidth={3}
            spinDuration={1.0}
            startingOptionIndex={0}
            perpendicularText={true}
            pointerProps={{
              src: '',
              style: { display: 'none' },
            }}
          />
          {/* カスタムポインター - 上部（12時の位置）に戻す */}
          <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[140%]'>
            <motion.div className='relative' animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
              <div className='w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-b-[25px] border-b-red-600 shadow-lg'></div>
              <div className='absolute top-[22px] left-1/2 transform -translate-x-1/2 text-red-600 text-xs font-bold'>▼</div>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.button
        onClick={handleSpinClick}
        disabled={mustSpin}
        className={`mt-8 px-8 py-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-md font-bold rounded-full shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 ${
          mustSpin ? 'cursor-wait opacity-80' : ''
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}>
        <span className='text-2xl'>🎲</span>
        <span>{mustSpin ? '回転中...' : 'ルーレットを回す'}</span>
        <span className='text-2xl'>🎯</span>
      </motion.button>
    </div>
  );
}
