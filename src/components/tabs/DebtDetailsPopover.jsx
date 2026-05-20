import React from 'react';

/**
 * [Mitus IP Web] Premium Dark Glassmorphism Debt Details Popover Tooltip
 * 
 * 맑은 반사 테두리와 투명한 다크 글래스모피즘 스킨을 채용하여,
 * 기존 라이트 테마 위에 올라갔을 때 뛰어난 가독성과 시각적 우아함을 선사합니다.
 */
const DebtDetailsPopover = ({ details, totalDebt }) => {
  if (!details || totalDebt === 0) return null;

  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-56 p-3.5 bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-2xl text-left text-[11px] text-slate-300 pointer-events-none opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 select-none">
      {/* 팝오버 상단 타이틀 및 정합성 헤더 */}
      <div className="font-extrabold text-slate-100 mb-2 border-b border-slate-800 pb-1.5 flex justify-between items-center tracking-tight">
        <span>OPEN 세부 구성</span>
        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-black font-mono">
          {totalDebt}건
        </span>
      </div>

      {/* 세부 구성요소 리스트 */}
      <div className="space-y-1.5 font-sans">
        {Object.entries(details).map(([key, val]) => {
          if (val === 0) return null;
          const pct = ((val / totalDebt) * 100).toFixed(0);
          return (
            <div key={key} className="flex justify-between items-center py-0.5">
              <span className="text-slate-400 font-semibold tracking-tight">{key}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-600 font-bold">({pct}%)</span>
                <span className="bg-slate-900 border border-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-mono font-black text-[10px] min-w-[18px] text-center shadow-inner">
                  {val}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 우아한 글래스 꼬리 화살표 */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-950/90" />
    </div>
  );
};

export default DebtDetailsPopover;
