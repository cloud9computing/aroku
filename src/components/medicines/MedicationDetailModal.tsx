import React from 'react';
import { Medication } from '../../types';
import { medicineDisplayName } from '../../utils/medicineName';
import { IconPlayerPause, IconPlayerPlay, IconTrash, IconX } from '@tabler/icons-react';

interface MedicationDetailModalProps {
  medication: Medication | null;
  isOpen: boolean;
  onUpdateMedication: (med: Medication) => void;
  onDeleteMedication: (medId: string) => void;
  onClose: () => void;
}

export const MedicationDetailModal: React.FC<MedicationDetailModalProps> = ({
  medication,
  isOpen,
  onUpdateMedication,
  onDeleteMedication,
  onClose,
}) => {
  if (!isOpen || !medication) return null;

  const { primary, secondary } = medicineDisplayName(medication);

  const handleToggleStatus = () => {
    if (medication.status === 'active') {
      const reason = window.prompt('Optional: why is this being stopped? (leave blank to skip)') || undefined;
      onUpdateMedication({ ...medication, status: 'stopped', stop_reason: reason });
    } else {
      onUpdateMedication({ ...medication, status: 'active', stop_reason: undefined });
    }
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Delete ${medication.molecule} ${medication.strength} entirely? This removes it for everyone in the family and can't be undone. If you're stopping a real medication, "Mark as stopped" keeps the history instead.`)) {
      onDeleteMedication(medication.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[85dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div>
            <h3 className="font-serif text-lg text-ink-800 leading-tight">
              {primary} {medication.strength}
            </h3>
            {secondary && <p className="text-[10.5px] text-ink-400 italic">{secondary}</p>}
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="py-3 space-y-2.5 text-xs overflow-y-auto pr-0.5">
          <div className="bg-white border border-paper-300 rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-ink-400">Status</span>
              <span className={`font-medium ${medication.status === 'active' ? 'text-sage' : 'text-ink-400'}`}>
                {medication.status === 'active' ? 'Active' : 'Stopped'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Time of day</span>
              <span className="text-ink-800 capitalize">{medication.time_of_day.join(', ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Food relation</span>
              <span className="text-ink-800">{medication.food_relation.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Prescribed by</span>
              <span className="text-ink-800">{medication.prescriber_name} ({medication.prescriber_specialty})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-400">Since</span>
              <span className="text-ink-800">{medication.prescribed_date}</span>
            </div>
            {medication.end_date && (
              <div className="flex justify-between">
                <span className="text-ink-400">Course ends</span>
                <span className="text-ink-800">{medication.end_date}</span>
              </div>
            )}
            {medication.notes && (
              <div className="pt-1.5 border-t border-paper-300">
                <span className="text-ink-400">Note: </span>
                <span className="text-ink-700">{medication.notes}</span>
              </div>
            )}
            {medication.stop_reason && (
              <div className="pt-1.5 border-t border-paper-300">
                <span className="text-ink-400">Stopped because: </span>
                <span className="text-ink-700">{medication.stop_reason}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleToggleStatus}
            className="w-full py-2.5 bg-paper-300 hover:bg-paper-400 text-ink-700 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            {medication.status === 'active' ? (
              <>
                <IconPlayerPause size={14} /> Mark as stopped
              </>
            ) : (
              <>
                <IconPlayerPlay size={14} /> Mark as active again
              </>
            )}
          </button>

          <button
            onClick={handleDelete}
            className="w-full py-2.5 border border-terracotta/30 text-terracotta hover:bg-terracotta-light/40 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <IconTrash size={14} /> Delete entirely
          </button>
        </div>
      </div>
    </div>
  );
};
