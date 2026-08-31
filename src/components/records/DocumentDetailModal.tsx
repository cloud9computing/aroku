import React, { useState } from 'react';
import { CareTeamMember, ClinicalFact, DocumentRecord, Medication } from '../../types';
import { extractFactsFromImageOrText } from '../../services/gemini';
import { findExistingActiveMedication } from '../../utils/duplicateMedication';
import { MedicationConfirmModal, PendingMedication } from '../medicines/MedicationConfirmModal';
import { AddDoctorModal } from '../doctors/AddDoctorModal';
import {
  IconCheck,
  IconFileText,
  IconLoader,
  IconPencil,
  IconPill,
  IconStethoscope,
  IconTrash,
  IconX,
} from '@tabler/icons-react';

interface DocumentDetailModalProps {
  record: DocumentRecord | null;
  isOpen: boolean;
  familyId: string;
  personName: string;
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
  personName,
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
  const [checkMedsMessage, setCheckMedsMessage] = useState<string | null>(null);
  const [pendingMeds, setPendingMeds] = useState<PendingMedication[] | null>(null);
  const [prescriberInfo, setPrescriberInfo] = useState<{ name?: string; specialty?: string }>({});

  if (!isOpen || !record) return null;

  const handleCheckForMedicines = async () => {
    if (!record.image_url) return;
    setCheckMedsMessage(null);
    setIsCheckingMeds(true);
    try {
      const extracted = await extractFactsFromImageOrText(familyId, { recordId: record.id });
      if (extracted.medications.length === 0) {
        setCheckMedsMessage('No medicines detected in this scan.');
      } else {
        setPrescriberInfo({ name: record.doctor_name || extracted.doctor_name, specialty: record.specialty || extracted.specialty });
        setPendingMeds(
          extracted.medications.map((m) => {
            const isDuplicate = Boolean(findExistingActiveMedication(medications, m));
            return { extracted: m, include: !isDuplicate, isDuplicate };
          })
        );
      }
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : String(err);
      setCheckMedsMessage(`Could not check this scan: ${detail}`);
    } finally {
      setIsCheckingMeds(false);
    }
  };

  const toggleMedInclude = (idx: number) => {
    if (!pendingMeds) return;
    setPendingMeds(pendingMeds.map((m, i) => (i === idx ? { ...m, include: !m.include } : m)));
  };

  const handleConfirmMedications = () => {
    if (!pendingMeds || !record) return;
    for (const { extracted, include } of pendingMeds) {
      if (!include) continue;
      onAddMedication({
        id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        person_id: record.person_id,
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
    setPendingMeds(null);
  };

  const normalizeDoctorName = (name: string) => name.trim().toLowerCase().replace(/^dr\.?\s*/, '');

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
      const month_year = new Date(dateDraft + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      onUpdateRecord({ ...record, date: dateDraft, month_year });
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
                className="flex items-center gap-1.5 mt-0.5 text-left group"
                title="Tap to rename"
              >
                <h3 className="font-serif text-lg text-ink-800 leading-tight truncate">{record.title}</h3>
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
            Extracted Clinical Facts ({record.facts.length})
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'source' ? 'bg-white text-ink-800 shadow-xs' : 'text-ink-500'
            }`}
          >
            Source Provenance
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
          {activeTab === 'facts' ? (
            record.facts.length === 0 ? (
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
            )
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

              {record.image_url ? (
                record.image_url.endsWith('.pdf') ? (
                  <a
                    href={record.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-center py-2.5 bg-paper-400/60 rounded-lg text-terracotta font-medium text-[11px]"
                  >
                    Open scanned PDF
                  </a>
                ) : (
                  <a href={record.image_url} target="_blank" rel="noreferrer">
                    <img
                      src={record.image_url}
                      alt={record.title}
                      className="w-full rounded-lg border border-paper-300"
                    />
                  </a>
                )
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

        {checkMedsMessage && (
          <p className="text-[10.5px] text-ink-400 text-center pb-1 flex-shrink-0">{checkMedsMessage}</p>
        )}

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

          {record.image_url && (
            <button
              onClick={handleCheckForMedicines}
              disabled={isCheckingMeds}
              className="flex-1 px-3 py-1.5 bg-lavender-light text-lavender text-xs font-medium rounded-xl hover:opacity-90 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {isCheckingMeds ? <IconLoader size={13} className="animate-spin" /> : <IconPill size={13} />}
              {isCheckingMeds ? 'Checking…' : 'Check for medicines'}
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-paper-300 hover:bg-paper-400 text-ink-700 text-xs font-medium rounded-xl transition-colors flex-shrink-0"
          >
            Close
          </button>
        </div>
      </div>

      <MedicationConfirmModal
        isOpen={Boolean(pendingMeds)}
        personName={personName}
        pendingMeds={pendingMeds || []}
        onToggle={toggleMedInclude}
        onConfirm={handleConfirmMedications}
        onClose={() => setPendingMeds(null)}
      />

      <AddDoctorModal
        isOpen={isAddDoctorOpen}
        initialValues={{ name: record.doctor_name, specialty: record.specialty, clinic: record.facility }}
        onAddDoctor={(doctor) => {
          onAddDoctor(doctor);
          setIsAddDoctorOpen(false);
        }}
        onClose={() => setIsAddDoctorOpen(false)}
      />
    </div>
  );
};
