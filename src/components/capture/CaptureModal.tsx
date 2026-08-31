import React, { useState, useRef } from 'react';
import { DocumentRecord, Medication, Person } from '../../types';
import { extractFactsFromImageOrText } from '../../services/gemini';
import { uploadRecordImage } from '../../firebase/storageService';
import { findExistingActiveMedication } from '../../utils/duplicateMedication';
import { LiveCameraCapture } from './LiveCameraCapture';
import { MedicationConfirmModal, PendingMedication } from '../medicines/MedicationConfirmModal';
import {
  IconAlertTriangle,
  IconCamera,
  IconFileUpload,
  IconLoader,
  IconX,
} from '@tabler/icons-react';

interface CaptureModalProps {
  isOpen: boolean;
  familyId: string;
  person: Person;
  medications: Medication[];
  onAddRecord: (record: DocumentRecord) => void;
  onAddMedication: (medication: Medication) => void;
  onClose: () => void;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({
  isOpen,
  familyId,
  person,
  medications,
  onAddRecord,
  onAddMedication,
  onClose,
}) => {
  const [showCameraStream, setShowCameraStream] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingMeds, setPendingMeds] = useState<PendingMedication[] | null>(null);
  const [prescriberInfo, setPrescriberInfo] = useState<{ name?: string; specialty?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setPendingMeds(null);
    setShowCameraStream(false);
    onClose();
  };

