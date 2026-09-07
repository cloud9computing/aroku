import React, { useEffect, useState } from 'react';
import { CareTeamMember } from '../../types';
import { resolvePatientType } from '../../utils/careTeam';
import { buildDirectionsUrl } from '../../utils/directions';
import { DoctorFormFields, DoctorDraft } from './DoctorFormFields';
import {
  IconMapPin,
  IconMicrophone,
  IconMicrophoneOff,
  IconPencil,
  IconPhone,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

interface DoctorDetailModalProps {
  doctor: CareTeamMember | null;
  isOpen: boolean;
  onUpdateDoctor: (doctor: CareTeamMember) => void;
  onDeleteDoctor: (doctorId: string) => void;
  onClose: () => void;
}

function toDraft(doctor: CareTeamMember): DoctorDraft {
  return {
    name: doctor.name,
    specialty: doctor.specialty,
    clinic: doctor.clinic || '',
    phone: doctor.phone || '',
    address: doctor.address || '',
    notes: doctor.notes || '',
    patient_type: resolvePatientType(doctor),
  };
}

export const DoctorDetailModal: React.FC<DoctorDetailModalProps> = ({
  doctor,
  isOpen,
  onUpdateDoctor,
  onDeleteDoctor,
  onClose,
}) => {
  // Opens straight into edit mode, pre-filled — tapping a card to view a
  // doctor is almost always to fix or add a detail, so a separate "view then
  // tap edit" step was just an extra click before getting there.
  const [isEditing, setIsEditing] = useState(true);
  const [draft, setDraft] = useState<DoctorDraft | null>(doctor ? toDraft(doctor) : null);

  useEffect(() => {
    setDraft(doctor ? toDraft(doctor) : null);
    setIsEditing(true);
  }, [doctor]);

  if (!isOpen || !doctor || !draft) return null;

  const handleSaveEdit = () => {
    const name = draft.name.trim();
    if (!name) return;
    onUpdateDoctor({
      ...doctor,
      name,
      specialty: draft.specialty.trim() || 'General Medicine',
      clinic: draft.clinic.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      address: draft.address.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      patient_type: draft.patient_type,
    });
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(`Remove ${doctor.name} from your doctors list? This can't be undone.`)) {
      onDeleteDoctor(doctor.id);
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
            <h3 className="font-serif text-lg text-ink-800 leading-tight">{doctor.name}</h3>
            <p className="text-[10.5px] text-terracotta">{doctor.specialty}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsEditing((e) => !e)}
              className="text-ink-400 hover:text-ink-800 p-1"
              title={isEditing ? 'View' : 'Edit'}
            >
              <IconPencil size={16} />
            </button>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
              <IconX size={18} />
            </button>
          </div>
        </div>

        <div className="py-3 space-y-2.5 text-xs overflow-y-auto pr-0.5">
          {isEditing ? (
            <div className="space-y-3">
              <DoctorFormFields value={draft} onChange={setDraft} />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-2.5 bg-terracotta text-white rounded-xl text-xs font-medium hover:bg-terracotta-dark active:scale-98 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 bg-paper-300 text-ink-600 rounded-xl text-xs font-medium hover:bg-paper-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-paper-300 rounded-xl p-3 space-y-1.5">
              {doctor.clinic && (
                <div className="flex justify-between">
                  <span className="text-ink-400">Hospital / Clinic</span>
                  <span className="text-ink-800 text-right">{doctor.clinic}</span>
                </div>
              )}
              {doctor.notes && (
                <div className="pt-1.5 border-t border-paper-300">
                  <span className="text-ink-400">Note: </span>
                  <span className="text-ink-700">{doctor.notes}</span>
                </div>
              )}
              {!doctor.clinic && !doctor.phone && !doctor.address && !doctor.notes && (
                <p className="text-ink-300 italic text-center py-2">No contact details saved yet — tap edit to add some.</p>
              )}
            </div>
          )}

          {(doctor.phone || doctor.address) && !isEditing && (
            <div className="grid grid-cols-2 gap-2">
              {doctor.phone && (
                <a
                  href={`tel:${doctor.phone.replace(/\s+/g, '')}`}
                  className="py-2.5 bg-sage-light text-sage-dark rounded-xl font-medium flex items-center justify-center gap-1.5"
                >
                  <IconPhone size={14} /> Call
                </a>
              )}
              {doctor.address && (
                <a
                  href={buildDirectionsUrl(doctor.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 bg-lavender-light text-lavender rounded-xl font-medium flex items-center justify-center gap-1.5"
                >
                  <IconMapPin size={14} /> Directions
                </a>
              )}
            </div>
          )}

          {!isEditing && (
            <div className="flex items-center justify-between bg-white border border-paper-300 rounded-xl p-3">
              <span className="text-[10.5px] text-ink-500">Has agreed to recording consultations?</span>
              <div className="flex bg-paper-400 rounded-lg p-0.5 text-[10px]">
                <button
                  onClick={() => onUpdateDoctor({ ...doctor, consent_state: 'ok' })}
                  className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
                    doctor.consent_state === 'ok' ? 'bg-sage text-white font-medium shadow-xs' : 'text-ink-500'
                  }`}
                >
                  <IconMicrophone size={11} /> OK
                </button>
                <button
                  onClick={() => onUpdateDoctor({ ...doctor, consent_state: 'declined' })}
                  className={`px-2 py-1 rounded-md flex items-center gap-1 transition-all ${
                    doctor.consent_state === 'declined' ? 'bg-ink-600 text-white font-medium shadow-xs' : 'text-ink-500'
                  }`}
                >
                  <IconMicrophoneOff size={11} /> No
                </button>
              </div>
            </div>
          )}

          {!isEditing && (
            <button
              onClick={handleDelete}
              className="w-full py-2.5 border border-terracotta/30 text-terracotta hover:bg-terracotta-light/40 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <IconTrash size={14} /> Remove doctor
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
