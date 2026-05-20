import React from 'react';
import { CheckCircle2, AlertCircle, Info, Flame, Settings } from 'lucide-react';

/**
 * [Mitus IP Web] Premium Light Glassmorphism Milestone Quality Metrics Table
 * 
 * 주변 UI의 맑은 화이트/연회색 감성에 완벽히 동화되는 
 * 투명하고 우아한 라이트 글래스모피즘 스킨의 마일스톤 통계 대시보드 컴포넌트입니다.
 */
const MilestoneMetricsTable = ({ stats }) => {
  if (!stats || stats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-sm">
        <Info size={18} className="text-slate-400 mb-1.5" />
        <span className="text-xs text-slate-400 font-medium tracking-wide">마일스톤 통계 데이터가 존재하지 않습니다.</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-2xl border border-white/40 shadow-xl shadow-slate-100/40 p-0.5 mt-6 select-none transition-all duration-500 hover:shadow-2xl hover:shadow-slate-100/60 hover:border-white/60">
      {/* 라이트 글래스 광택 반사광 효과 */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-white/5 to-transparent pointer-events-none" />
      
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600" role="table" aria-label="마일스톤 품질 리포트">
          <thead className="bg-slate-50/40 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200/40 select-none">
            <tr className="divide-x divide-slate-100/50">
              <th scope="col" className="px-4 py-2.5 font-extrabold text-slate-700 w-[20%] whitespace-nowrap">Milestone</th>
              <th scope="col" className="px-2 py-2.5 text-center font-bold text-slate-700 w-[10%] whitespace-nowrap">Total</th>
              <th scope="col" className="px-2 py-2.5 text-center font-bold text-blue-700 w-[14%] whitespace-nowrap">Closed</th>
              <th scope="col" className="px-2 py-2.5 text-center font-bold text-amber-700 w-[22%] whitespace-nowrap">
                <div className="flex flex-col items-center leading-none whitespace-nowrap">
                  <span className="text-[10px] tracking-wider font-extrabold">OPEN</span>
                  <span className="text-[9px] text-amber-600/70 font-semibold normal-case mt-0.5 tracking-tight font-sans">
                    (REV / DEBT)
                  </span>
                </div>
              </th>
              <th scope="col" className="px-2 py-2.5 text-center font-bold text-purple-700 w-[16%] whitespace-nowrap">Deferred</th>
              <th scope="col" className="px-4 py-2.5 text-center font-bold text-slate-700 w-[18%] whitespace-nowrap">
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="tracking-wider">RESOLUTION</span>
                  <span className="mt-0.5 tracking-wider">RATE</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/40 font-mono tabular-nums">
            {stats.map((row) => {
              const isCurrent = row.isCurrent;
              
              // 완료율 수치에 따른 파란색 톤온톤 그라데이션 연출 (붉은색/경고색 완전 배제)
              const rateNum = parseFloat(row.resolutionRate);
              let rateBadgeClass = 'text-slate-500 bg-slate-50 border-slate-200/50';
              let rateBarColor = 'from-slate-400 to-slate-300';
              
              if (rateNum === 100) {
                // 완전히 종결된 경우: 깊고 선명한 인디고 블루
                rateBadgeClass = 'text-indigo-600 bg-indigo-50 border-indigo-100/50';
                rateBarColor = 'from-indigo-600 to-indigo-400';
              } else if (rateNum >= 70) {
                // 상당수 진행된 경우: 청량한 스카이 블루
                rateBadgeClass = 'text-sky-600 bg-sky-50 border-sky-100/50';
                rateBarColor = 'from-sky-500 to-sky-400';
              } else if (rateNum > 0) {
                // 일부만 진행된 경우: 부드러운 오션 블루
                rateBadgeClass = 'text-blue-600 bg-blue-50 border-blue-100/50';
                rateBarColor = 'from-blue-500 to-blue-400';
              }
 
              return (
                <tr 
                  key={row.milestone} 
                  className={`group transition-all duration-300 hover:bg-slate-50/40 divide-x divide-slate-100/30 ${
                    isCurrent ? 'bg-blue-500/[0.015] border-l-2 border-l-blue-500' : ''
                  }`}
                  role="row"
                >
                  {/* 마일스톤 명칭 */}
                  <td className="px-4 py-2 font-sans font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors w-[20%] whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black tracking-tight">{row.milestone}</span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 border border-blue-100/40 text-[8px] font-black px-1 py-0.5 rounded shadow-sm scale-90 select-none animate-pulse">
                          <span className="w-1 h-1 rounded-full bg-blue-500" />
                          <span>CURRENT</span>
                        </span>
                      )}
                    </div>
                  </td>
 
                  {/* 총량 */}
                  <td className="px-2 py-2 text-center text-slate-600 font-semibold w-[10%] whitespace-nowrap">
                    {row.total}
                  </td>
 
                  {/* 종결 완료 */}
                  <td className="px-2 py-2 text-center w-[14%] whitespace-nowrap">
                    <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 text-[11px] font-black text-blue-600 bg-blue-50/70 border border-blue-100/50 rounded-md shadow-sm">
                      {row.closed}
                    </span>
                  </td>
 
                  {/* 관리형 부채 (Open) - Inline Primary-Secondary Layout + New Indicator */}
                  <td className="px-2 py-2 text-center w-[22%] whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Primary Metric: Soft Amber Tint Badge */}
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 text-[11px] font-black text-amber-600 bg-amber-50/70 border border-amber-100/60 rounded-md shadow-sm">
                        {row.debt}
                      </span>
                      
                      {/* Secondary breakdown details (Revision / Core Debt) */}
                      {row.debt > 0 && row.debtDetails ? (
                        <span className="inline-flex items-center text-[10px] text-slate-400/90 font-bold tracking-tight bg-slate-50/80 border border-slate-100/70 px-1.5 py-0.5 rounded font-mono shadow-sm">
                          {(row.debtDetails.Revision || 0)}
                          <span className="text-slate-300 font-light mx-0.5">/</span>
                          {row.debt - (row.debtDetails.Revision || 0)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300/80 font-normal font-mono">-</span>
                      )}

                      {/* NEW 건수 인라인 병합 — CLS 방지: visibility toggle (공간 항상 확보) */}
                      <span
                        className={`inline-flex items-center text-[10px] font-black text-rose-500 bg-rose-50/70 border border-rose-100/50 px-1 py-0.5 rounded whitespace-nowrap transition-opacity duration-200 ${
                          (row.new ?? 0) > 0 ? 'opacity-100' : 'invisible'
                        }`}
                        aria-hidden={(row.new ?? 0) === 0}
                      >
                        +{row.new ?? 0}
                      </span>
                    </div>
                  </td>
 
                  {/* 과거 차수 이관 (Deferred) */}
                  <td className="px-2 py-2 text-center w-[16%] whitespace-nowrap">
                    {row.carryover !== undefined && row.carryover !== null && row.carryover > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 text-[11px] font-black text-purple-600 bg-purple-50/70 border border-purple-100/50 rounded-md shadow-sm">
                        {row.carryover}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300/80 font-normal font-mono">-</span>
                    )}
                  </td>
 
                  {/* 조치 완료율 */}
                  <td className="px-4 py-2 text-center w-[18%] whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded border text-[10px] font-extrabold ${rateBadgeClass}`}>
                        {row.resolutionRate}
                      </span>
                      {/* 미세 프로그레스 바 */}
                      <div className="w-12 h-1.5 bg-slate-100/80 rounded-full overflow-hidden select-none border border-slate-200/30">
                        <div 
                          className={`h-full bg-gradient-to-r ${rateBarColor} rounded-full transition-all duration-500 ease-out`}
                          style={{ width: row.resolutionRate }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MilestoneMetricsTable;
