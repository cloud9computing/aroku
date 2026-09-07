import React, { useState } from 'react';
import { CareTeamMember, Species } from '../../types';
import { IconMapPin, IconMicrophoneOff, IconPhone, IconPlus, IconStethoscope } from '@tabler/icons-react';
import { filterDoctorsForSpecies, patientTypeForSpecies } from '../../utils/careTeam';
import { buildDirectionsUrl } from '../../utils/directions';
import { AddDoctorModal } from './AddDoctorModal';
import { DoctorDetailModal } from './DoctorDetailModal';

interface DoctorsTabProps {
  doctors: CareTeamMember[];
  personSpecies: Species;
  onAddDoctor: (doctor: CareTeamMember) => void;
  onUpdateDoctor: (doctor: CareTeamMember) => void;
  onDeleteDoctor: (doctorId: string) => void;
}

export const DoctorsTab: React.FC<DoctorsTabProps> = ({
  doctors,
  personSpecies,
  onAddDoctor,
  onUpdateDoctor,
  onDeleteDoctor,
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<CareTeamMember | null>(null);

  const scopedDoctors = filterDoctorsForSpecies(doctors, personSpecies);
  const sorted = [...scopedDoctors].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col flex-1 min-h-0 pb-4">
      <div className="px-4.5 pt-3 pb-2 flex items-center justify-between select-none">
        <span className="text-[10px] text-ink-200 font-medium">
          {sorted.length} {sorted.length === 1 ? 'doctor' : 'doctors'} saved
        </span>
        <button
          onClick={() => setIsAddOpen(true)}
          className="text-[10.5px] text-terracotta hover:underline font-medium flex items-center gap-1"
        >
          <IconPlus size={12} /> Add doctor
        </button>
      </div>

      <div className="px-4.5 flex-1 min-h-0 overflow-y-auto space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-14 space-y-2">
            <div className="w-11 h-11 rounded-full bg-terracotta-light text-terracotta flex items-center justify-center mx-auto">
              <IconStethoscope size={20} />
            </div>
            <p className="text-xs text-ink-400 max-w-[220px] mx-auto leading-relaxed">
              {personSpecies === 'human'
                ? 'Keep every doctor your family sees — or has been recommended — in one place, with their contact details.'
                : "Keep every vet this pet sees — or has been recommended — in one place, with their contact details."}
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
                <div className="flex gap-2 mt-2 pt-2 border-t border-paper-400/80">
                  {doc.phone && (
                    <a
                      href={`tel:${doc.phone.replace(/\s+/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 py-1.5 bg-sage-light text-sage-dark rounded-lg text-[10.5px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <IconPhone size={12} /> Call
                    </a>
                  )}
                  {doc.address && (
                    <a
                      href={buildDirectionsUrl(doc.address)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 py-1.5 bg-lavender-light text-lavender rounded-lg text-[10.5px] font-medium flex items-center justify-center gap-1 active:scale-95 transition-all"
                    >
                      <IconMapPin size={12} /> Directions
                    </a>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AddDoctorModal
        isOpen={isAddOpen}
        defaultPatientType={patientTypeForSpecies(personSpecies)}
        onAddDoctor={onAddDoctor}
        onClose={() => setIsAddOpen(false)}
      />

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
