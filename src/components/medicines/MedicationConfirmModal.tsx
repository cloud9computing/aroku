import React from 'react';
import { ExtractedMedication } from '../../services/gemini';
import { medicineDisplayName } from '../../utils/medicineName';
import { IconCheck, IconPill, IconX } from '@tabler/icons-react';

export interface PendingMedication {
  extracted: ExtractedMedication;
  include: boolean;
  isDuplicate?: boolean;
}

interface MedicationConfirmModalProps {
  isOpen: boolean;
  personName: string;
  pendingMeds: PendingMedication[];
  onToggle: (index: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const MedicationConfirmModal: React.FC<MedicationConfirmModalProps> = ({
  isOpen,
  personName,
  pendingMeds,
  onToggle,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const includedCount = pendingMeds.filter((m) => m.include).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-lavender-light text-lavender flex items-center justify-center">
              <IconPill size={16} />
            </div>
            <div>
              <h3 className="font-serif text-lg text-ink-800 leading-tight">
                Found {pendingMeds.length} {pendingMeds.length === 1 ? 'medicine' : 'medicines'}
              </h3>
              <p className="text-[10px] text-ink-400">Add to {personName}&apos;s medicines?</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="py-3 space-y-2 text-xs overflow-y-auto pr-0.5 flex-1">
          {pendingMeds.map((pm, idx) => {
            const { primary, secondary } = medicineDisplayName(pm.extracted);
            return (
            <button
              key={idx}
              onClick={() => onToggle(idx)}
              className={`w-full text-left p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                pm.include ? 'bg-white border-paper-400' : 'bg-paper-300/50 border-paper-300 opacity-60'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${
                  pm.include ? 'bg-terracotta text-white' : 'border border-ink-300 bg-white'
                }`}
              >
                {pm.include && <IconCheck size={11} />}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-ink-800 flex items-center gap-1.5 flex-wrap">
                  {primary} {pm.extracted.strength}
                  {secondary && <span className="text-ink-400 font-normal italic">{secondary}</span>}
                  {pm.isDuplicate && (
                    <span className="text-[9px] text-ochre bg-ochre-light/60 px-1.5 py-0.5 rounded-md font-normal normal-case tracking-normal">
                      Already in Medicines
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-ink-400 mt-0.5">
                  {pm.extracted.time_of_day.join(', ')} · {pm.extracted.food_relation.replace('_', ' ')} · from{' '}
                  {pm.extracted.start_date}
                  {pm.extracted.end_date ? ` to ${pm.extracted.end_date}` : ''}
                </p>
              </div>
            </button>
            );
          })}
        </div>

        <div className="pt-2.5 border-t border-paper-300 flex gap-2 flex-shrink-0">
          <button
            onClick={onConfirm}
            disabled={includedCount === 0}
            className="flex-1 py-2.5 bg-terracotta text-white rounded-xl text-xs font-medium hover:bg-terracotta-dark active:scale-98 transition-all disabled:opacity-50"
          >
            Add {includedCount || ''} to Medicines
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-paper-300 text-ink-600 rounded-xl text-xs font-medium hover:bg-paper-400 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};
