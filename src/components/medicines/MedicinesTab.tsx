import React, { useState, useMemo } from 'react';
import { Medication, TimeOfDay } from '../../types';
import {
  IconAlarm,
  IconCheck,
  IconClock,
  IconList,
  IconMoonStars,
  IconSun,
  IconSunrise,
  IconSunset,
} from '@tabler/icons-react';
import { MedicationDetailModal } from './MedicationDetailModal';
import { isCourseEnded } from '../../utils/medicationSchedule';
import { medicineDisplayName } from '../../utils/medicineName';

interface MedicinesTabProps {
  medications: Medication[];
  onUpdateMedication: (med: Medication) => void;
  onDeleteMedication: (medId: string) => void;
}

function renderFoodRelation(relation: string) {
  return relation.replace('_', ' ');
}

// One row renderer shared by every Today-view section — the bug where brand
// names only showed up in some time-of-day groups and not others happened
// because each section had its own hand-copied JSX that drifted out of sync.
// A single shared row makes that class of inconsistency impossible.
const MedicineRow: React.FC<{ medication: Medication; isLast: boolean; onClick: () => void }> = ({
  medication,
  isLast,
  onClick,
}) => {
  const { primary, secondary } = medicineDisplayName(medication);
  return (
    <div
      className={`py-2 text-[11.5px] text-ink-800 flex justify-between items-baseline cursor-pointer active:opacity-70 ${
        isLast ? '' : 'border-b border-paper-400'
      }`}
      onClick={onClick}
    >
      <span>
        <span className="font-semibold">
          {primary} {medication.strength}
        </span>{' '}
        <span className="text-[9.5px] text-ink-200 font-normal ml-1">
          {renderFoodRelation(medication.food_relation)}
        </span>
      </span>
      {secondary && <span className="text-[9.5px] text-ink-300 italic flex-shrink-0 ml-2">{secondary}</span>}
    </div>
  );
};

