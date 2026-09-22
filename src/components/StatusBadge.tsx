import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = (status || '').toUpperCase();

  let bgClass = 'bg-slate-100 text-slate-700 border-slate-300';
  let dotClass = 'bg-slate-400';

  if (['ACTIVE', 'COMPLETED', 'VALIDATED', 'READY', 'SUCCESS'].includes(normalized)) {
    bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    dotClass = 'bg-emerald-500';
  } else if (['TRAINING', 'RUNNING', 'IN_PROGRESS', 'PREPROCESSED'].includes(normalized)) {
    bgClass = 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
    dotClass = 'bg-blue-500';
  } else if (['WAITING', 'PENDING'].includes(normalized)) {
    bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
    dotClass = 'bg-amber-500';
  } else if (['FAILED', 'OFFLINE', 'INACTIVE', 'SUSPENDED'].includes(normalized)) {
    bgClass = 'bg-rose-50 text-rose-700 border-rose-200';
    dotClass = 'bg-rose-500';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bgClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
      {status}
    </span>
  );
};