  const processAndCreateRecord = async (base64: string, mimeType: string) => {
    setError(null);
    setIsProcessing(true);
    setProcessingStep('Uploading the original document...');

    const recordId = `rec-${Date.now()}`;

    try {
      const imageUrl = await uploadRecordImage(familyId, recordId, base64, mimeType);

      setProcessingStep('Extracting typed clinical values with Gemini AI...');
      let extracted;
      let extractionFailed = false;
      try {
        extracted = await extractFactsFromImageOrText(familyId, { base64Image: base64, mimeType });
      } catch (err) {
        console.warn('AI extraction failed, saving the original document without extracted facts:', err);
        extractionFailed = true;
        extracted = {
          doc_type: 'lab' as const,
          title: 'Captured document — needs manual review',
          date: new Date().toISOString().split('T')[0],
          condition_tags: ['General'],
          facts: [],
          medications: [],
        };
      }

      const newRecord: DocumentRecord = {
        id: recordId,
        person_id: person.id,
        doc_type: extracted.doc_type,
        title: extracted.title,
        date: extracted.date || new Date().toISOString().split('T')[0],
        month_year: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        subtitle: extractionFailed
          ? 'AI extraction unavailable — original saved for manual review'
          : extracted.facts.length > 0
          ? `${extracted.facts.length} values need a quick check`
          : 'No clinical values detected — tap to review',
        doctor_name: extracted.doctor_name,
        specialty: extracted.specialty,
        facility: extracted.facility,
        unverified_count: extracted.facts.length,
        condition_tags: extracted.condition_tags || ['General'],
        image_url: imageUrl,
        facts: extracted.facts.map((f, idx) => ({
          id: `f-${Date.now()}-${idx}`,
          document_id: recordId,
          person_id: person.id,
          name: f.name,
          value: f.value,
          unit: f.unit,
          date: extracted.date || new Date().toISOString().split('T')[0],
          is_verified: false,
          confidence: f.confidence || 0.85,
          provenance_snippet: f.provenance_snippet || f.name,
          condition_tag: f.condition_tag || 'General',
          flag: f.flag || 'normal',
        })),
      };

      onAddRecord(newRecord);
      setIsProcessing(false);
      setShowCameraStream(false);

      if (!extractionFailed && extracted.medications.length > 0) {
        setPrescriberInfo({ name: extracted.doctor_name, specialty: extracted.specialty });
        setPendingMeds(
          extracted.medications.map((m) => {
            const isDuplicate = Boolean(findExistingActiveMedication(medications, m));
            return { extracted: m, include: !isDuplicate, isDuplicate };
          })
        );
      } else {
        resetAndClose();
      }
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Could not save this document: ${detail}`);
    }
  };

  const handleCameraPhotoTaken = (base64: string) => {
    setShowCameraStream(false);
    processAndCreateRecord(base64, 'image/jpeg');
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      processAndCreateRecord(base64, file.type || 'application/pdf');
    };
    reader.readAsDataURL(file);
  };

  const toggleMedInclude = (idx: number) => {
    if (!pendingMeds) return;
    setPendingMeds(pendingMeds.map((m, i) => (i === idx ? { ...m, include: !m.include } : m)));
  };

  const handleConfirmMedications = () => {
    if (!pendingMeds) return;
    for (const { extracted, include } of pendingMeds) {
      if (!include) continue;
      onAddMedication({
        id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        person_id: person.id,
        molecule: extracted.molecule,
        brand_name: extracted.brand_name,
        strength: extracted.strength,
        time_of_day: extracted.time_of_day.length > 0 ? extracted.time_of_day : ['morning'],
        food_relation: extracted.food_relation,
        prescriber_name: prescriberInfo.name || 'Self-reported',
        prescriber_specialty: prescriberInfo.specialty || 'Not specified',
        prescribed_date: extracted.start_date,
        end_date: extracted.end_date,
        status: 'active',
        notes: extracted.notes,
      });
    }
    resetAndClose();
  };

  if (showCameraStream) {
    return (
      <LiveCameraCapture
        onCapture={handleCameraPhotoTaken}
        onCancel={() => setShowCameraStream(false)}
      />
    );
  }

  if (pendingMeds) {
    return (
      <MedicationConfirmModal
        isOpen
        personName={person.name}
        pendingMeds={pendingMeds}
        onToggle={toggleMedInclude}
        onConfirm={handleConfirmMedications}
        onClose={resetAndClose}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-terracotta-light text-terracotta flex items-center justify-center">
              <IconCamera size={16} />
            </div>
            <div>
              <h3 className="font-serif text-lg text-ink-800 leading-tight">Capture Record</h3>
              <p className="text-[10px] text-ink-400">Add to {person.name}&apos;s clinical timeline</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        {isProcessing ? (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-11 h-11 rounded-full bg-lavender-light text-lavender flex items-center justify-center animate-spin">
              <IconLoader size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-800">{processingStep}</p>
              <p className="text-[10px] text-ink-400 mt-1">Live Gemini multimodal OCR pipeline</p>
            </div>
          </div>
        ) : (
          <div className="py-3 space-y-3.5 text-xs overflow-y-auto pr-0.5">
            {error && (
              <div className="p-2.5 bg-terracotta-light/60 border border-terracotta/30 rounded-xl flex items-start gap-2">
                <IconAlertTriangle size={14} className="text-terracotta flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-ink-700">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setShowCameraStream(true)}
                className="py-3.5 px-3 bg-terracotta text-white rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-terracotta-dark active:scale-95 transition-all shadow-2xs"
              >
                <IconCamera size={20} />
                <span className="font-medium text-[11px]">Open Camera</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-3.5 px-3 bg-paper-300 text-ink-700 rounded-xl flex flex-col items-center justify-center gap-1.5 hover:bg-paper-400 active:scale-95 transition-all shadow-2xs"
              >
                <IconFileUpload size={20} />
                <span className="font-medium text-[11px]">Upload Photo / PDF</span>
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              onChange={handleFileSelected}
              className="hidden"
            />

            <p className="text-[10px] text-ink-400 leading-relaxed pt-1">
              The original photo or PDF is always kept, even if automatic extraction doesn&apos;t find every value —
              you can verify or add facts by hand from the Records tab. If it&apos;s a prescription, you&apos;ll be
              asked to confirm any medicines found before they&apos;re added.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