export const MedicinesTab: React.FC<MedicinesTabProps> = ({
  medications,
  onUpdateMedication,
  onDeleteMedication,
}) => {
  const [viewMode, setViewMode] = useState<'today' | 'all'>('today');
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Meds whose course has ended shouldn't show up as due today, but are still
  // technically "active" until someone marks them complete.
  const endedCourseMeds = useMemo(
    () => medications.filter((m) => isCourseEnded(m, today)),
    [medications, today]
  );

  // Filter active meds that are actually still due (excludes ended courses)
  const activeMeds = useMemo(
    () => medications.filter((m) => m.status === 'active' && !isCourseEnded(m, today)),
    [medications, today]
  );

  // Calculate total doses today
  const totalDosesToday = useMemo(() => {
    return activeMeds.reduce((acc, m) => acc + m.time_of_day.length, 0);
  }, [activeMeds]);

  // Group by Time of Day for "Today" view
  const morningMeds = useMemo(() => activeMeds.filter((m) => m.time_of_day.includes('morning')), [activeMeds]);
  const afternoonMeds = useMemo(() => activeMeds.filter((m) => m.time_of_day.includes('afternoon')), [activeMeds]);
  const eveningMeds = useMemo(() => activeMeds.filter((m) => m.time_of_day.includes('evening')), [activeMeds]);
  const nightMeds = useMemo(() => activeMeds.filter((m) => m.time_of_day.includes('night')), [activeMeds]);

  // Group by Molecule for "All" (reconciled) view
  const groupedByMolecule = useMemo(() => {
    const map = new Map<string, Medication[]>();
    medications.forEach((m) => {
      const key = m.molecule;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return Array.from(map.entries());
  }, [medications]);

  const timeSections: Array<{ key: TimeOfDay; label: string; icon: React.ReactNode; iconColor: string; meds: Medication[] }> = [
    { key: 'morning', label: 'Morning', icon: <IconSunrise size={13} />, iconColor: 'text-ochre', meds: morningMeds },
    { key: 'afternoon', label: 'Afternoon', icon: <IconSun size={13} />, iconColor: 'text-ochre', meds: afternoonMeds },
    { key: 'evening', label: 'Evening', icon: <IconSunset size={13} />, iconColor: 'text-terracotta', meds: eveningMeds },
    { key: 'night', label: 'Night', icon: <IconMoonStars size={13} />, iconColor: 'text-slateSubtle', meds: nightMeds },
  ];

  return (
    <div className="flex flex-col flex-1 pb-4">
      {/* Subheader Context Text & Toggle */}
      <div className="px-4.5 pt-3 pb-2 flex items-center justify-between select-none">
        <span className="text-[10px] text-ink-200 font-medium">
          {totalDosesToday} doses today
        </span>

        <div className="flex items-center gap-2">
          {/* Today ↔ All Toggle */}
          <div className="flex items-center gap-0.5 bg-paper-400 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('today')}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                viewMode === 'today' ? 'bg-paper-50 shadow-2xs text-terracotta' : 'text-ink-200 hover:text-ink-600'
              }`}
              title="Today's Schedule"
              aria-label="Today View"
            >
              <IconClock size={12} />
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                viewMode === 'all' ? 'bg-paper-50 shadow-2xs text-terracotta' : 'text-ink-200 hover:text-ink-600'
              }`}
              title="All Reconciled Medicines"
              aria-label="All View"
            >
              <IconList size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4.5 flex-1 overflow-y-auto space-y-4">
        {viewMode === 'today' ? (
          <>
            {/* Course ended — needs review */}
            {endedCourseMeds.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <IconAlarm size={13} className="text-terracotta" />
                  <span className="text-[9.5px] uppercase tracking-wider text-terracotta font-medium">
                    Course ended
                  </span>
                </div>
                <div className="bg-terracotta-light/30 border border-terracotta/30 rounded-xl px-3 py-1 shadow-2xs">
                  {endedCourseMeds.map((m, idx) => {
                    const { primary, secondary } = medicineDisplayName(m);
                    return (
                      <div
                        key={m.id}
                        className={`py-2 flex items-center justify-between gap-2 ${
                          idx !== endedCourseMeds.length - 1 ? 'border-b border-terracotta/20' : ''
                        }`}
                      >
                        <div className="min-w-0 cursor-pointer" onClick={() => setSelectedMedication(m)}>
                          <p className="text-[11.5px] text-ink-800 truncate">
                            <span className="font-semibold">
                              {primary} {m.strength}
                            </span>
                            {secondary && <span className="text-ink-300 italic ml-1.5">{secondary}</span>}
                          </p>
                          <p className="text-[9.5px] text-ink-500">Ended {m.end_date}</p>
                        </div>
                        <button
                          onClick={() => onUpdateMedication({ ...m, status: 'stopped' })}
                          className="flex-shrink-0 flex items-center gap-1 px-2 py-1 bg-white text-sage border border-sage/30 rounded-lg text-[10px] font-medium hover:bg-sage-light transition-colors"
                        >
                          <IconCheck size={11} /> Mark complete
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {timeSections.map(
              (section) =>
                section.meds.length > 0 && (
                  <div key={section.key} className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={section.iconColor}>{section.icon}</span>
                      <span className="text-[9.5px] uppercase tracking-wider text-ink-900 font-medium">
                        {section.label}
                      </span>
                    </div>
                    <div className="bg-paper-50 border border-paper-500 rounded-xl px-3 py-1 shadow-2xs">
                      {section.meds.map((m, idx) => (
                        <MedicineRow
                          key={m.id}
                          medication={m}
                          isLast={idx === section.meds.length - 1}
                          onClick={() => setSelectedMedication(m)}
                        />
                      ))}
                    </div>
                  </div>
                )
            )}
          </>
        ) : (
          // All (Reconciled) View
          <div className="space-y-3">
            <p className="text-[10px] text-ink-400 leading-relaxed italic">
              Neutral molecule reconciliation list across all prescribing specialists.
            </p>

            {groupedByMolecule.map(([molecule, list]) => (
              <div
                key={molecule}
                className="bg-paper-50 border border-paper-500 rounded-xl p-3 shadow-2xs space-y-2"
              >
                <div className="flex justify-between items-center pb-1 border-b border-paper-400">
                  <h4 className="text-[12.5px] font-semibold text-ink-800">{molecule}</h4>
                  <span className="text-[9.5px] text-ink-300 uppercase tracking-wider">
                    {list[0].strength}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-ink-700">
                  {list.map((m) => {
                    const { primary, secondary } = medicineDisplayName(m);
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedMedication(m)}
                        className="flex justify-between items-start text-[11px] cursor-pointer active:opacity-70 -mx-1 px-1 py-0.5 rounded-lg hover:bg-paper-400/40"
                      >
                        <div>
                          <p className="text-ink-800 font-medium">
                            {secondary ? `${primary} · ` : ''}
                            {m.prescriber_name} <span className="text-ink-400 font-normal">({m.prescriber_specialty})</span>
                          </p>
                          <p className="text-[10px] text-ink-400">
                            {m.time_of_day.join(' + ')} · {renderFoodRelation(m.food_relation)} · Prescribed {m.prescribed_date}
                            {m.end_date ? ` · until ${m.end_date}` : ''}
                          </p>
                          {m.notes && <p className="text-[10px] text-terracotta mt-0.5">{m.notes}</p>}
                        </div>

                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-medium flex-shrink-0 ${
                            isCourseEnded(m, today)
                              ? 'bg-terracotta-light text-terracotta'
                              : m.status === 'active'
                              ? 'bg-sage-light text-sage'
                              : 'bg-paper-400 text-ink-400'
                          }`}
                        >
                          {isCourseEnded(m, today) ? 'course ended' : m.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MedicationDetailModal
        medication={selectedMedication}
        isOpen={Boolean(selectedMedication)}
        onUpdateMedication={onUpdateMedication}
        onDeleteMedication={onDeleteMedication}
        onClose={() => setSelectedMedication(null)}
      />
    </div>
  );
};
