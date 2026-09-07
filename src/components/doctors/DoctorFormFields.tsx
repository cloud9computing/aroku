import React from 'react';
import { CareTeamPatientType } from '../../types';
import { IconPaw, IconStethoscope } from '@tabler/icons-react';

// Shared by AddDoctorModal and DoctorDetailModal's edit view so adding a
// doctor and editing one always look and behave identically.
export interface DoctorDraft {
  name: string;
  specialty: string;
  clinic: string;
  phone: string;
  address: string;
  notes: string;
  patient_type: CareTeamPatientType;
}

interface DoctorFormFieldsProps {
  value: DoctorDraft;
  onChange: (value: DoctorDraft) => void;
  nameRequired?: boolean;
}

export const DoctorFormFields: React.FC<DoctorFormFieldsProps> = ({ value, onChange, nameRequired }) => {
  const set = <K extends keyof DoctorDraft>(key: K, v: DoctorDraft[K]) => onChange({ ...value, [key]: v });
  const inputClass =
    'w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta';
  const labelClass = 'block text-[11px] uppercase tracking-wider text-ink-400 mb-1';

  return (
    <>
      <div>
        <label className={labelClass}>Treats</label>
        <div className="flex gap-0.5 bg-paper-400 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => set('patient_type', 'human')}
            className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              value.patient_type === 'human' ? 'bg-white text-ink-800 shadow-xs' : 'text-ink-500'
            }`}
          >
            <IconStethoscope size={13} /> Humans
          </button>
          <button
            type="button"
            onClick={() => set('patient_type', 'pet')}
            className={`flex-1 py-1.5 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              value.patient_type === 'pet' ? 'bg-white text-ink-800 shadow-xs' : 'text-ink-500'
            }`}
          >
            <IconPaw size={13} /> Pets
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            required={nameRequired}
            value={value.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. S. Nair"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Specialty</label>
          <input
            type="text"
            value={value.specialty}
            onChange={(e) => set('specialty', e.target.value)}
            placeholder="e.g. Cardiology"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Hospital / Clinic</label>
        <input
          type="text"
          value={value.clinic}
          onChange={(e) => set('clinic', e.target.value)}
          placeholder="e.g. Apollo Hospitals"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="tel"
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+91 98765 43210"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Directions</label>
          <input
            type="text"
            value={value.address}
            onChange={(e) => set('address', e.target.value)}
            placeholder="Paste a Google Maps link (or type an address)"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Note (optional)</label>
        <input
          type="text"
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="e.g. Recommended by Aunt Priya"
          className={inputClass}
        />
      </div>
    </>
  );
};
