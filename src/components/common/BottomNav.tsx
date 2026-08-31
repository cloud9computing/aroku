import React from 'react';
import { IconCalendar, IconFolder, IconPill, IconStethoscope } from '@tabler/icons-react';

export type TabType = 'records' | 'medicines' | 'visits' | 'doctors';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  return (
    <nav className="bg-paper-50 border-t border-paper-300 px-3 pt-2 pb-[max(env(safe-area-inset-bottom,0px),10px)] flex justify-around items-center select-none z-20 flex-shrink-0">
      <button
        onClick={() => onChangeTab('records')}
        className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition-all active:scale-95 ${
          activeTab === 'records' ? 'text-terracotta' : 'text-ink-200 hover:text-ink-500'
        }`}
        aria-label="Records tab"
      >
        <IconFolder size={19} stroke={activeTab === 'records' ? 2 : 1.5} />
        <span className="text-[9px] font-medium tracking-tight">Records</span>
      </button>

      <button
        onClick={() => onChangeTab('medicines')}
        className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition-all active:scale-95 ${
          activeTab === 'medicines' ? 'text-terracotta' : 'text-ink-200 hover:text-ink-500'
        }`}
        aria-label="Medicines tab"
      >
        <IconPill size={19} stroke={activeTab === 'medicines' ? 2 : 1.5} />
        <span className="text-[9px] font-medium tracking-tight">Medicines</span>
      </button>

      <button
        onClick={() => onChangeTab('visits')}
        className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition-all active:scale-95 ${
          activeTab === 'visits' ? 'text-terracotta' : 'text-ink-200 hover:text-ink-500'
        }`}
        aria-label="Visits tab"
      >
        <IconCalendar size={19} stroke={activeTab === 'visits' ? 2 : 1.5} />
        <span className="text-[9px] font-medium tracking-tight">Visits</span>
      </button>

      <button
        onClick={() => onChangeTab('doctors')}
        className={`flex flex-col items-center gap-0.5 px-5 py-1 rounded-xl transition-all active:scale-95 ${
          activeTab === 'doctors' ? 'text-terracotta' : 'text-ink-200 hover:text-ink-500'
        }`}
        aria-label="Doctors tab"
      >
        <IconStethoscope size={19} stroke={activeTab === 'doctors' ? 2 : 1.5} />
        <span className="text-[9px] font-medium tracking-tight">Doctors</span>
      </button>
    </nav>
  );
};
