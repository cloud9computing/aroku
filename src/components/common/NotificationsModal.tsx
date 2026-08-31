import React from 'react';
import { AppNotification } from '../../types';
import { IconBell, IconCheck, IconFileAlert, IconX } from '@tabler/icons-react';

interface NotificationsModalProps {
  isOpen: boolean;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onNavigateToVerify?: () => void;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  notifications,
  onMarkRead,
  onNavigateToVerify,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[85dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <IconBell size={18} className="text-terracotta" />
            <h3 className="font-serif text-lg text-ink-800">Notifications</h3>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="py-2.5 space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-xs text-ink-400">No active notifications</div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border transition-all ${
                  notif.read ? 'bg-white/60 border-paper-300 text-ink-500' : 'bg-white border-paper-400 text-ink-800 shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {notif.type === 'verify' ? (
                      <div className="w-5 h-5 rounded-full bg-ochre-light text-ochre flex items-center justify-center flex-shrink-0 mt-0.5">
                        <IconFileAlert size={12} />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-sage-light text-sage flex items-center justify-center flex-shrink-0 mt-0.5">
                        <IconBell size={12} />
                      </div>
                    )}
                    <div>
                      <h4 className="text-[12px] font-medium leading-tight">{notif.title}</h4>
                      <p className="text-[10.5px] text-ink-600 mt-0.5 leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                  {!notif.read && (
                    <button
                      onClick={() => onMarkRead(notif.id)}
                      className="text-ink-300 hover:text-sage p-1 flex-shrink-0"
                      title="Mark as read"
                    >
                      <IconCheck size={14} />
                    </button>
                  )}
                </div>

                {notif.type === 'verify' && onNavigateToVerify && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToVerify();
                    }}
                    className="mt-2 text-[10.5px] text-terracotta font-medium hover:underline block"
                  >
                    Review in Records →
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
