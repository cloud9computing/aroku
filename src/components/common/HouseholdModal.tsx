import React, { useState } from 'react';
import { Family } from '../../firebase/family';
import { signOutCurrentUser } from '../../firebase/auth';
import { IconCheck, IconCopy, IconLogout, IconUsers, IconX } from '@tabler/icons-react';

interface HouseholdModalProps {
  isOpen: boolean;
  family: Family | null;
  onClose: () => void;
}

export const HouseholdModal: React.FC<HouseholdModalProps> = ({ isOpen, family, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    if (!family) return;
    try {
      await navigator.clipboard.writeText(family.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[85dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <IconUsers size={18} className="text-lavender" />
            <h3 className="font-serif text-lg text-ink-800">{family?.name || 'Household'}</h3>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="mt-3 space-y-4 overflow-y-auto pr-0.5">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-400 mb-1.5">
              Invite code — share with family
            </label>
            <button
              onClick={handleCopyCode}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white border border-paper-300 rounded-xl hover:border-terracotta transition-colors"
            >
              <span className="font-mono text-base tracking-[0.3em] text-ink-800">{family?.inviteCode || '——————'}</span>
              {copied ? <IconCheck size={16} className="text-sage" /> : <IconCopy size={16} className="text-ink-400" />}
            </button>
            <p className="text-[10px] text-ink-400 mt-1.5 leading-relaxed">
              Anyone with this code can join and see everyone&apos;s records — share it only with family.
            </p>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-400 mb-1.5">
              Members ({Object.keys(family?.members || {}).length})
            </label>
            <div className="space-y-1.5">
              {Object.values(family?.members || {}).map((m) => (
                <div key={m.uid} className="flex items-center gap-2.5 px-2.5 py-2 bg-white border border-paper-300 rounded-xl">
                  {m.photoURL ? (
                    <img src={m.photoURL} alt={m.displayName} className="w-7 h-7 rounded-full" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-paper-400 flex items-center justify-center text-[11px] font-medium text-ink-600">
                      {m.displayName?.[0] || '?'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-ink-800 truncate">{m.displayName}</p>
                    <p className="text-[10px] text-ink-400 truncate">{m.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => signOutCurrentUser()}
            className="w-full py-2.5 flex items-center justify-center gap-1.5 text-terracotta text-xs font-medium rounded-xl border border-terracotta/30 hover:bg-terracotta-light/40 transition-colors"
          >
            <IconLogout size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
