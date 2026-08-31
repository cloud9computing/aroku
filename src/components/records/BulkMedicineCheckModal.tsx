import React, { useState } from 'react';
import { DocumentRecord, Medication } from '../../types';
import { extractFactsFromImageOrText } from '../../services/gemini';
import { findExistingActiveMedication, sameMoleculeAndStrength } from '../../utils/duplicateMedication';
import { MedicationConfirmModal, PendingMedication } from '../medicines/MedicationConfirmModal';
import { IconLoader, IconSearch, IconX } from '@tabler/icons-react';

interface BulkMedicineCheckModalProps {
  isOpen: boolean;
  familyId: string;
  personName: string;
  records: DocumentRecord[];
  medications: Medication[];
  onAddMedication: (medication: Medication) => void;
  onClose: () => void;
}

export const BulkMedicineCheckModal: React.FC<BulkMedicineCheckModalProps> = ({
  isOpen,
  familyId,
  personName,
  records,
  medications,
  onAddMedication,
  onClose,
}) => {
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errorCount, setErrorCount] = useState(0);
  const [pendingMeds, setPendingMeds] = useState<PendingMedication[]>([]);

  if (!isOpen) return null;

  const scannableRecords = records.filter((r) => r.image_url);

  const handleStart = async () => {
    setStatus('running');
    setErrorCount(0);
    setProgress({ current: 0, total: scannableRecords.length });

    const found: PendingMedication[] = [];
    let errors = 0;

    for (let i = 0; i < scannableRecords.length; i++) {
      setProgress({ current: i + 1, total: scannableRecords.length });
      try {
        const extracted = await extractFactsFromImageOrText(familyId, { recordId: scannableRecords[i].id });
        for (const m of extracted.medications) {
          const isDuplicate =
            Boolean(findExistingActiveMedication(medications, m)) ||
            found.some((f) => sameMoleculeAndStrength(f.extracted, m));
          found.push({ extracted: m, include: !isDuplicate, isDuplicate });
        }
      } catch (err) {
        console.warn(`Bulk medicine check failed for record ${scannableRecords[i].id}:`, err);
        errors++;
      }
    }

    setErrorCount(errors);
    setPendingMeds(found);
    setStatus('done');
  };

  const toggleMedInclude = (idx: number) => {
    setPendingMeds((prev) => prev.map((m, i) => (i === idx ? { ...m, include: !m.include } : m)));
  };

  const handleConfirm = () => {
    for (const { extracted, include } of pendingMeds) {
      if (!include) continue;
      onAddMedication({
        id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        person_id: records[0]?.person_id || '',
        molecule: extracted.molecule,
        brand_name: extracted.brand_name,
        strength: extracted.strength,
        time_of_day: extracted.time_of_day.length > 0 ? extracted.time_of_day : ['morning'],
        food_relation: extracted.food_relation,
        prescriber_name: 'Self-reported',
        prescriber_specialty: 'Not specified',
        prescribed_date: extracted.start_date,
        end_date: extracted.end_date,
        status: 'active',
        notes: extracted.notes,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    setStatus('idle');
    setPendingMeds([]);
    setErrorCount(0);
    onClose();
  };

  if (status === 'done' && pendingMeds.length > 0) {
    return (
      <MedicationConfirmModal
        isOpen
        personName={personName}
        pendingMeds={pendingMeds}
        onToggle={toggleMedInclude}
        onConfirm={handleConfirm}
        onClose={handleClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={handleClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-lavender-light text-lavender flex items-center justify-center">
              <IconSearch size={16} />
            </div>
            <h3 className="font-serif text-lg text-ink-800 leading-tight">Check All Records</h3>
          </div>
          <button onClick={handleClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="py-6 text-xs">
          {status === 'idle' && (
            <div className="text-center space-y-3">
              <p className="text-ink-600 leading-relaxed">
                Re-checks {scannableRecords.length} scanned {scannableRecords.length === 1 ? 'record' : 'records'}{' '}
                for {personName} for any medicines not already in the Medicines tab. You'll review everything
                found before anything is added.
              </p>
              <button
                onClick={handleStart}
                disabled={scannableRecords.length === 0}
                className="w-full py-2.5 bg-terracotta text-white rounded-xl text-xs font-medium hover:bg-terracotta-dark active:scale-98 transition-all disabled:opacity-50"
              >
                Start check
              </button>
            </div>
          )}

          {status === 'running' && (
            <div className="text-center space-y-3">
              <IconLoader size={22} className="animate-spin text-lavender mx-auto" />
              <p className="text-ink-600">
                Checking record {progress.current} of {progress.total}...
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center space-y-3">
              <p className="text-ink-600">
                No medicines found across {scannableRecords.length} records.
                {errorCount > 0 && ` (${errorCount} couldn't be checked — try again later.)`}
              </p>
              <button
                onClick={handleClose}
                className="w-full py-2 bg-paper-300 text-ink-700 rounded-xl text-xs font-medium"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
