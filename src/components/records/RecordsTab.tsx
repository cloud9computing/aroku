import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CareTeamMember, DocumentRecord, DocumentType, Medication } from '../../types';
import {
  IconCategory,
  IconClock,
  IconFileText,
  IconFlask,
  IconNotes,
  IconPill,
  IconRadioactive,
  IconSearch,
  IconTags,
  IconTimeline,
} from '@tabler/icons-react';
import { DocumentDetailModal } from './DocumentDetailModal';
import { StandardizeNamesModal } from './StandardizeNamesModal';
import { BulkMedicineCheckModal } from './BulkMedicineCheckModal';
import { computeFormatOnlyMerges, applyFormatOnlyMerges } from '../../utils/factNameClusters';

interface RecordsTabProps {
  familyId: string;
  personName: string;
  records: DocumentRecord[];
  doctors: CareTeamMember[];
  medications: Medication[];
  onVerifyFact: (recordId: string, factId: string, verified: boolean) => void;
  onUpdateRecord: (record: DocumentRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onAddMedication: (medication: Medication) => void;
  onAddDoctor: (doctor: CareTeamMember) => void;
}

export const RecordsTab: React.FC<RecordsTabProps> = ({
  familyId,
  personName,
  records,
  doctors,
  medications,
  onVerifyFact,
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

  // Group by Month/Year for Timeline view
  const groupedByMonth = useMemo(() => {
    const map = new Map<string, DocumentRecord[]>();
    filteredRecords.forEach((r) => {
      const month = r.month_year || 'Recent';
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

  return (
    <div className="flex flex-col flex-1 pb-4">
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

        {/* Timeline ↔ By Type Toggle */}
        <div className="flex items-center gap-0.5 bg-paper-400 p-0.5 rounded-lg flex-shrink-0">
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
      </div>

      {/* Record maintenance tools */}
      <div className="px-4.5 pb-2 flex items-center gap-3 select-none">
        <button
          onClick={() => setIsStandardizeOpen(true)}
          className="text-[10px] text-lavender hover:underline font-medium flex items-center gap-1"
        >
          <IconTags size={12} /> Standardize names
        </button>
        <button
          onClick={() => setIsBulkCheckOpen(true)}
          className="text-[10px] text-lavender hover:underline font-medium flex items-center gap-1"
        >
          <IconSearch size={12} /> Check all for medicines
        </button>
      </div>

      {/* Main Records List */}
      <div className="px-4.5 flex-1 overflow-y-auto space-y-4">
        {viewMode === 'timeline' ? (
          groupedByMonth.map(([month, recs]) => (
            <div key={month} className="space-y-2">
              <p className="text-[9.5px] uppercase tracking-wider text-ink-200 font-medium">
                {month}
              </p>

              <div className="space-y-2">
                {recs.map((rec) => {
                  const { icon, bg } = getDocIcon(rec.doc_type);
                  const hasUnverified = rec.unverified_count > 0;

                  return (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className="flex gap-2.5 items-start p-1 -mx-1 rounded-xl hover:bg-paper-400/50 cursor-pointer active:scale-99 transition-all"
                    >
                      {/* Icon Circle */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}
                      >
                        {icon}
                      </div>

                      {/* Content Row */}
                      <div className="flex-1 pb-2 border-b border-paper-400/80">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11.5px] font-medium text-ink-800">{rec.title}</span>
                          <span className="text-[9.5px] text-ink-200">
                            {new Date(rec.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        {hasUnverified ? (
                          <p className="text-[10px] text-ink-500 italic border-b border-dotted border-paper-700 inline-block mt-0.5">
                            {rec.unverified_count} {rec.unverified_count === 1 ? 'value needs' : 'values need'} a quick check
                          </p>
                        ) : (
                          <p className="text-[10px] text-ink-500 mt-0.5">{rec.subtitle}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          // By Type View
          groupedByType.map(([type, recs]) => (
            <div key={type} className="space-y-2">
              <p className="text-[9.5px] uppercase tracking-wider text-terracotta font-semibold">
                {type.replace('_', ' ')}s ({recs.length})
              </p>

              <div className="space-y-2">
                {recs.map((rec) => {
                  const { icon, bg } = getDocIcon(rec.doc_type);
                  const hasUnverified = rec.unverified_count > 0;

                  return (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className="flex gap-2.5 items-start p-1 -mx-1 rounded-xl hover:bg-paper-400/50 cursor-pointer active:scale-99 transition-all"
                    >
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${bg}`}
                      >
                        {icon}
                      </div>

                      <div className="flex-1 pb-2 border-b border-paper-400/80">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[11.5px] font-medium text-ink-800">{rec.title}</span>
                          <span className="text-[9.5px] text-ink-200">
                            {new Date(rec.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>

                        {hasUnverified ? (
                          <p className="text-[10px] text-ink-500 italic border-b border-dotted border-paper-700 inline-block mt-0.5">
                            {rec.unverified_count} values need a quick check
                          </p>
                        ) : (
                          <p className="text-[10px] text-ink-500 mt-0.5">{rec.subtitle}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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
        personName={personName}
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
    </div>
  );
};
