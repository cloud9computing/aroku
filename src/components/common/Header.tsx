import React from 'react';
import { Person } from '../../types';
import { IconBell, IconChevronDown, IconSettings } from '@tabler/icons-react';

interface HeaderProps {
  currentPerson: Person;
  unreadNotifsCount: number;
  onOpenPersonSwitcher: () => void;
  onOpenNotifications: () => void;
  onOpenHousehold: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPerson,
  unreadNotifsCount,
  onOpenPersonSwitcher,
  onOpenNotifications,
  onOpenHousehold,
}) => {
  return (
    <header className="bg-paper-50 border-b border-paper-300 px-4 pt-[max(env(safe-area-inset-top,0px),10px)] pb-2.5 flex items-center justify-between sticky top-0 z-30 select-none flex-shrink-0">
      {/* Person Switcher Trigger */}
      <button
        onClick={onOpenPersonSwitcher}
        className="flex items-center gap-2 px-2 py-1 -ml-1.5 rounded-xl hover:bg-paper-400 active:scale-95 transition-all text-left group"
        aria-label="Switch person"
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shadow-2xs transition-transform group-hover:scale-105"
          style={{ backgroundColor: currentPerson.avatar_bg, color: currentPerson.avatar_color }}
        >
          {currentPerson.avatar_initial}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[13.5px] font-medium text-ink-800 tracking-tight">
            {currentPerson.name}
          </span>
          <IconChevronDown size={14} className="text-ink-200 group-hover:text-ink-600 transition-colors" />
        </div>
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onOpenHousehold}
          className="p-1.5 rounded-full hover:bg-paper-400 active:scale-95 text-ink-900 transition-all"
          title="Household & invite code"
          aria-label="Household settings"
        >
          <IconSettings size={17} />
        </button>

        <button
          onClick={onOpenNotifications}
          className="relative p-1.5 rounded-full hover:bg-paper-400 active:scale-95 text-ink-900 transition-all"
          aria-label="Notifications"
        >
          <IconBell size={17} />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-terracotta rounded-full ring-2 ring-paper-50 animate-pulse" />
          )}
        </button>
      </div>
    </header>
  );
};
