import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CareTeamMember, DocumentRecord, DocumentType, Medication, Person, Species } from '../../types';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCategory,
  IconCircleCheck,
  IconClock,
  IconDotsVertical,
  IconFileText,
  IconFlask,
  IconNotes,
  IconPill,
  IconRadioactive,
  IconSearch,
  IconTags,
  IconTimeline,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import { DocumentDetailModal } from './DocumentDetailModal';
import { StandardizeNamesModal } from './StandardizeNamesModal';
import { BulkMedicineCheckModal } from './BulkMedicineCheckModal';
import { RescheduleTestModal } from './RescheduleTestModal';
import { CaptureModal } from '../capture/CaptureModal';
import { computeFormatOnlyMerges, applyFormatOnlyMerges } from '../../utils/factNameClusters';
import { safeMonthYearFromDate } from '../../utils/recordDate';
import { daysUntil, formatDaysUntilLabel } from '../../utils/dueDates';

interface RecordsTabProps {
  familyId: string;
  person: Person;
  personName: string;
  personSpecies: Species;
  records: DocumentRecord[];
  doctors: CareTeamMember[];
  medications: Medication[];
  onVerifyFact: (recordId: string, factId: string, verified: boolean) => void;
  onAddRecord: (record: DocumentRecord) => void;
  onUpdateRecord: (record: DocumentRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onAddMedication: (medication: Medication) => void;
  onAddDoctor: (doctor: CareTeamMember) => void;
}

export const RecordsTab: React.FC<RecordsTabProps> = ({
  familyId,
  person,
  personName,
  personSpecies,
  records,
  doctors,
  medications,
  onVerifyFact,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onAddMedication,
  onAddDoctor,
}) => {
  const [viewMode, setViewMode] = useState<'timeline' | 'by_type'>('timeline');
  const [selectedCondition, setSelectedCondition] = useState<string>('All');
  const [selectedRecord, setSelectedRecord] = useState<DocumentRecord | null>(null);
  const [isStandardizeOpen, setIsStandardizeOpen] = useState(false);
  const [isBulkCheckOpen, setIsBulkCheckOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [attachRecord, setAttachRecord] = useState<DocumentRecord | null>(null);
  const [rescheduleRecord, setRescheduleRecord] = useState<DocumentRecord | null>(null);

  // Fact names that differ only by case/whitespace/trailing punctuation carry
  // no ambiguity, so they're merged silently the moment they're seen — no
  // reason to make someone click through "HbA1c" vs "hba1c". Self-terminating:
  // once merged, this finds nothing left to do on the next pass.
  const onUpdateRecordRef = useRef(onUpdateRecord);
  onUpdateRecordRef.current = onUpdateRecord;
  useEffect(() => {
    const merges = computeFormatOnlyMerges(records);
    if (merges.length === 0) return;
    applyFormatOnlyMerges(records, merges).forEach((r) => onUpdateRecordRef.current(r));
  }, [records]);

  // Extract unique conditions from records
  const conditionChips = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => r.condition_tags.forEach((c) => set.add(c)));
    return ['All', ...Array.from(set)];
  }, [records]);

  // Filter records by condition
  const filteredRecords = useMemo(() => {
    if (selectedCondition === 'All') return records;
    return records.filter((r) => r.condition_tags.includes(selectedCondition));
  }, [records, selectedCondition]);

  // Group by Month/Year for Timeline view — derived from the record's own date
  // rather than the stored month_year, which older records may have saved as
  // the date they were scanned instead of the date the document is dated.
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>();
    filteredRecords.forEach((r) => {
      const month = safeMonthYearFromDate(r.date) || r.month_year || 'Recent';
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(r);
    });
    return Array.from(map.entries());
  }, [filteredRecords]);

  // Group by Document Type for By-Type view
  const groupedByType = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>();
    filteredRecords.forEach((r) => {
      const type = r.doc_type;
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(r);
    });
    return Array.from(map.entries());
  }, [filteredRecords]);

  const getDocIcon = (type: DocumentType) => {
    switch (type) {
      case 'lab':
        return { icon: <IconFlask size={13} className="text-sage" />, bg: 'bg-sage-light' };
      case 'consultation_note':
        return { icon: <IconNotes size={13} className="text-terracotta" />, bg: 'bg-terracotta-tint' };
      case 'imaging':
        return { icon: <IconRadioactive size={13} className="text-sage" />, bg: 'bg-sage-light' };
      case 'prescription':
        return { icon: <IconPill size={13} className="text-lavender" />, bg: 'bg-lavender-light' };
      default:
        return { icon: <IconFileText size={13} className="text-ink-600" />, bg: 'bg-paper-400' };
    }
  };

  const getChipStyle = (condition: string) => {
    if (condition === selectedCondition) {
      return 'bg-paper-800 text-paper-50 font-medium';
    }
    if (condition.toLowerCase().includes('carotid') || condition.toLowerCase().includes('cad')) {
      return 'bg-terracotta-tint text-terracotta hover:bg-terracotta-light/60';
    }
    if (condition.toLowerCase().includes('diabetes') || condition.toLowerCase().includes('retinopathy')) {
      return 'bg-sage-light text-sage hover:opacity-80';
    }
    return 'bg-paper-400 text-ink-600 hover:bg-paper-500';
  };

  // A scheduled reminder is done the moment there's a report OR the caregiver
  // says so by hand — either way it stops being a placeholder.
  const handleMarkTestComplete = (rec: DocumentRecord) => {
    onUpdateRecord({
      ...rec,
      status: undefined,
      subtitle: rec.subtitle === 'Scheduled — no report yet' ? 'Marked complete — no report attached' : rec.subtitle,
    });
  };

  // Shared between the Timeline and By Type lists so a scheduled placeholder
  // renders identically in both instead of drifting into two copies.
  const renderRecordCard = (rec: DocumentRecord) => {
    if (rec.status === 'scheduled') {
      const days = daysUntil(rec.date);
      const overdue = days < 0;
      return (
        <div
          key={rec.id}
          onClick={() => setAttachRecord(rec)}
          className={`flex gap-2.5 items-start p-2 -mx-1 rounded-xl border border-dashed cursor-pointer active:scale-99 transition-all ${
            overdue ? 'border-ochre/60 bg-ochre-light/60' : 'border-terracotta/40 bg-terracotta-tint/30'
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              overdue ? 'bg-ochre-light text-ochre' : 'bg-terracotta-light text-terracotta'
            }`}
          >
            {overdue ? <IconAlertTriangle size={13} /> : <IconClock size={13} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[11.5px] font-medium text-ink-800 truncate min-w-0">{rec.title}</span>
              <span className={`text-[9.5px] font-semibold flex-shrink-0 ${overdue ? 'text-ochre' : 'text-terracotta'}`}>
                {formatDaysUntilLabel(days)}
              </span>
            </div>
            <p className="text-[10px] text-ink-500 mt-0.5">
              Scheduled {new Date(rec.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
              {rec.subtitle && rec.subtitle !== 'Scheduled — no report yet' ? ` · ${rec.subtitle}` : ''}
            </p>
            <div className="flex items-center gap-x-2.5 gap-y-1 mt-1.5 flex-wrap">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAttachRecord(rec);
                }}
                className="text-[10px] text-terracotta font-medium flex items-center gap-1 hover:underline"
              >
                <IconUpload size={11} /> Attach report
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkTestComplete(rec);
                }}
                className="text-[10px] text-sage font-medium flex items-center gap-1 hover:underline"
              >
                <IconCircleCheck size={11} /> Mark complete
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRescheduleRecord(rec);
                }}
                className="text-[10px] text-lavender font-medium flex items-center gap-1 hover:underline"
              >
                <IconCalendarEvent size={11} /> Reschedule
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Remove this reminder for "${rec.title}"?`)) onDeleteRecord(rec.id);
                }}
                className="text-[10px] text-ink-300 hover:text-terracotta font-medium flex items-center gap-1"
              >
                <IconTrash size={11} /> Remove
              </button>
            </div>
          </div>
        </div>
      );
    }

    const { icon, bg } = getDocIcon(rec.doc_type);
    const hasUnverified = rec.unverified_count > 0;

    return (
      <div
        key={rec.id}
        onClick={() => setSelectedRecord(rec)}
        className="flex gap-2.5 items-start p-1 -mx-1 rounded-xl hover:bg-paper-400/50 cursor-pointer active:scale-99 transition-all"
      >
        {/* Icon Circle */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}>
          {icon}
        </div>

        {/* Content Row */}
        <div className="flex-1 min-w-0 pb-2 border-b border-paper-400/80">
          <div className="flex justify-between items-baseline gap-2">
            <span className="text-[11.5px] font-medium text-ink-800 truncate min-w-0">{rec.title}</span>
            <span className="text-[9.5px] text-ink-200 flex-shrink-0">
              {new Date(rec.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
            </span>
          </div>

          {hasUnverified ? (
            <p className="text-[10px] text-ink-500 italic border-b border-dotted border-paper-700 inline-block mt-0.5">
              {rec.unverified_count} {rec.unverified_count === 1 ? 'value' : 'values'} extracted
            </p>
          ) : (
            <p className="text-[10px] text-ink-500 mt-0.5">{rec.subtitle}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 pb-4">
      {/* Top Filter and View Toggle Controls */}
      <div className="px-4.5 pt-3 pb-2 flex items-center justify-between gap-2 select-none">
        {/* Condition Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {conditionChips.map((condition) => (
            <button
              key={condition}
              onClick={() => setSelectedCondition(condition)}
              className={`text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap transition-all active:scale-95 ${getChipStyle(
                condition
              )}`}
            >
              {condition}
            </button>
          ))}
        </div>

        {/* Timeline ↔ By Type Toggle + overflow tools */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex items-center gap-0.5 bg-paper-400 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode('timeline')}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                viewMode === 'timeline' ? 'bg-paper-50 shadow-2xs text-terracotta' : 'text-ink-200 hover:text-ink-600'
              }`}
              title="Timeline View"
              aria-label="Timeline View"
            >
              <IconTimeline size={12} />
            </button>
            <button
              onClick={() => setViewMode('by_type')}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                viewMode === 'by_type' ? 'bg-paper-50 shadow-2xs text-terracotta' : 'text-ink-200 hover:text-ink-600'
              }`}
              title="By Document Type View"
              aria-label="By Type View"
            >
              <IconCategory size={12} />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsToolsMenuOpen((v) => !v)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                isToolsMenuOpen ? 'bg-paper-400 text-ink-700' : 'text-ink-300 hover:text-ink-700 hover:bg-paper-400'
              }`}
              title="More tools"
              aria-label="More tools"
            >
              <IconDotsVertical size={14} />
            </button>

            {isToolsMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsToolsMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-paper-50 border border-paper-400 rounded-xl shadow-modal py-1 z-20">
                  <button
                    onClick={() => {
                      setIsStandardizeOpen(true);
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-ink-700 hover:bg-paper-300 flex items-center gap-2"
                  >
                    <IconTags size={13} className="text-lavender flex-shrink-0" />
                    Merge similar test names
                  </button>
                  <button
                    onClick={() => {
                      setIsBulkCheckOpen(true);
                      setIsToolsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] text-ink-700 hover:bg-paper-300 flex items-center gap-2"
                  >
                    <IconSearch size={13} className="text-lavender flex-shrink-0" />
                    Find medicines in past scans
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Records List */}
      <div className="px-4.5 flex-1 min-h-0 overflow-y-auto space-y-4">
        {viewMode === 'timeline' ? (
          groupedByMonth.map(([month, recs]) => (
            <div key={month} className="space-y-2">
              <p className="text-[9.5px] uppercase tracking-wider text-ink-200 font-medium">
                {month}
              </p>

              <div className="space-y-2">{recs.map((rec) => renderRecordCard(rec))}</div>
            </div>
          ))
        ) : (
          // By Type View
          groupedByType.map(([type, recs]) => (
            <div key={type} className="space-y-2">
              <p className="text-[9.5px] uppercase tracking-wider text-terracotta font-semibold">
                {type.replace('_', ' ')}s ({recs.length})
              </p>

              <div className="space-y-2">{recs.map((rec) => renderRecordCard(rec))}</div>
            </div>
          ))
        )}

        {filteredRecords.length === 0 && (
          <div className="text-center py-12 text-ink-300 text-xs">
            No records match &ldquo;{selectedCondition}&rdquo;.
          </div>
        )}
      </div>

      {/* Fact Inspection & 1-Tap Verification Modal */}
      <DocumentDetailModal
        record={selectedRecord}
        isOpen={Boolean(selectedRecord)}
        familyId={familyId}
        personSpecies={personSpecies}
        doctors={doctors}
        medications={medications}
        onAddMedication={onAddMedication}
        onAddDoctor={onAddDoctor}
        onVerifyFact={(recId, factId, verified) => {
          onVerifyFact(recId, factId, verified);
          if (selectedRecord && selectedRecord.id === recId) {
            const updated = {
              ...selectedRecord,
              facts: selectedRecord.facts.map((f) => (f.id === factId ? { ...f, is_verified: verified } : f)),
            };
            updated.unverified_count = updated.facts.filter((f) => !f.is_verified).length;
            setSelectedRecord(updated);
          }
        }}
        onUpdateRecord={(updated) => {
          onUpdateRecord(updated);
          setSelectedRecord(updated);
        }}
        onDeleteRecord={(recId) => {
          onDeleteRecord(recId);
          setSelectedRecord(null);
        }}
        onClose={() => setSelectedRecord(null)}
      />

      <StandardizeNamesModal
        isOpen={isStandardizeOpen}
        records={records}
        onUpdateRecord={onUpdateRecord}
        onClose={() => setIsStandardizeOpen(false)}
      />

      <BulkMedicineCheckModal
        isOpen={isBulkCheckOpen}
        familyId={familyId}
        personName={personName}
        records={records}
        medications={medications}
        onAddMedication={onAddMedication}
        onClose={() => setIsBulkCheckOpen(false)}
      />

      <RescheduleTestModal
        isOpen={Boolean(rescheduleRecord)}
        record={rescheduleRecord}
        onUpdateRecord={(updated) => {
          onUpdateRecord(updated);
          setRescheduleRecord(null);
        }}
        onClose={() => setRescheduleRecord(null)}
      />

      <CaptureModal
        isOpen={Boolean(attachRecord)}
        familyId={familyId}
        person={person}
        attachToRecord={attachRecord}
        onAddRecord={onAddRecord}
        onUpdateRecord={(updated) => {
          onUpdateRecord(updated);
          setAttachRecord(null);
        }}
        onClose={() => setAttachRecord(null)}
      />
    </div>
  );
};
