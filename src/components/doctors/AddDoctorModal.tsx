import React, { useEffect, useState } from 'react';
import { CareTeamMember, CareTeamPatientType } from '../../types';
import { IconStethoscope, IconX } from '@tabler/icons-react';
import { DoctorFormFields, DoctorDraft } from './DoctorFormFields';

interface AddDoctorModalProps {
  isOpen: boolean;
  initialValues?: { name?: string; specialty?: string; clinic?: string };
  defaultPatientType?: CareTeamPatientType;
  onAddDoctor: (doctor: CareTeamMember) => void;
  onClose: () => void;
}

function emptyDraft(
  defaultPatientType: CareTeamPatientType,
  initialValues?: { name?: string; specialty?: string; clinic?: string }
): DoctorDraft {
  return {
    name: initialValues?.name || '',
    specialty: initialValues?.specialty || '',
    clinic: initialValues?.clinic || '',
    phone: '',
    address: '',
    notes: '',
    patient_type: defaultPatientType,
  };
}

export const AddDoctorModal: React.FC<AddDoctorModalProps> = ({
  isOpen,
  initialValues,
  defaultPatientType = 'human',
  onAddDoctor,
  onClose,
}) => {
  const [draft, setDraft] = useState<DoctorDraft>(() => emptyDraft(defaultPatientType, initialValues));

  useEffect(() => {
    if (isOpen) {
      setDraft(emptyDraft(defaultPatientType, initialValues));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;

    onAddDoctor({
      id: `ct-${Date.now()}`,
      name: name.startsWith('Dr.') ? name : `Dr. ${name}`,
      specialty: draft.specialty.trim() || 'General Medicine',
      clinic: draft.clinic.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      address: draft.address.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      consent_state: 'not_asked',
      patient_type: draft.patient_type,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <IconStethoscope size={18} className="text-terracotta" />
            <h3 className="font-serif text-lg text-ink-800">Add Doctor</h3>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-3 text-xs text-ink-700 pr-0.5">
          <DoctorFormFields value={draft} onChange={setDraft} nameRequired />

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-terracotta text-white rounded-xl text-xs font-medium hover:bg-terracotta-dark active:scale-98 transition-all"
            >
              Save Doctor
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-paper-300 text-ink-600 rounded-xl text-xs font-medium hover:bg-paper-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
