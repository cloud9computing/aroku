import React, { useState } from 'react';
import { CareTeamMember, ClinicalFact, DocumentRecord, Medication, Species } from '../../types';
import { extractFactsFromImageOrText } from '../../services/gemini';
import { findExistingActiveMedication } from '../../utils/duplicateMedication';
import { normalizeDoctorName } from '../../utils/doctorName';
import { medicineDisplayName } from '../../utils/medicineName';
import { sanitizeMedicineCandidate } from '../../utils/sanitizeMedicine';
import { monthYearFromDate } from '../../utils/recordDate';
import { patientTypeForSpecies } from '../../utils/careTeam';
import { AddDoctorModal } from '../doctors/AddDoctorModal';
import {
  IconCheck,
  IconFileText,
  IconFileTypePdf,
  IconLoader,
  IconPencil,
  IconPill,
  IconStethoscope,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

// Firebase Storage download URLs end in "?alt=media&token=..." so a plain
// endsWith('.pdf') never matches — this was rendering PDFs through the <img>
// tag and showing a broken image icon.
function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

interface DocumentDetailModalProps {
  record: DocumentRecord | null;
  isOpen: boolean;
  familyId: string;
  personSpecies: Species;
  doctors: CareTeamMember[];
  medications: Medication[];
  onVerifyFact: (recordId: string, factId: string, verified: boolean) => void;
  onUpdateRecord: (record: DocumentRecord) => void;
  onDeleteRecord: (recordId: string) => void;
  onAddMedication: (medication: Medication) => void;
  onAddDoctor: (doctor: CareTeamMember) => void;
  onClose: () => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  record,
  isOpen,
  familyId,
  personSpecies,
  doctors,
  medications,
  onVerifyFact,
  onUpdateRecord,
  onDeleteRecord,
  onAddMedication,
  onAddDoctor,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'facts' | 'source'>('facts');
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [factValue, setFactValue] = useState('');
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState('');
  const [editingFactNameId, setEditingFactNameId] = useState<string | null>(null);
  const [factNameDraft, setFactNameDraft] = useState('');
  const [isCheckingMeds, setIsCheckingMeds] = useState(false);
  const [checkMedsError, setCheckMedsError] = useState<string | null>(null);

  if (!isOpen || !record) return null;

  // Re-sanitized on every render, not just on write — Gemini's JSON mode only
  // guarantees valid syntax, not the shape the prompt asked for, so a record
  // saved before this normalization existed can still hold a malformed
  // candidate (e.g. a null time_of_day) that would otherwise crash this view
  // every time it's opened. This heals it in place without touching the data.
  const pendingMedications = (record.pending_medications || []).map(sanitizeMedicineCandidate);
  const scanPages = record.image_urls && record.image_urls.length > 0 ? record.image_urls : record.image_url ? [record.image_url] : [];

  // Legacy backfill only — records created after this shipped already carry
  // pending_medications from the same extraction pass that finds the facts.
  const handleCheckForMedicines = async () => {
    if (!record.image_url) return;
    setCheckMedsError(null);
    setIsCheckingMeds(true);
    try {
      const extracted = await extractFactsFromImageOrText(familyId, { recordId: record.id });
      onUpdateRecord({ ...record, pending_medications: extracted.medications.map(sanitizeMedicineCandidate) });
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      setCheckMedsError(`Could not check this scan: ${detail}`);
    } finally {
      setIsCheckingMeds(false);
    }
  };

  const handleAddPendingMedication = (idx: number) => {
    const candidate = pendingMedications[idx];
    if (!candidate) return;
    onAddMedication({
      id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      person_id: record.person_id,
      molecule: candidate.molecule,
      brand_name: candidate.brand_name,
      strength: candidate.strength,
      time_of_day: candidate.time_of_day.length > 0 ? candidate.time_of_day : ['morning'],
      food_relation: candidate.food_relation,
      prescriber_name: record.doctor_name || 'Self-reported',
      prescriber_specialty: record.specialty || 'Not specified',
      prescribed_date: candidate.start_date,
      end_date: candidate.end_date,
      status: 'active',
      notes: candidate.notes,
    });
    onUpdateRecord({
      ...record,
      pending_medications: pendingMedications.filter((_, i) => i !== idx),
    });
  };

  const isDoctorAlreadySaved =
    !!record.doctor_name && doctors.some((d) => normalizeDoctorName(d.name) === normalizeDoctorName(record.doctor_name!));

  const handleStartEditTitle = () => {
    setTitleDraft(record.title);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== record.title) {
      onUpdateRecord({ ...record, title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const handleStartEditDate = () => {
    setDateDraft(record.date);
    setIsEditingDate(true);
  };

  const handleSaveDate = () => {
    if (dateDraft && dateDraft !== record.date) {
      onUpdateRecord({ ...record, date: dateDraft, month_year: monthYearFromDate(dateDraft) });
    }
    setIsEditingDate(false);
  };

  const handleStartEdit = (fact: ClinicalFact) => {
    setEditingFactId(fact.id);
    setFactValue(fact.value);
  };

  const handleStartEditFactName = (fact: ClinicalFact) => {
    setFactNameDraft(fact.name);
    setEditingFactNameId(fact.id);
  };

  const handleSaveFactName = (fact: ClinicalFact) => {
    const trimmed = factNameDraft.trim();
    if (trimmed && trimmed !== fact.name) {
      onUpdateRecord({
        ...record,
        facts: record.facts.map((f) => (f.id === fact.id ? { ...f, name: trimmed } : f)),
      });
    }
    setEditingFactNameId(null);
  };

  const handleSaveEdit = (fact: ClinicalFact) => {
    fact.value = factValue;
    onVerifyFact(record.id, fact.id, true);
    setEditingFactId(null);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete "${record.title}"? This removes the record and its scanned copy for everyone in the family. This can't be undone.`)) {
      onDeleteRecord(record.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0 gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[9.5px] uppercase tracking-wider text-terracotta font-semibold">
                {record.doc_type.replace('_', ' ')} ·
              </span>
              {isEditingDate ? (
                <span className="flex items-center gap-1">
                  <input
                    type="date"
                    value={dateDraft}
                    onChange={(e) => setDateDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveDate()}
                    autoFocus
                    className="text-[10px] text-ink-800 bg-white border border-terracotta rounded px-1 py-0.5 focus:outline-none"
                  />
                  <button onClick={handleSaveDate} className="text-sage p-0.5">
                    <IconCheck size={12} />
                  </button>
                </span>
              ) : (
                <button
                  onClick={handleStartEditDate}
                  className="flex items-center gap-1 group"
                  title="Tap to correct the date"
                >
                  <span className="text-[9.5px] uppercase tracking-wider text-terracotta font-semibold">
                    {record.date}
                  </span>
                  <IconPencil size={10} className="text-terracotta/50 group-hover:text-terracotta" />
                </button>
              )}
            </div>
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  autoFocus
                  className="flex-1 font-serif text-base text-ink-800 bg-white border border-terracotta rounded-lg px-2 py-1 focus:outline-none min-w-0"
                />
                <button onClick={handleSaveTitle} className="text-sage p-1 flex-shrink-0">
                  <IconCheck size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartEditTitle}
                className="flex items-center gap-1.5 mt-0.5 text-left group w-full min-w-0"
                title="Tap to rename"
              >
                <h3 className="font-serif text-lg text-ink-800 leading-tight truncate min-w-0">{record.title}</h3>
                <IconPencil size={13} className="text-ink-300 group-hover:text-ink-600 flex-shrink-0" />
              </button>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[10.5px] text-ink-400">{record.doctor_name || record.facility || 'Verified Source'}</p>
              {record.doctor_name && (
                isDoctorAlreadySaved ? (
                  <span className="text-[9px] text-sage flex items-center gap-0.5">
                    <IconCheck size={10} /> In Doctors
                  </span>
                ) : (
                  <button
                    onClick={() => setIsAddDoctorOpen(true)}
                    className="text-[9px] text-lavender hover:underline flex items-center gap-0.5 font-medium"
                  >
                    <IconStethoscope size={10} /> Add to Doctors
                  </button>
                )
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1 flex-shrink-0">
            <IconX size={18} />
          </button>
        </div>

        {/* View Switcher */}
        <div className="flex gap-2 my-2.5 p-0.5 bg-paper-400 rounded-xl text-xs flex-shrink-0">
          <button
            onClick={() => setActiveTab('facts')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'facts' ? 'bg-white text-ink-800 shadow-xs' : 'text-ink-500'
            }`}
          >
            Extracted Info ({record.facts.length + pendingMedications.length})
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'source' ? 'bg-white text-ink-800 shadow-xs' : 'text-ink-500'
            }`}
          >
            Source
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
          {activeTab === 'facts' ? (
            <>
              {pendingMedications.length > 0 && (
                <div className="space-y-2 pb-1">
                  <p className="text-[9px] uppercase tracking-wider text-lavender font-semibold px-0.5">
                    Medicines found in this scan
                  </p>
                  {pendingMedications.map((candidate, idx) => {
                    const isDuplicate = Boolean(findExistingActiveMedication(medications, candidate));
                    const { primary, secondary } = medicineDisplayName(candidate);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border bg-white border-paper-300 shadow-2xs flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-semibold text-ink-800 flex items-center gap-1.5 flex-wrap">
                            {primary} {candidate.strength}
                            {secondary && <span className="text-ink-400 font-normal italic">{secondary}</span>}
                          </p>
                          <p className="text-[10px] text-ink-400 mt-0.5">
                            {candidate.time_of_day.join(', ')} · {candidate.food_relation.replace('_', ' ')} · from{' '}
                            {candidate.start_date}
                            {candidate.end_date ? ` to ${candidate.end_date}` : ''}
                          </p>
                        </div>

                        {isDuplicate ? (
                          <span className="text-[9.5px] text-ochre flex items-center gap-0.5 font-medium px-2 py-0.5 bg-ochre-light/60 rounded-md flex-shrink-0 whitespace-nowrap">
                            Already added
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddPendingMedication(idx)}
                            className="px-2.5 py-1 bg-sage text-white rounded-lg text-[10.5px] font-medium hover:bg-sage-dark active:scale-95 transition-all flex items-center gap-1 shadow-2xs flex-shrink-0"
                          >
                            <IconPill size={12} /> Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {record.pending_medications === undefined && record.image_url && (
                <div className="pb-1">
                  <button
                    onClick={handleCheckForMedicines}
                    disabled={isCheckingMeds}
                    className="text-[10.5px] text-lavender hover:underline font-medium flex items-center gap-1 disabled:opacity-60"
                  >
                    {isCheckingMeds ? <IconLoader size={12} className="animate-spin" /> : <IconPill size={12} />}
                    {isCheckingMeds ? 'Checking…' : 'Check this scan for medicines'}
                  </button>
                  {checkMedsError && <p className="text-[10px] text-terracotta mt-1">{checkMedsError}</p>}
                </div>
              )}

              {record.facts.length === 0 ? (
                <p className="text-center py-6 text-xs text-ink-400">No extracted facts in this record.</p>
              ) : (
              record.facts.map((fact) => (
                <div
                  key={fact.id}
                  className={`p-3 rounded-xl border transition-all ${
                    fact.is_verified
                      ? 'bg-white border-paper-300'
                      : 'bg-ochre-light/40 border-ochre/30 shadow-2xs'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {editingFactNameId === fact.id ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="text"
                              value={factNameDraft}
                              onChange={(e) => setFactNameDraft(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveFactName(fact)}
                              autoFocus
                              className="text-[11.5px] font-semibold text-ink-800 bg-paper-50 border border-terracotta rounded px-1.5 py-0.5 focus:outline-none"
                            />
                            <button onClick={() => handleSaveFactName(fact)} className="text-sage p-0.5">
                              <IconCheck size={13} />
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleStartEditFactName(fact)}
                            className="flex items-center gap-1 group"
                            title="Rename — e.g. to match how you named this test elsewhere, so trends group correctly"
                          >
                            <span className="text-[11.5px] font-semibold text-ink-800">{fact.name}</span>
                            <IconPencil size={10} className="text-ink-200 group-hover:text-ink-600 flex-shrink-0" />
                          </button>
                        )}
                        {fact.condition_tag && (
                          <span className="text-[8.5px] px-1.5 py-0.5 rounded-md bg-paper-400 text-ink-600">
                            {fact.condition_tag}
                          </span>
                        )}
                        {fact.flag === 'abnormal' && (
                          <span className="text-[8.5px] px-1.5 py-0.5 rounded-md bg-terracotta-tint text-terracotta font-medium">
                            Abnormal
                          </span>
                        )}
                      </div>

                      {editingFactId === fact.id ? (
                        <div className="flex gap-2 mt-1.5">
                          <input
                            type="text"
                            value={factValue}
                            onChange={(e) => setFactValue(e.target.value)}
                            className="px-2 py-1 bg-white border border-terracotta rounded text-xs text-ink-800"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveEdit(fact)}
                            className="px-2 py-1 bg-sage text-white text-[11px] rounded"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-serif font-bold text-ink-900 mt-1">
                          {fact.value} {fact.unit && <span className="text-xs font-normal text-ink-500 font-sans">{fact.unit}</span>}
                        </p>
                      )}
                    </div>

                    {/* Verification Action */}
                    <div className="flex items-center gap-1">
                      {!fact.is_verified ? (
                        <button
                          onClick={() => onVerifyFact(record.id, fact.id, true)}
                          className="px-2.5 py-1 bg-sage text-white rounded-lg text-[10.5px] font-medium hover:bg-sage-dark active:scale-95 transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <IconCheck size={12} /> Verify
                        </button>
                      ) : (
                        <span className="text-[9.5px] text-sage flex items-center gap-0.5 font-medium px-2 py-0.5 bg-sage-light rounded-md">
                          <IconCheck size={11} /> Verified
                        </span>
                      )}

                      <button
                        onClick={() => handleStartEdit(fact)}
                        className="text-ink-300 hover:text-ink-700 p-1"
                        title="Edit value"
                      >
                        <IconPencil size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Provenance quote snippet */}
                  {fact.provenance_snippet && (
                    <div className="mt-2 pt-1.5 border-t border-paper-400/80 text-[10px] text-ink-500 leading-relaxed font-serif italic">
                      &ldquo;{fact.provenance_snippet}&rdquo;
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-between text-[8.5px] text-ink-400">
                    <span>Confidence: {(fact.confidence * 100).toFixed(0)}%</span>
                    <span>Single-Verification Fact Store</span>
                  </div>
                </div>
              ))
            )}
            </>
          ) : (
            <div className="bg-white border border-paper-300 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-ink-700 font-medium pb-1.5 border-b border-paper-300">
                <IconFileText size={15} className="text-terracotta" />
                <span>Original Document</span>
              </div>
              <p className="text-ink-600 leading-relaxed text-[11px]">
                <strong>Source:</strong> {record.facility || record.doctor_name || 'Unknown'}
                <br />
                <strong>Date Issued:</strong> {record.date}
                <br />
                <strong>Document Type:</strong> {record.doc_type}
              </p>

              {scanPages.length > 0 ? (
                <div className="space-y-2">
                  {scanPages.map((url, idx) =>
                    isPdfUrl(url) ? (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-2.5 bg-paper-400/40 hover:bg-paper-400/70 rounded-xl border border-paper-300 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-terracotta-light text-terracotta flex items-center justify-center flex-shrink-0">
                          <IconFileTypePdf size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11.5px] font-medium text-ink-800 truncate">
                            {record.title}{scanPages.length > 1 ? ` (page ${idx + 1})` : ''}
                          </p>
                          <p className="text-[10px] text-terracotta font-medium">Open scanned PDF</p>
                        </div>
                      </a>
                    ) : (
                      <div key={url}>
                        {scanPages.length > 1 && (
                          <p className="text-[9px] uppercase tracking-wider text-ink-400 font-semibold mb-1">
                            Page {idx + 1} of {scanPages.length}
                          </p>
                        )}
                        <a href={url} target="_blank" rel="noreferrer">
                          <img
                            src={url}
                            alt={`${record.title}${scanPages.length > 1 ? ` — page ${idx + 1}` : ''}`}
                            className="w-full rounded-lg border border-paper-300"
                          />
                        </a>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="text-[10.5px] text-ink-400 italic py-2">
                  No scanned copy was saved with this record.
                </p>
              )}

              {record.raw_text && (
                <div className="bg-paper-400/60 p-2.5 rounded-lg text-[10.5px] text-ink-700 font-mono whitespace-pre-wrap leading-relaxed">
                  {record.raw_text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-paper-300 flex justify-between items-center flex-shrink-0 gap-2">
          <button
            onClick={handleDelete}
            className="p-2 text-ink-300 hover:text-terracotta hover:bg-terracotta-light/40 rounded-xl transition-colors flex-shrink-0"
            title="Delete this record"
            aria-label="Delete record"
          >
            <IconTrash size={16} />
          </button>

          <button
            onClick={onClose}
            className="flex-1 px-4 py-1.5 bg-paper-300 hover:bg-paper-400 text-ink-700 text-xs font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      <AddDoctorModal
        isOpen={isAddDoctorOpen}
        initialValues={{ name: record.doctor_name, specialty: record.specialty, clinic: record.facility }}
        defaultPatientType={patientTypeForSpecies(personSpecies)}
        onAddDoctor={(doctor) => {
          onAddDoctor(doctor);
          setIsAddDoctorOpen(false);
        }}
        onClose={() => setIsAddDoctorOpen(false)}
      />
    </div>
  );
};
