import React, { useState, useMemo } from 'react';
import { Person, Visit, Medication, DocumentRecord } from '../../types';
import { IconTimeline, IconUser } from '@tabler/icons-react';
import { VisitDetailView } from './VisitDetailView';
import { PastVisitRecapModal } from './PastVisitRecapModal';

interface VisitsTabProps {
  familyId: string;
  person: Person;
  visits: Visit[];
  medications: Medication[];
  records: DocumentRecord[];
  onUpdateVisit: (visit: Visit) => void;
  onDeleteVisit: (visitId: string) => void;
}

export const VisitsTab: React.FC<VisitsTabProps> = ({
  familyId,
  person,
  visits,
  medications,
  records,
  onUpdateVisit,
  onDeleteVisit,
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'by_doctor'>('timeline');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');
  const [activeUpcomingVisit, setActiveUpcomingVisit] = useState<Visit | null>(null);
  const [activePastVisit, setActivePastVisit] = useState<Visit | null>(null);

  // Extract unique specialties from visits
  const specialtyChips = useMemo(() => {
    const set = new Set<string>();
    visits.forEach((v) => set.add(v.specialty));
    return ['All', ...Array.from(set)];
  }, [visits]);

  // Filter visits
  const filteredVisits = useMemo(() => {
    if (selectedSpecialty === 'All') return visits;
    return visits.filter((v) => v.specialty.toLowerCase().includes(selectedSpecialty.toLowerCase()));
  }, [visits, selectedSpecialty]);

  // Group by doctor for "By Doctor" view
  const groupedByDoctor = useMemo(() => {
    const map = new Map<string, Visit[]>();
    filteredVisits.forEach((v) => {
      const doc = v.doctor_name;
      if (!map.has(doc)) map.set(doc, []);
      map.get(doc)!.push(v);
    });
    return Array.from(map.entries());
  }, [filteredVisits]);

  // If viewing active upcoming visit detail
  if (activeUpcomingVisit) {
    return (
      <VisitDetailView
        familyId={familyId}
        visit={activeUpcomingVisit}
        person={person}
        medications={medications}
        records={records}
        onBack={() => setActiveUpcomingVisit(null)}
        onUpdateVisit={(updated) => {
          onUpdateVisit(updated);
          setActiveUpcomingVisit(updated);
        }}
        onDeleteVisit={(visitId) => {
          onDeleteVisit(visitId);
          setActiveUpcomingVisit(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 pb-4">
      {/* Specialty Filter & View Mode Toggle */}
      <div className="px-4.5 pt-3 pb-2 flex items-center justify-between gap-2 select-none">
        {/* Specialty Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {specialtyChips.map((spec) => {
            const isSelected = spec === selectedSpecialty;
            return (
              <button
                key={spec}
                onClick={() => setSelectedSpecialty(spec)}
                className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-paper-800 text-paper-50 font-medium'
                    : 'bg-terracotta-tint text-terracotta hover:bg-terracotta-light/60'
                }`}
              >
                {spec}
              </button>
            );
          })}
        </div>

        {/* Timeline ↔ By Doctor Toggle */}
        <div className="flex items-center gap-0.5 bg-paper-400 p-0.5 rounded-lg flex-shrink-0">
          <button
            onClick={() => setViewMode('timeline')}
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'timeline' ? 'bg-paper-50 shadow-2xs text-terracotta' : 'text-ink-200 hover:text-ink-600'
            }`}
            title="Chronological Timeline"
            aria-label="Timeline View"
          >
            <IconTimeline size={12} />
          </button>
          <button
            onClick={() => setViewMode('by_doctor')}
            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
              viewMode === 'by_doctor' ? 'bg-paper-50 shadow-2xs text-terracotta' : 'text-ink-200 hover:text-ink-600'
            }`}
            title="Grouped by Doctor"
            aria-label="By Doctor View"
          >
            <IconUser size={12} />
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="px-4.5 flex-1 overflow-y-auto pt-1">
        {viewMode === 'timeline' ? (
          <div className="relative pl-1">
            {/* Timeline Vertical Line */}
            <div className="absolute left-[7.5px] top-2 bottom-3 w-[1px] bg-paper-300 pointer-events-none" />

            <div className="space-y-4">
              {filteredVisits.map((visit) => {
                const isUpcoming = visit.is_upcoming;

                return (
                  <div
                    key={visit.id}
                    onClick={() => {
                      if (isUpcoming) setActiveUpcomingVisit(visit);
                      else setActivePastVisit(visit);
                    }}
                    className="flex gap-3 items-start cursor-pointer group"
                  >
                    {/* Dot Stem */}
                    {isUpcoming ? (
                      <div className="w-[9px] h-[9px] rounded-full bg-terracotta mt-1 flex-shrink-0 z-10 shadow-2xs group-hover:scale-125 transition-transform" />
                    ) : (
                      <div className="w-[9px] h-[9px] rounded-full bg-paper-50 border-[1.5px] border-paper-700 mt-1 flex-shrink-0 z-10 group-hover:border-terracotta transition-colors" />
                    )}

                    {/* Content */}
                    <div className="flex-1 pb-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[11.5px] font-medium text-ink-800 group-hover:text-terracotta transition-colors">
                          {visit.doctor_name} · {visit.specialty}
                        </span>
                        <span
                          className={`text-[9.5px] font-normal ${
                            isUpcoming ? 'text-terracotta font-medium' : 'text-ink-200'
                          }`}
                        >
                          {visit.date_display}
                        </span>
                      </div>

                      {isUpcoming ? (
                        <p className="text-[10px] text-sage font-medium mt-0.5">
                          {visit.brief_status || 'Brief ready · Questions prepped'}
                        </p>
                      ) : (
                        <p className="text-[10px] text-ink-900 mt-0.5">
                          {visit.past_recap?.what_happened || 'Consultation completed'}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // By Doctor Grouping
          <div className="space-y-3">
            {groupedByDoctor.map(([docName, docVisits]) => (
              <div
                key={docName}
                className="bg-paper-50 border border-paper-500 rounded-xl p-3 shadow-2xs space-y-2"
              >
                <div className="flex justify-between items-center pb-1 border-b border-paper-400">
                  <h4 className="text-[12.5px] font-semibold text-ink-800">{docName}</h4>
                  <span className="text-[9.5px] text-ink-400">
                    {docVisits.length} {docVisits.length === 1 ? 'visit' : 'visits'}
                  </span>
                </div>

                <div className="space-y-2">
                  {docVisits.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => {
                        if (v.is_upcoming) setActiveUpcomingVisit(v);
                        else setActivePastVisit(v);
                      }}
                      className="flex justify-between items-center text-xs p-1.5 rounded-lg hover:bg-paper-400 cursor-pointer"
                    >
                      <div>
                        <p className="text-[11px] font-medium text-ink-800">
                          {v.date_display} · {v.specialty}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {v.is_upcoming ? 'Upcoming appointment' : v.past_recap?.what_happened || 'Past visit'}
                        </p>
                      </div>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          v.is_upcoming ? 'bg-terracotta-light text-terracotta' : 'bg-paper-400 text-ink-500'
                        }`}
                      >
                        {v.is_upcoming ? 'Upcoming' : 'Past'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Visit Modal */}
      <PastVisitRecapModal
        visit={activePastVisit}
        isOpen={Boolean(activePastVisit)}
        onDeleteVisit={(visitId) => {
          onDeleteVisit(visitId);
          setActivePastVisit(null);
        }}
        onClose={() => setActivePastVisit(null)}
      />
    </div>
  );
};
