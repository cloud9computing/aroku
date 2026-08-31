import React, { useState } from 'react';
import { CareTeamMember } from '../../types';
import { IconMapPin, IconMicrophoneOff, IconPhone, IconPlus, IconStethoscope } from '@tabler/icons-react';
import { AddDoctorModal } from './AddDoctorModal';
import { DoctorDetailModal } from './DoctorDetailModal';

interface DoctorsTabProps {
  doctors: CareTeamMember[];
  onAddDoctor: (doctor: CareTeamMember) => void;
  onUpdateDoctor: (doctor: CareTeamMember) => void;
  onDeleteDoctor: (doctorId: string) => void;
}

export const DoctorsTab: React.FC<DoctorsTabProps> = ({
  doctors,
  onAddDoctor,
  onUpdateDoctor,
  onDeleteDoctor,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<CareTeamMember | null>(null);

  const sorted = [...doctors].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col flex-1 pb-4">
      <div className="px-4.5 pt-3 pb-2 flex items-center justify-between select-none">
        <span className="text-[10px] text-ink-200 font-medium">
          {doctors.length} {doctors.length === 1 ? 'doctor' : 'doctors'} saved
        </span>
        <button
          onClick={() => setIsAddOpen(true)}
          className="text-[10.5px] text-terracotta hover:underline font-medium flex items-center gap-1"
        >
          <IconPlus size={12} /> Add doctor
        </button>
      </div>

      <div className="px-4.5 flex-1 overflow-y-auto space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <div className="w-11 h-11 rounded-full bg-terracotta-light text-terracotta flex items-center justify-center mx-auto">
              <IconStethoscope size={20} />
            </div>
            <p className="text-xs text-ink-400 max-w-[220px] mx-auto leading-relaxed">
              Keep every doctor your family sees — or has been recommended — in one place, with their
              contact details.
            </p>
          </div>
        ) : (
          sorted.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoctor(doc)}
              className="bg-paper-50 border border-paper-500 rounded-xl p-3 shadow-2xs cursor-pointer active:scale-99 transition-all"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h4 className="text-[12.5px] font-semibold text-ink-800 truncate">{doc.name}</h4>
                  <p className="text-[11px] text-terracotta">{doc.specialty}</p>
                  {doc.clinic && <p className="text-[10px] text-ink-400 mt-0.5">{doc.clinic}</p>}
                  {doc.notes && <p className="text-[9.5px] text-lavender italic mt-0.5">{doc.notes}</p>}
                </div>
                {doc.consent_state === 'declined' && (
                  <span title="Declined recording" className="text-ink-300 flex-shrink-0 mt-0.5">
                    <IconMicrophoneOff size={13} />
                  </span>
                )}
              </div>

              {(doc.phone || doc.address) && (
                <div className="flex gap-3 mt-2 pt-2 border-t border-paper-400/80 text-[10px] text-ink-500">
                  {doc.phone && (
                    <span className="flex items-center gap-1">
                      <IconPhone size={11} /> {doc.phone}
                    </span>
                  )}
                  {doc.address && (
                    <span className="flex items-center gap-1 truncate">
                      <IconMapPin size={11} className="flex-shrink-0" /> <span className="truncate">{doc.address}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AddDoctorModal isOpen={isAddOpen} onAddDoctor={onAddDoctor} onClose={() => setIsAddOpen(false)} />

      <DoctorDetailModal
        doctor={selectedDoctor}
        isOpen={Boolean(selectedDoctor)}
        onUpdateDoctor={(updated) => {
          onUpdateDoctor(updated);
          setSelectedDoctor(updated);
        }}
        onDeleteDoctor={onDeleteDoctor}
        onClose={() => setSelectedDoctor(null)}
      />
    </div>
  );
};
