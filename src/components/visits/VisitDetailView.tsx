import React, { useMemo, useRef, useState } from 'react';
import { Person, Question, Visit, Medication, DocumentRecord, CareTeamMember, PendingNote } from '../../types';
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconCamera,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconFileUpload,
  IconLoader,
  IconMicrophone,
  IconPencil,
  IconPrinter,
  IconShare,
  IconSparkles,
  IconStethoscope,
  IconTrash,
} from '@tabler/icons-react';
import { LiveCameraCapture } from '../capture/LiveCameraCapture';
import { AddDoctorModal } from '../doctors/AddDoctorModal';
import { computeFactTrends } from '../../utils/factTrends';
import { TrendDisplay } from '../common/TrendDisplay';
import { normalizeDoctorName } from '../../utils/doctorName';
import { patientTypeForSpecies } from '../../utils/careTeam';
import { buildPatientContext } from '../../utils/patientContext';
import { generateVisitQuestions, extractFactsFromImageOrText, extractConsultationFactsFromAudio } from '../../services/gemini';
import { uploadRecordImages, uploadConsultationAudio } from '../../firebase/storageService';
import { sanitizeMedicineCandidate } from '../../utils/sanitizeMedicine';
import { monthYearFromDate } from '../../utils/recordDate';

interface VisitDetailViewProps {
  familyId: string;
  visit: Visit;
  person: Person;
  medications: Medication[];
  records: DocumentRecord[];
  visits: Visit[];
  careTeam: CareTeamMember[];
  pendingNotes: PendingNote[];
  onBack: () => void;
  onUpdateVisit: (visit: Visit) => void;
  onDeleteVisit: (visitId: string) => void;
  onResolvePendingNote: (noteId: string) => void;
  onAddRecord: (record: DocumentRecord) => void;
  onAddDoctor: (doctor: CareTeamMember) => void;
}

