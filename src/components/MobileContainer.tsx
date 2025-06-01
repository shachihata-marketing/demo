'use client';

import { ReactNode } from 'react';

interface MobileContainerProps {
  children: ReactNode;
}

export default function MobileContainer({ children }: MobileContainerProps) {
  return (
    <>
      {/* Desktop View with iPhone Mockup */}
      <div className="hidden md:flex min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 items-center justify-center p-8">
        <div className="relative">
          {/* iPhone Frame */}
          <div className="relative mx-auto" style={{ width: '414px', height: '896px' }}>
            {/* Phone Border */}
            <div className="absolute inset-0 bg-black rounded-[60px] shadow-2xl"></div>
            
            {/* Screen Border */}
            <div className="absolute inset-[3px] bg-black rounded-[57px]"></div>
            
            {/* Screen */}
            <div className="absolute inset-[18px] bg-white rounded-[42px] overflow-hidden">
              {/* Status Bar */}
              <div className="absolute top-0 inset-x-0 h-11 bg-white z-10 flex items-center justify-between px-8">
                <div className="flex items-center gap-1">
                  <div className="text-xs font-semibold">9:41</div>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2 17h20v2H2zm1.15-4.05L4 11.47l.85 1.48 1.3-.75-.85-1.48H7v-1.5H2v1.5h2.15L3 10.72c-.4.85-.35 1.85.15 2.68l1.48.85c.7.4 1.55.35 2.18-.15l.72-1.48-1.38-.8z"/>
                  </svg>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 9l2-2v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7l2 2V2L1 2v7z"/>
                  </svg>
                  <svg className="w-6 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="2" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <rect x="20" y="9" width="2" height="6" rx="1"/>
                    <rect x="5" y="8" width="12" height="8" rx="1"/>
                  </svg>
                </div>
              </div>
              
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 flex justify-center">
                <div className="bg-black w-40 h-7 rounded-b-3xl"></div>
              </div>
              
              {/* Content */}
              <div className="h-full w-full overflow-y-auto overflow-x-hidden pt-11 pb-8 relative">
                {children}
              </div>
              
              {/* Home Indicator */}
              <div className="absolute bottom-2 inset-x-0 flex justify-center">
                <div className="w-32 h-1 bg-black rounded-full opacity-30"></div>
              </div>
            </div>
          </div>
          
          {/* Device Info */}
          <div className="mt-8 text-center">
            <p className="text-white text-lg font-medium">シヤチハタ動物園デモページ</p>
            <p className="text-gray-400 text-sm mt-1">音響認識スタンプラリー デモンストレーション</p>
          </div>
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden min-h-screen bg-white">
        {children}
      </div>
    </>
  );
}