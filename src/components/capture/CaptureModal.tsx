import React, { useState, useRef } from 'react';
import { DocumentRecord, Person } from '../../types';
import { extractFactsFromImageOrText } from '../../services/gemini';
import { uploadRecordImages } from '../../firebase/storageService';
import { sanitizeMedicineCandidate } from '../../utils/sanitizeMedicine';
import { monthYearFromDate } from '../../utils/recordDate';
import { LiveCameraCapture } from './LiveCameraCapture';
import {
  IconAlertTriangle,
  IconCamera,
  IconFileUpload,
  IconLoader,
  IconPill,
  IconX,
} from '@tabler/icons-react';

export type CaptureContext = 'records' | 'medicines';

interface CaptureModalProps {
  isOpen: boolean;
  familyId: string;
  person: Person;
  context?: CaptureContext;
  // When set, the scan fills in this scheduled placeholder (same id, status
  // cleared) instead of creating a brand new record.
  attachToRecord?: DocumentRecord | null;
  onAddRecord: (record: DocumentRecord) => void;
  onUpdateRecord?: (record: DocumentRecord) => void;
  onClose: () => void;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({
  isOpen,
  familyId,
  person,
  context = 'records',
  attachToRecord,
  onAddRecord,
  onUpdateRecord,
  onClose,
}) => {
  const [showCameraStream, setShowCameraStream] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isMedContext = context === 'medicines';

  const resetAndClose = () => {
    setShowCameraStream(false);
    setResultMessage(null);
    onClose();
  };

  const processAndCreateRecord = async (images: string[], mimeType: string) => {
    setError(null);
    setResultMessage(null);
    setIsProcessing(true);
    setProcessingStep(images.length > 1 ? `Uploading ${images.length} pages...` : 'Uploading the original document...');

    const recordId = attachToRecord?.id ?? `rec-${Date.now()}`;

    try {
      const imageUrls = await uploadRecordImages(
        familyId,
        recordId,
        images.map((base64Data) => ({ base64Data, mimeType }))
      );

      setProcessingStep('Extracting typed clinical values with Gemini AI...');
      let extracted;
      let extractionFailed = false;
      try {
        extracted = await extractFactsFromImageOrText(familyId, { base64Images: images, mimeType });
      } catch (err) {
        console.warn('AI extraction failed, saving the original document without extracted facts:', err);
        extractionFailed = true;
        extracted = {
          doc_type: attachToRecord?.doc_type ?? ('lab' as const),
          title: attachToRecord?.title ?? 'Captured document — needs manual review',
          date: attachToRecord?.date ?? new Date().toISOString().split('T')[0],
          condition_tags: ['General'],
          facts: [],
          medications: [],
        };
      }

      const recordDate = extracted.date || new Date().toISOString().split('T')[0];

      const newRecord: DocumentRecord = {
        id: recordId,
        person_id: person.id,
        doc_type: extracted.doc_type,
        title: extracted.title,
        date: recordDate,
        month_year: monthYearFromDate(recordDate),
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
        image_url: imageUrls[0],
        image_urls: imageUrls.length > 1 ? imageUrls : undefined,
        facts: extracted.facts.map((f, idx) => ({
          id: `f-${Date.now()}-${idx}`,
          document_id: recordId,
          person_id: person.id,
          name: f.name,
          value: f.value,
          unit: f.unit,
          date: recordDate,
          is_verified: false,
          confidence: f.confidence || 0.85,
          provenance_snippet: f.provenance_snippet || f.name,
          condition_tag: f.condition_tag || 'General',
          flag: f.flag || 'normal',
        })),
        // Extracted in the same call as facts, but never auto-added — like facts, these
        // sit as unconfirmed candidates on the record until someone taps "Add to medicines".
        pending_medications: extractionFailed ? undefined : extracted.medications.map(sanitizeMedicineCandidate),
        // Omitting `status` here (rather than 'completed') is deliberate: a full
        // setDoc overwrite drops the old 'scheduled' field entirely once a report lands.
      };

      if (attachToRecord && onUpdateRecord) {
        onUpdateRecord(newRecord);
      } else {
        onAddRecord(newRecord);
      }
      setIsProcessing(false);
      setShowCameraStream(false);

      if (!extractionFailed && extracted.medications.length > 0) {
        if (isMedContext) {
          setResultMessage(
            `Found ${extracted.medications.length} ${extracted.medications.length === 1 ? 'medicine' : 'medicines'} in that scan — open it from Records to add ${extracted.medications.length === 1 ? 'it' : 'them'} to the list.`
          );
        } else {
          resetAndClose();
        }
      } else if (isMedContext) {
        // Medicines-tab capture promises medicines specifically — a silent close here
        // would look like the scan did nothing, so say what actually happened.
        setResultMessage(
          extractionFailed
            ? "Couldn't read this scan automatically — it was saved to Records so you can add the medicines by hand."
            : 'No medicines were detected in that scan — it was saved to Records for review.'
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

  const handleCameraPhotosCaptured = (images: string[]) => {
    setShowCameraStream(false);
    processAndCreateRecord(images, 'image/jpeg');
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      processAndCreateRecord([base64], file.type || 'application/pdf');
    };
    reader.readAsDataURL(file);
  };

  if (showCameraStream) {
    return (
      <LiveCameraCapture
        onCapture={handleCameraPhotosCaptured}
        onCancel={() => setShowCameraStream(false)}
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
              {isMedContext ? <IconPill size={16} /> : <IconCamera size={16} />}
            </div>
            <div>
              <h3 className="font-serif text-lg text-ink-800 leading-tight">
                {attachToRecord ? 'Attach Report' : isMedContext ? 'Capture Prescription' : 'Capture Record'}
              </h3>
              <p className="text-[10px] text-ink-400">
                {attachToRecord
                  ? `Add the scan for "${attachToRecord.title}"`
                  : isMedContext
                  ? `We'll pull out the medicines and add them to ${person.name}'s list`
                  : `Add to ${person.name}'s clinical timeline`}
              </p>
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

            {resultMessage && (
              <div className="p-2.5 bg-lavender-light/60 border border-lavender/30 rounded-xl flex items-start gap-2">
                <IconPill size={14} className="text-lavender flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-ink-700">{resultMessage}</p>
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
              {isMedContext
                ? "Scan or upload the prescription — any medicines found will be waiting on the saved record for you to add with one tap."
                : "The original photo or PDF is always kept, even if automatic extraction doesn't find every value — " +
                  "you can verify or add facts by hand from the Records tab. If it's a prescription, any medicines " +
                  "found will be waiting there for you to add with one tap."}
              {' '}Multi-page report? Use the camera — it keeps the shutter open so you can capture every page before saving.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