export const VisitDetailView: React.FC<VisitDetailViewProps> = ({
  familyId,
  visit,
  person,
  medications,
  records,
  visits,
  careTeam,
  pendingNotes,
  onBack,
  onUpdateVisit,
  onDeleteVisit,
  onResolvePendingNote,
  onAddRecord,
  onAddDoctor,
}) => {
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const isDoctorAlreadySaved = careTeam.some(
    (d) => normalizeDoctorName(d.name) === normalizeDoctorName(visit.doctor_name)
  );
  // Question editing state
  const [questions, setQuestions] = useState<Question[]>(visit.questions || []);
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [questionGenError, setQuestionGenError] = useState<string | null>(null);

  // Wrap-up-visit state — a visit stays "upcoming" forever unless the caregiver
  // explicitly marks it done here, since nothing else in the app ever flips it.
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [takeaways, setTakeaways] = useState(visit.past_recap?.what_happened || '');
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [editDoctorName, setEditDoctorName] = useState(visit.doctor_name);
  const [editSpecialty, setEditSpecialty] = useState(visit.specialty);
  const [editLocation, setEditLocation] = useState(visit.location);
  const [editReason, setEditReason] = useState(visit.reason || '');
  const [editDate, setEditDate] = useState(visit.date);
  const [editTime, setEditTime] = useState(visit.time);
  const [showCameraStream, setShowCameraStream] = useState(false);
  const [isScanningSummary, setIsScanningSummary] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const summaryFileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingRecording, setIsProcessingRecording] = useState(false);
  const [recordingProcessingStep, setRecordingProcessingStep] = useState('');
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recordingFileInputRef = useRef<HTMLInputElement>(null);

  const trends = useMemo(() => computeFactTrends(records).slice(0, 4), [records]);

  const relevantNotes = useMemo(
    () =>
      pendingNotes.filter(
        (n) => !n.resolved && n.target_doctor && normalizeDoctorName(n.target_doctor) === normalizeDoctorName(visit.doctor_name)
      ),
    [pendingNotes, visit.doctor_name]
  );

  const handleGenerateQuestions = async () => {
    setIsGeneratingQuestions(true);
    setQuestionGenError(null);
    try {
      const patientContext = buildPatientContext(person, records, medications, visits, careTeam);
      const { questions: generated } = await generateVisitQuestions(
        familyId,
        patientContext,
        visit.doctor_name,
        visit.specialty,
        visit.reason || ''
      );
      if (generated.length === 0) {
        setQuestionGenError("Couldn't draft any questions from the current records — try adding more visit history first.");
        return;
      }
      const mapped: Question[] = generated.map((q, idx) => ({
        id: `q-${Date.now()}-${idx}`,
        visit_id: visit.id,
        text: q.text,
        status: 'kept',
        rationale: q.rationale,
        fact_citations: q.fact_citations,
      }));
      setQuestions(mapped);
      onUpdateVisit({
        ...visit,
        questions: mapped,
        brief_status: `Brief ready · ${mapped.length} questions kept`,
      });
    } catch (e) {
      console.error('Failed to generate visit questions:', e);
      setQuestionGenError("Couldn't reach the AI assistant to draft questions — please try again.");
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handleToggleQuestion = (qId: string) => {
    const updated = questions.map((q) => {
      if (q.id === qId) {
        const nextStatus = q.status === 'kept' ? 'dropped' : 'kept';
        return { ...q, status: nextStatus as 'kept' | 'dropped' };
      }
      return q;
    });
    setQuestions(updated);
    const keptCount = updated.filter((q) => q.status === 'kept').length;
    onUpdateVisit({
      ...visit,
      questions: updated,
      brief_status: `Brief ready · ${keptCount} questions kept`,
    });
  };

  const handleSaveEditedQuestion = (qId: string) => {
    const updated = questions.map((q) => (q.id === qId ? { ...q, text: editingText, status: 'kept' as const } : q));
    setQuestions(updated);
    setEditingQId(null);
    onUpdateVisit({
      ...visit,
      questions: updated,
    });
  };

  const handleRecordingFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setRecordingError(null);
    setIsProcessingRecording(true);
    setRecordingProcessingStep('Uploading the recording...');

    try {
      const audioUrl = await uploadConsultationAudio(familyId, visit.id, file);

      setRecordingProcessingStep('Gemini is transcribing and summarizing...');
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const extracted = await extractConsultationFactsFromAudio(
        familyId,
        base64,
        file.type || 'audio/mp4',
        visit.doctor_name,
        visit.specialty
      );

      const recap = {
        what_happened: extracted.what_happened,
        decisions: extracted.decisions,
        answers_captured: extracted.answers_captured,
        audio_url: audioUrl,
        full_transcript: extracted.full_transcript,
        detected_language: extracted.detected_language,
        translated_transcript: extracted.translated_transcript,
      };
      onUpdateVisit({ ...visit, past_recap: recap });
      setTakeaways(extracted.what_happened);
    } catch (err) {
      console.error('Failed to process the uploaded recording:', err);
      const detail = err instanceof Error ? err.message : String(err);
      setRecordingError(`Could not process that recording: ${detail}`);
    } finally {
      setIsProcessingRecording(false);
    }
  };

  const handleScanSummary = async (images: string[], mimeType: string) => {
    setScanError(null);
    setIsScanningSummary(true);
    const recordId = `rec-${Date.now()}`;
    try {
      const imageUrls = await uploadRecordImages(
        familyId,
        recordId,
        images.map((base64Data) => ({ base64Data, mimeType }))
      );
      const extracted = await extractFactsFromImageOrText(familyId, { base64Images: images, mimeType });
      const recordDate = extracted.date || visit.date;

      const newRecord: DocumentRecord = {
        id: recordId,
        person_id: person.id,
        doc_type: extracted.doc_type,
        title: extracted.title || `Consultation summary — ${visit.doctor_name}`,
        date: recordDate,
        month_year: monthYearFromDate(recordDate),
        subtitle: extracted.facts.length > 0 ? `${extracted.facts.length} values need a quick check` : 'Scanned consultation summary',
        doctor_name: extracted.doctor_name || visit.doctor_name,
        specialty: extracted.specialty || visit.specialty,
        facility: extracted.facility,
        unverified_count: extracted.facts.length,
        condition_tags: extracted.condition_tags && extracted.condition_tags.length > 0 ? extracted.condition_tags : ['General'],
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
        pending_medications: extracted.medications.map(sanitizeMedicineCandidate),
      };
      onAddRecord(newRecord);

      const scannedLines = extracted.facts.map((f) => `${f.name}: ${f.value}${f.unit ? ' ' + f.unit : ''}`);
      const scannedText = [extracted.title, ...scannedLines].filter(Boolean).join('\n');
      setTakeaways((prev) => (prev.trim() ? `${prev.trim()}\n\n${scannedText}` : scannedText));
    } catch (err) {
      console.error('Failed to scan consultation summary:', err);
      const detail = err instanceof Error ? err.message : String(err);
      setScanError(`Could not read that scan: ${detail}`);
    } finally {
      setIsScanningSummary(false);
    }
  };

  const handleCameraPhotosCaptured = (images: string[]) => {
    setShowCameraStream(false);
    handleScanSummary(images, 'image/jpeg');
  };

  const handleSummaryFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(',')[1];
      handleScanSummary([base64], file.type || 'application/pdf');
    };
    reader.readAsDataURL(file);
  };

  const handleMarkComplete = () => {
    const finalTakeaways = takeaways.trim();
    if (!finalTakeaways) return;
    onUpdateVisit({
      ...visit,
      is_upcoming: false,
      past_recap: {
        what_happened: finalTakeaways,
        decisions: visit.past_recap?.decisions || [],
        answers_captured: visit.past_recap?.answers_captured || [],
        audio_url: visit.past_recap?.audio_url,
        full_transcript: visit.past_recap?.full_transcript,
        detected_language: visit.past_recap?.detected_language,
        translated_transcript: visit.past_recap?.translated_transcript,
      },
    });
    onBack();
  };

  const handleSaveDetails = () => {
    if (!editDoctorName.trim() || !editDate) return;
    const dateDisplay = new Date(`${editDate}T00:00:00`).toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    onUpdateVisit({
      ...visit,
      doctor_name: editDoctorName.trim(),
      specialty: editSpecialty.trim() || visit.specialty,
      location: editLocation.trim(),
      reason: editReason.trim() || undefined,
      date: editDate,
      date_display: dateDisplay,
      time: editTime.trim() || visit.time,
    });
    setShowEditDetails(false);
  };

  const keptQuestions = questions.filter((q) => q.status === 'kept');

  const handleDelete = () => {
    if (window.confirm(`Cancel this visit with ${visit.doctor_name}? This removes it, its prep brief, and any recording, for everyone in the family. This can't be undone.`)) {
      onDeleteVisit(visit.id);
    }
  };

  // Copy WhatsApp Friendly Text
  const handleCopyWhatsApp = async () => {
    const text =
      `*PRE-APPOINTMENT BRIEF: ${person.name.toUpperCase()}*\n` +
      `Doctor: ${visit.doctor_name} (${visit.specialty})\n` +
      `Date: ${visit.date_display} · ${visit.time}\n\n` +
      `*ACTIVE PROBLEMS:*\n${person.active_conditions.join(' · ')}\n\n` +
      `*SINCE YOUR LAST VISIT:*\n${(visit.since_last_visit || []).join('\n')}\n\n` +
      `*QUESTIONS FOR TODAY:*\n` +
      keptQuestions.map((q, i) => `${i + 1}. ${q.text}`).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Brief for ${visit.doctor_name}`,
          text: text,
        });
        return;
      } catch (e) {}
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showCameraStream) {
    return <LiveCameraCapture onCapture={handleCameraPhotosCaptured} onCancel={() => setShowCameraStream(false)} />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 pb-4">
      {/* Header with Back button */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-paper-300 select-none">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 p-1 -ml-1 rounded-lg transition-colors"
        >
          <IconArrowLeft size={16} />
          <span className="text-[11px] font-medium">Visits</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyWhatsApp}
            className="p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-paper-400 transition-colors"
            title="Share or Copy for WhatsApp"
          >
            {copied ? <IconCheck size={16} className="text-sage" /> : <IconShare size={16} />}
          </button>
          <button
            onClick={() => window.print()}
            className="p-1.5 rounded-lg text-ink-500 hover:text-ink-800 hover:bg-paper-400 transition-colors"
            title="Print 1-Page A4 Specialist Brief"
          >
            <IconPrinter size={16} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg text-ink-300 hover:text-terracotta hover:bg-terracotta-light/40 transition-colors"
            title="Cancel / delete this visit"
            aria-label="Delete visit"
          >
            <IconTrash size={16} />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="px-4 pt-3.5 flex-1 min-h-0 overflow-y-auto space-y-3.5">
        {/* Doctor & Date Header */}
        <div>
          <h2 className="font-serif text-[17.5px] text-ink-800 leading-tight">
            {visit.doctor_name} · {visit.specialty}
          </h2>
          <p className="text-[11px] text-ink-400 mt-0.5">
            {visit.date_display} · {visit.time} · {visit.location}
          </p>
          {isDoctorAlreadySaved ? (
            <span className="text-[9px] text-sage flex items-center gap-0.5 mt-1">
              <IconCheck size={10} /> In Doctors
            </span>
          ) : (
            <button
              onClick={() => setIsAddDoctorOpen(true)}
              className="text-[9px] text-lavender hover:underline flex items-center gap-0.5 font-medium mt-1"
            >
              <IconStethoscope size={10} /> Add to Doctors
            </button>
          )}
        </div>

        {/* YOUR PREP BRIEF (The Centerpiece) */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] uppercase tracking-wider text-ink-200 font-semibold">
              Your Prep Brief
            </span>
            <span className="text-[9px] text-ink-400">1-Page Referral Format</span>
          </div>

          {/* Active Problems Section */}
          <div className="bg-paper-50 border border-paper-500 rounded-2xl p-3 shadow-2xs space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold">
              Active Problems
            </p>
            <p className="text-[11.5px] text-ink-800 leading-relaxed font-serif">
              {person.active_conditions.join('  ·  ')}
            </p>
          </div>

          {/* Since Your Last Visit Section */}
          {visit.since_last_visit && visit.since_last_visit.length > 0 && (
            <div className="bg-paper-50 border border-paper-500 rounded-2xl p-3 shadow-2xs space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider text-sage font-semibold">
                Since your last visit
              </p>
              <div className="space-y-1">
                {visit.since_last_visit.map((item, idx) => (
                  <p key={idx} className="text-[11px] text-sage-dark leading-relaxed">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Notes for this visit — caregiver notes drafted via the assistant, attached to this doctor */}
          {relevantNotes.length > 0 && (
            <div className="bg-paper-50 border border-paper-500 rounded-2xl p-3 shadow-2xs space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider text-terracotta font-semibold">
                Notes for this visit
              </p>
              <div className="space-y-2">
                {relevantNotes.map((note) => (
                  <div key={note.id} className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-ink-800 leading-relaxed font-serif italic flex-1">
                      &ldquo;{note.note_text}&rdquo;
                    </p>
                    <button
                      onClick={() => onResolvePendingNote(note.id)}
                      className="text-[9.5px] text-ink-400 hover:text-sage border border-paper-400 hover:border-sage rounded-lg px-2 py-1 flex-shrink-0 transition-colors"
                    >
                      Mark addressed
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relevant Trends Section — real values from verified facts, not demo data */}
          {trends.length > 0 && (
            <div className="bg-paper-50 border border-paper-500 rounded-2xl p-3 shadow-2xs space-y-1.5">
              <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold">
                Relevant Trends
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {trends.map((trend) => (
                  <div key={trend.key} className="bg-white p-2 rounded-xl border border-paper-400 shadow-2xs">
                    <span className="text-[8.5px] text-ink-400 uppercase block mb-1">{trend.name}</span>
                    <TrendDisplay trend={trend} variant="compact" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions Section (M3) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[9.5px] uppercase tracking-wider text-ink-200 font-semibold">
                Questions ({keptQuestions.length} kept)
              </span>
              <span className="text-[9px] text-terracotta font-medium">Curate before visit</span>
            </div>

            {/* AI prep-question generation — the primary CTA the first time (still just the
                placeholder question), a smaller secondary action once real questions exist so
                a curated list isn't nuked by accident. */}
            <div className="flex items-center gap-2">
              {questions.length <= 1 ? (
                <button
                  onClick={handleGenerateQuestions}
                  disabled={isGeneratingQuestions}
                  className="flex-1 py-2 bg-lavender-light text-lavender font-medium rounded-xl text-[11px] flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-98 transition-all disabled:opacity-60"
                >
                  {isGeneratingQuestions ? (
                    <IconLoader size={13} className="animate-spin" />
                  ) : (
                    <IconSparkles size={13} />
                  )}
                  {isGeneratingQuestions ? 'Drafting questions…' : 'Generate prep questions with AI'}
                </button>
              ) : (
                <button
                  onClick={handleGenerateQuestions}
                  disabled={isGeneratingQuestions}
                  className="text-[9.5px] text-lavender hover:text-lavender/80 font-medium flex items-center gap-1 disabled:opacity-60"
                >
                  {isGeneratingQuestions ? (
                    <IconLoader size={11} className="animate-spin" />
                  ) : (
                    <IconSparkles size={11} />
                  )}
                  {isGeneratingQuestions ? 'Drafting…' : 'Regenerate questions'}
                </button>
              )}
            </div>

            {questionGenError && (
              <p className="text-[10px] text-terracotta">{questionGenError}</p>
            )}

            <div className="space-y-2">
              {questions.map((q) => {
                const isKept = q.status === 'kept';
                const isEditing = editingQId === q.id;

                return (
                  <div
                    key={q.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      isKept
                        ? 'bg-paper-50 border-paper-500 shadow-2xs'
                        : 'bg-paper-400/50 border-paper-400 opacity-60'
                    }`}
                  >
                    <div className="flex gap-2.5 items-start">
                      <button
                        onClick={() => handleToggleQuestion(q.id)}
                        className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 transition-all ${
                          isKept ? 'bg-terracotta text-white shadow-2xs' : 'border border-ink-300 bg-white'
                        }`}
                        title={isKept ? 'Drop Question' : 'Keep Question'}
                      >
                        {isKept && <IconCheck size={11} />}
                      </button>

                      <div className="flex-1 text-xs">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full p-2 bg-white border border-paper-400 rounded-xl text-xs text-ink-800"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSaveEditedQuestion(q.id)}
                                className="px-3 py-1 bg-sage text-white text-[11px] rounded-lg"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingQId(null)}
                                className="px-3 py-1 bg-paper-300 text-ink-600 text-[11px] rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p
                            onClick={() => handleToggleQuestion(q.id)}
                            className={`text-[11.5px] leading-relaxed cursor-pointer ${
                              isKept ? 'text-ink-800' : 'text-ink-400 line-through'
                            }`}
                          >
                            {q.text}
                          </p>
                        )}

                        {q.rationale && !isEditing && (
                          <p className="text-[9.5px] text-ink-400 mt-1 italic">
                            Why asked: {q.rationale}
                          </p>
                        )}

                        {q.fact_citations && q.fact_citations.length > 0 && !isEditing && (
                          <div className="mt-1 space-y-0.5">
                            {q.fact_citations.map((cite, idx) => (
                              <p key={idx} className="text-[9px] text-ink-300">
                                Source: {cite}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <button
                          onClick={() => {
                            setEditingQId(q.id);
                            setEditingText(q.text);
                          }}
                          className="text-ink-300 hover:text-ink-700 p-1 flex-shrink-0"
                          title="Edit Question"
                        >
                          <IconPencil size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Wrap up the visit — the only place a visit stops being "upcoming" */}
        <div className="bg-paper-50 border border-paper-500 rounded-2xl p-3 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] uppercase tracking-wider text-ink-200 font-semibold">
              Wrap Up
            </span>
            {!showWrapUp && !showEditDetails && (
              <span className="text-[9px] text-ink-400">After the appointment</span>
            )}
          </div>

          {showEditDetails ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Doctor</p>
                  <input
                    type="text"
                    value={editDoctorName}
                    onChange={(e) => setEditDoctorName(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-paper-400 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                  />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Specialty</p>
                  <input
                    type="text"
                    value={editSpecialty}
                    onChange={(e) => setEditSpecialty(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-paper-400 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                  />
                </div>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Location</p>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-paper-400 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Reason</p>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Not set"
                  className="w-full px-2.5 py-2 bg-white border border-paper-400 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Date</p>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-paper-400 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                  />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">Time</p>
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    placeholder="e.g. 4:30 PM"
                    className="w-full px-2.5 py-2 bg-white border border-paper-400 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditDetails(false)}
                  className="flex-1 py-2 bg-paper-300 hover:bg-paper-400 text-ink-700 text-[11px] font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDetails}
                  disabled={!editDoctorName.trim() || !editDate}
                  className="flex-1 py-2 bg-lavender text-white text-[11px] font-medium rounded-xl hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <IconCalendarEvent size={14} />
                  Save changes
                </button>
              </div>
            </div>
          ) : !showWrapUp ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowWrapUp(true)}
                className="py-2 bg-sage-light text-sage-dark font-medium rounded-xl text-[11px] flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-98 transition-all"
              >
                <IconCircleCheck size={14} />
                Mark completed
              </button>
              <button
                onClick={() => {
                  setEditDoctorName(visit.doctor_name);
                  setEditSpecialty(visit.specialty);
                  setEditLocation(visit.location);
                  setEditReason(visit.reason || '');
                  setEditDate(visit.date);
                  setEditTime(visit.time);
                  setShowEditDetails(true);
                }}
                className="py-2 bg-lavender-light text-lavender font-medium rounded-xl text-[11px] flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-98 transition-all"
              >
                <IconPencil size={14} />
                Edit details
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
                  Key takeaways
                </p>
                <textarea
                  value={takeaways}
                  onChange={(e) => setTakeaways(e.target.value)}
                  placeholder="What did the doctor say? Any new diagnoses, medicine changes, or follow-up steps..."
                  className="w-full p-2.5 bg-white border border-paper-400 rounded-xl text-[11.5px] text-ink-800 leading-relaxed"
                  rows={4}
                />
                <p className="text-[9.5px] text-ink-400 mt-1">
                  Upload a recording or scan a summary below and we&apos;ll fill this in for you.
                </p>
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
                  Consultation recording
                </p>
                {visit.consent_state === 'declined' ? (
                  <p className="text-[10.5px] text-ink-400 italic py-2 px-2.5 bg-paper-400/40 rounded-xl">
                    {visit.doctor_name} declined recording — add key takeaways by hand or scan a written summary instead.
                  </p>
                ) : (
                  <button
                    onClick={() => recordingFileInputRef.current?.click()}
                    disabled={isProcessingRecording}
                    className="w-full py-2.5 bg-lavender-light text-lavender rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-98 transition-all disabled:opacity-60"
                  >
                    {isProcessingRecording ? <IconLoader size={14} className="animate-spin" /> : <IconMicrophone size={14} />}
                    {isProcessingRecording ? recordingProcessingStep : 'Upload recording'}
                  </button>
                )}
                <input
                  type="file"
                  ref={recordingFileInputRef}
                  accept="audio/*"
                  onChange={handleRecordingFileSelected}
                  className="hidden"
                />
                {recordingError && <p className="text-[10px] text-terracotta mt-1">{recordingError}</p>}
                {visit.past_recap?.detected_language && visit.past_recap.detected_language.toLowerCase() !== 'english' && (
                  <p className="text-[9.5px] text-sage-dark mt-1">
                    Detected language: {visit.past_recap.detected_language} — translated to English above.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-paper-400" />
                <span className="text-[9px] text-ink-300 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-paper-400" />
              </div>

              <div>
                <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
                  Scanned summary
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowCameraStream(true)}
                    disabled={isScanningSummary}
                    className="py-2.5 bg-paper-300 text-ink-700 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 hover:bg-paper-400 active:scale-98 transition-all disabled:opacity-60"
                  >
                    <IconCamera size={16} />
                    Scan summary
                  </button>
                  <button
                    onClick={() => summaryFileInputRef.current?.click()}
                    disabled={isScanningSummary}
                    className="py-2.5 bg-paper-300 text-ink-700 rounded-xl text-[11px] font-medium flex flex-col items-center justify-center gap-1 hover:bg-paper-400 active:scale-98 transition-all disabled:opacity-60"
                  >
                    <IconFileUpload size={16} />
                    Upload summary
                  </button>
                </div>
                <input
                  type="file"
                  ref={summaryFileInputRef}
                  accept="image/*,application/pdf"
                  onChange={handleSummaryFileSelected}
                  className="hidden"
                />

                {isScanningSummary && (
                  <div className="flex items-center gap-2 text-[11px] text-ink-500 py-1">
                    <IconLoader size={13} className="animate-spin" />
                    Reading the scanned summary...
                  </div>
                )}

                {scanError && <p className="text-[10px] text-terracotta mt-1">{scanError}</p>}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowWrapUp(false)}
                  className="flex-1 py-2 bg-paper-300 hover:bg-paper-400 text-ink-700 text-[11px] font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkComplete}
                  disabled={!takeaways.trim()}
                  className="flex-1 py-2 bg-sage text-white text-[11px] font-medium rounded-xl hover:bg-sage-dark active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <IconCircleCheck size={14} />
                  Mark completed
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Printable 1-Page A4 Brief Sheet */}
      <div className="hidden print:block print-page">
        <div className="border-b-2 border-black pb-4 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold font-serif">{person.name.toUpperCase()}</h1>
            <p className="text-sm">
              {person.sex}, Age {person.age}
            </p>
            <p className="text-xs text-gray-600">Prepared by Ravi (Caregiver) · {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">Brief for: {visit.doctor_name.toUpperCase()}</p>
            <p className="text-xs">{visit.specialty} · {visit.location}</p>
            <p className="text-xs">{visit.date_display} · {visit.time}</p>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider border-b border-gray-300 pb-0.5">
              Active Problems
            </h3>
            <p className="mt-1">{person.active_conditions.join(' · ')}</p>
          </div>

          {visit.since_last_visit && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider border-b border-gray-300 pb-0.5">
                Since Your Last Visit
              </h3>
              <ul className="list-disc pl-4 mt-1 space-y-1">
                {visit.since_last_visit.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider border-b border-gray-300 pb-0.5">
              Active Medications ({medications.filter((m) => m.status === 'active').length})
            </h3>
            <div className="grid grid-cols-2 gap-1 mt-1 text-xs">
              {medications
                .filter((m) => m.status === 'active')
                .map((m) => (
                  <div key={m.id}>
                    • <strong>{m.molecule} {m.strength}</strong> ({m.time_of_day.join('/')}, {m.food_relation.replace('_', ' ')}) — Dr. {m.prescriber_name.replace('Dr. ', '')}
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider border-b border-gray-300 pb-0.5">
              Questions For Today ({keptQuestions.length})
            </h3>
            <ol className="list-decimal pl-4 mt-1 space-y-1.5">
              {keptQuestions.map((q, i) => (
                <li key={i} className="font-medium">
                  {q.text}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <AddDoctorModal
        isOpen={isAddDoctorOpen}
        initialValues={{ name: visit.doctor_name, specialty: visit.specialty, clinic: visit.location }}
        defaultPatientType={patientTypeForSpecies(person.species)}
        onAddDoctor={(doctor) => {
          onAddDoctor(doctor);
          setIsAddDoctorOpen(false);
        }}
        onClose={() => setIsAddDoctorOpen(false)}
      />
    </div>
  );
};
