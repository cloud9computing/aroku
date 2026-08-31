import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AssistantResponse, ChatMessage, ProposedVisit, ProposedMedication, ProposedMedicationUpdate } from '../../services/assistantEngine';
import { Person, Visit, Medication, DocumentRecord, TimeOfDay, FoodRelation } from '../../types';
import {
  findExistingActiveMedication,
  findActiveMedicationsByMolecule,
  sameMoleculeAndStrength,
  normalize,
} from '../../utils/duplicateMedication';
import { computeFactTrends, findFactTrend } from '../../utils/factTrends';
import { TrendDisplay } from '../common/TrendDisplay';
import { medicineDisplayName } from '../../utils/medicineName';
import {
  IconArrowUp,
  IconCheck,
  IconLoader,
  IconPencil,
  IconSparkles,
  IconX,
} from '@tabler/icons-react';

interface AssistantDrawerProps {
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading?: boolean;
  currentPerson: Person;
  medications: Medication[];
  records: DocumentRecord[];
  onSubmitQuery: (query: string) => void;
  onConfirmAddVisit: (visit: Visit) => void;
  onConfirmAddMedication: (medication: Medication) => void;
  onConfirmUpdateMedication: (medication: Medication) => void;
  onClose: () => void;
}

interface PendingChatMedication {
  proposed: ProposedMedication;
  include: boolean;
  isDuplicate?: boolean;
}

const FOOD_RELATION_LABELS: Record<FoodRelation, string> = {
  before_food: 'Before food',
  after_food: 'After food',
  with_food: 'With food',
  either: 'Either',
};

export const AssistantDrawer: React.FC<AssistantDrawerProps> = ({
  isOpen,
  messages,
  isLoading = false,
  currentPerson,
  medications,
  records,
  onSubmitQuery,
  onConfirmAddVisit,
  onConfirmAddMedication,
  onConfirmUpdateMedication,
  onClose,
}) => {
  const [editingField, setEditingField] = useState<{ msgId: string; field: string } | null>(null);
  const [visitDrafts, setVisitDrafts] = useState<Record<string, ProposedVisit>>({});
  const [medicationDrafts, setMedicationDrafts] = useState<Record<string, ProposedMedication>>({});
  const [medicationListDrafts, setMedicationListDrafts] = useState<Record<string, PendingChatMedication[]>>({});
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const trends = useMemo(() => computeFactTrends(records), [records]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

  if (!isOpen) return null;

  const getVisitDraft = (msg: ChatMessage): ProposedVisit | undefined =>
    visitDrafts[msg.id] ?? msg.response?.proposedVisit;

  const getMedicationDraft = (msg: ChatMessage): ProposedMedication | undefined =>
    medicationDrafts[msg.id] ?? msg.response?.proposedMedication;

  const getMedicationListDraft = (msg: ChatMessage): PendingChatMedication[] => {
    if (medicationListDrafts[msg.id]) return medicationListDrafts[msg.id];
    const proposed = msg.response?.proposedMedications || [];
    const built: PendingChatMedication[] = [];
    for (const p of proposed) {
      const isDuplicate =
        Boolean(findExistingActiveMedication(medications, p)) ||
        built.some((b) => sameMoleculeAndStrength(b.proposed, p));
      built.push({ proposed: p, include: !isDuplicate, isDuplicate });
    }
    return built;
  };

  const toggleListMedInclude = (msg: ChatMessage, idx: number) => {
    const current = getMedicationListDraft(msg);
    setMedicationListDrafts((prev) => ({
      ...prev,
      [msg.id]: current.map((m, i) => (i === idx ? { ...m, include: !m.include } : m)),
    }));
  };

  const handleSaveMedicationList = (msg: ChatMessage) => {
    const list = getMedicationListDraft(msg);
    for (const { proposed, include } of list) {
      if (!include) continue;
      onConfirmAddMedication({
        id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        person_id: currentPerson.id,
        molecule: proposed.molecule,
        brand_name: proposed.brand_name,
        strength: proposed.strength,
        time_of_day: proposed.time_of_day,
        food_relation: proposed.food_relation,
        prescriber_name: proposed.prescriber_name || 'Self-reported',
        prescriber_specialty: proposed.prescriber_specialty || 'Not specified',
        prescribed_date: proposed.start_date_iso,
        status: 'active',
        notes: proposed.notes,
      });
    }
    setConfirmedIds((prev) => new Set(prev).add(msg.id));
  };

  // Resolves an update request against the real medicine list rather than
  // trusting an id the assistant can't actually know — this is the fix for
  // "update the dose" creating a duplicate instead of editing the existing
  // entry. Returns the matched medication, 'ambiguous' if more than one
  // active entry shares that molecule and the strength hint didn't
  // disambiguate, or null if nothing matches at all.
  const resolveMedicationUpdate = (update: ProposedMedicationUpdate): Medication | 'ambiguous' | null => {
    const candidates = findActiveMedicationsByMolecule(medications, update.molecule);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    if (update.current_strength) {
      const match = candidates.find((c) => normalize(c.strength) === normalize(update.current_strength!));
      if (match) return match;
    }
    return 'ambiguous';
  };

  const handleConfirmMedicationUpdate = (msg: ChatMessage, existing: Medication, update: ProposedMedicationUpdate) => {
    onConfirmUpdateMedication({
      ...existing,
      strength: update.new_strength || existing.strength,
      time_of_day: update.new_time_of_day || existing.time_of_day,
      food_relation: update.new_food_relation || existing.food_relation,
    });
    setConfirmedIds((prev) => new Set(prev).add(msg.id));
  };

  const handleSaveVisit = (msg: ChatMessage) => {
    const draft = getVisitDraft(msg);
    if (!draft) return;
    const visitId = `vis-${Date.now()}`;
    const newVisit: Visit = {
      id: visitId,
      person_id: currentPerson.id,
      doctor_name: draft.doctor_name,
      specialty: draft.specialty,
      date: draft.date_iso,
      date_display: draft.date_display.split('·')[0].trim(),
      time: draft.time,
      location: draft.location,
      is_upcoming: true,
      reason: draft.reason,
      consent_state: 'ok',
      brief_status: 'Not prepped yet',
      questions: [
        {
          id: `q-${Date.now()}-1`,
          visit_id: visitId,
          text: `Review recent changes and progress for ${draft.reason || 'condition'}.`,
          status: 'kept',
        },
      ],
    };
    onConfirmAddVisit(newVisit);
    setConfirmedIds((prev) => new Set(prev).add(msg.id));
  };

  const toggleMedTime = (msg: ChatMessage, t: TimeOfDay) => {
    const draft = getMedicationDraft(msg);
    if (!draft) return;
    const has = draft.time_of_day.includes(t);
    const next = has ? draft.time_of_day.filter((x) => x !== t) : [...draft.time_of_day, t];
    if (next.length > 0) setMedicationDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, time_of_day: next } }));
  };

  const handleSaveMedication = (msg: ChatMessage) => {
    const draft = getMedicationDraft(msg);
    if (!draft) return;

    const existing = findExistingActiveMedication(medications, draft);
    if (existing && !window.confirm(`${currentPerson.name} already has an active ${existing.molecule} ${existing.strength}. Add this as a separate entry anyway?`)) {
      return;
    }

    onConfirmAddMedication({
      id: `med-${Date.now()}`,
      person_id: currentPerson.id,
      molecule: draft.molecule,
      brand_name: draft.brand_name,
      strength: draft.strength,
      time_of_day: draft.time_of_day,
      food_relation: draft.food_relation,
      prescriber_name: draft.prescriber_name || 'Self-reported',
      prescriber_specialty: draft.prescriber_specialty || 'Not specified',
      prescribed_date: draft.start_date_iso,
      status: 'active',
      notes: draft.notes,
    });
    setConfirmedIds((prev) => new Set(prev).add(msg.id));
  };

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;
    onSubmitQuery(trimmed);
    setInputText('');
  };

  const renderDraftCard = (msg: ChatMessage, response: AssistantResponse) => {
    const isConfirmed = confirmedIds.has(msg.id);
    const isDismissed = dismissedIds.has(msg.id);
    if (isDismissed) return null;

    if (response.type === 'visit_draft') {
      const draft = getVisitDraft(msg);
      if (!draft) return null;
      if (isConfirmed) {
        return (
          <p className="ml-7 text-[10.5px] text-sage flex items-center gap-1">
            <IconCheck size={12} /> Added to visits
          </p>
        );
      }
      return (
        <div className="ml-7 space-y-3">
          <div className="bg-paper-50 border border-paper-500 rounded-xl p-3 shadow-xs space-y-2.5">
            <div className="flex justify-between items-start pb-2 border-b border-paper-400">
              <div className="flex-1">
                <p className="text-[9px] uppercase tracking-wider text-ink-400">Doctor</p>
                {editingField?.msgId === msg.id && editingField.field === 'doctor' ? (
                  <input
                    type="text"
                    value={draft.doctor_name}
                    onChange={(e) => setVisitDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, doctor_name: e.target.value } }))}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    className="w-full text-xs font-medium text-ink-800 bg-white border border-paper-300 rounded px-1.5 py-1 mt-0.5"
                  />
                ) : (
                  <p className="text-[12px] font-medium text-ink-800">
                    {draft.doctor_name} · {draft.specialty}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditingField({ msgId: msg.id, field: 'doctor' })}
                className="text-ink-300 hover:text-ink-700 p-1"
              >
                <IconPencil size={13} />
              </button>
            </div>

            <div className="flex justify-between items-start pb-2 border-b border-paper-400">
              <div className="flex-1">
                <p className="text-[9px] uppercase tracking-wider text-ink-400">Date & Time</p>
                {editingField?.msgId === msg.id && editingField.field === 'datetime' ? (
                  <input
                    type="text"
                    value={draft.date_display}
                    onChange={(e) => setVisitDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, date_display: e.target.value } }))}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    placeholder="Thu, 3 Sep · 4:30 PM"
                    className="w-full text-xs text-ink-800 bg-white border border-paper-300 rounded px-1.5 py-1 mt-0.5"
                  />
                ) : (
                  <p className="text-[12px] text-ink-800">{draft.date_display}</p>
                )}
              </div>
              <button
                onClick={() => setEditingField({ msgId: msg.id, field: 'datetime' })}
                className="text-ink-300 hover:text-ink-700 p-1"
              >
                <IconPencil size={13} />
              </button>
            </div>

            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-[9px] uppercase tracking-wider text-ink-400">Reason</p>
                {editingField?.msgId === msg.id && editingField.field === 'reason' ? (
                  <input
                    type="text"
                    value={draft.reason}
                    onChange={(e) => setVisitDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, reason: e.target.value } }))}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    className="w-full text-xs text-ink-800 bg-white border border-paper-300 rounded px-1.5 py-1 mt-0.5"
                  />
                ) : (
                  <p className="text-[11px] text-ink-700">{draft.reason || 'Not set — add one?'}</p>
                )}
              </div>
              <button
                onClick={() => setEditingField({ msgId: msg.id, field: 'reason' })}
                className="text-ink-300 hover:text-ink-700 p-1"
              >
                <IconPencil size={13} />
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSaveVisit(msg)}
              className="flex-1 py-2.5 bg-terracotta-light text-terracotta font-medium rounded-xl hover:opacity-90 active:scale-98 transition-all"
            >
              Add to visits
            </button>
            <button
              onClick={() => setDismissedIds((prev) => new Set(prev).add(msg.id))}
              className="px-4 py-2.5 border border-paper-500 text-ink-400 hover:text-ink-700 rounded-xl transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      );
    }

    if (response.type === 'qa_answer') {
      const trend = response.trend_fact_name ? findFactTrend(trends, response.trend_fact_name) : undefined;

      // A real trend (2+ verified readings, computed from the actual fact
      // store) is more trustworthy than whatever citations the model picked,
      // so it takes priority when available.
      if (trend) {
        return (
          <div className="ml-7 space-y-1.5">
            <p className="text-[9.5px] uppercase tracking-wider text-ink-400 font-medium">{trend.name}</p>
            <div className="bg-white border border-paper-300 rounded-xl p-2.5 shadow-2xs">
              <TrendDisplay trend={trend} variant="full" />
            </div>
          </div>
        );
      }

      if (response.factCitations && response.factCitations.length > 0) {
        return (
          <div className="ml-7 space-y-1.5">
            <p className="text-[9.5px] uppercase tracking-wider text-ink-400 font-medium">Verified Provenance Links</p>
            {response.factCitations.map((cite, idx) => (
              <div
                key={idx}
                className="bg-white border border-paper-300 rounded-xl p-2.5 flex items-center justify-between shadow-2xs"
              >
                <div>
                  <p className="text-[11px] font-medium text-ink-800">
                    {cite.fact_name}: {cite.value}
                  </p>
                  <p className="text-[9.5px] text-ink-400">
                    {cite.title} · {cite.date}
                  </p>
                </div>
                <div className="w-4 h-4 rounded-full bg-sage-light text-sage flex items-center justify-center flex-shrink-0">
                  <IconCheck size={11} />
                </div>
              </div>
            ))}
          </div>
        );
      }

      return null;
    }

    if (response.type === 'note_draft' && response.proposedNote) {
      if (isConfirmed) {
        return (
          <p className="ml-7 text-[10.5px] text-sage flex items-center gap-1">
            <IconCheck size={12} /> Attached to appointment prep
          </p>
        );
      }
      return (
        <div className="ml-7 space-y-3">
          <div className="bg-white border border-paper-400 rounded-xl p-3 space-y-1.5 shadow-2xs">
            <p className="text-[9.5px] uppercase tracking-wider text-ink-400">Draft Clinical Note</p>
            <p className="text-xs text-ink-800 font-serif italic">&ldquo;{response.proposedNote.note_text}&rdquo;</p>
            {response.proposedNote.target_doctor && (
              <p className="text-[10px] text-terracotta">Target: {response.proposedNote.target_doctor}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmedIds((prev) => new Set(prev).add(msg.id))}
              className="flex-1 py-2 bg-terracotta-light text-terracotta font-medium rounded-xl text-center"
            >
              Attach to Brief
            </button>
            <button
              onClick={() => setDismissedIds((prev) => new Set(prev).add(msg.id))}
              className="px-3 py-2 border border-paper-400 text-ink-400 rounded-xl"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    if (response.type === 'medication_draft') {
      const draft = getMedicationDraft(msg);
      if (!draft) return null;
      if (isConfirmed) {
        return (
          <p className="ml-7 text-[10.5px] text-sage flex items-center gap-1">
            <IconCheck size={12} /> Added to medicines
          </p>
        );
      }
      return (
        <div className="ml-7 space-y-3">
          <div className="bg-white border border-paper-400 rounded-xl p-3 space-y-2.5 shadow-2xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Medicine</label>
                <input
                  type="text"
                  value={draft.molecule}
                  onChange={(e) => setMedicationDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, molecule: e.target.value } }))}
                  className="w-full px-2 py-1.5 bg-paper-50 border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Strength</label>
                <input
                  type="text"
                  value={draft.strength}
                  onChange={(e) => setMedicationDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, strength: e.target.value } }))}
                  className="w-full px-2 py-1.5 bg-paper-50 border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none focus:border-terracotta"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Time of day</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['morning', 'afternoon', 'evening', 'night'] as TimeOfDay[]).map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => toggleMedTime(msg, time)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] capitalize font-medium border transition-all ${
                      draft.time_of_day.includes(time)
                        ? 'bg-paper-800 text-white border-paper-800'
                        : 'bg-paper-50 text-ink-600 border-paper-300'
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Food relation</label>
                <select
                  value={draft.food_relation}
                  onChange={(e) =>
                    setMedicationDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, food_relation: e.target.value as FoodRelation } }))
                  }
                  className="w-full px-2 py-1.5 bg-paper-50 border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none"
                >
                  {(Object.keys(FOOD_RELATION_LABELS) as FoodRelation[]).map((fr) => (
                    <option key={fr} value={fr}>
                      {FOOD_RELATION_LABELS[fr]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Starting from</label>
                <input
                  type="date"
                  value={draft.start_date_iso}
                  onChange={(e) => setMedicationDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, start_date_iso: e.target.value } }))}
                  className="w-full px-2 py-1.5 bg-paper-50 border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">
                Prescribing doctor (optional)
              </label>
              <input
                type="text"
                value={draft.prescriber_name || ''}
                onChange={(e) => setMedicationDrafts((prev) => ({ ...prev, [msg.id]: { ...draft, prescriber_name: e.target.value } }))}
                placeholder="Not specified"
                className="w-full px-2 py-1.5 bg-paper-50 border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none focus:border-terracotta"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleSaveMedication(msg)}
              className="flex-1 py-2.5 bg-terracotta-light text-terracotta font-medium rounded-xl hover:opacity-90 active:scale-98 transition-all"
            >
              Add to medicines
            </button>
            <button
              onClick={() => setDismissedIds((prev) => new Set(prev).add(msg.id))}
              className="px-4 py-2.5 border border-paper-500 text-ink-400 hover:text-ink-700 rounded-xl transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      );
    }

    if (response.type === 'medication_list_draft') {
      const list = getMedicationListDraft(msg);
      if (list.length === 0) return null;
      const includedCount = list.filter((m) => m.include).length;

      if (isConfirmed) {
        return (
          <p className="ml-7 text-[10.5px] text-sage flex items-center gap-1">
            <IconCheck size={12} /> Added to medicines
          </p>
        );
      }

      return (
        <div className="ml-7 space-y-3">
          <div className="space-y-1.5">
            {list.map((pm, idx) => {
              const { primary, secondary } = medicineDisplayName(pm.proposed);
              return (
              <button
                key={idx}
                onClick={() => toggleListMedInclude(msg, idx)}
                className={`w-full text-left p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                  pm.include ? 'bg-white border-paper-400' : 'bg-paper-300/50 border-paper-300 opacity-60'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${
                    pm.include ? 'bg-terracotta text-white' : 'border border-ink-300 bg-white'
                  }`}
                >
                  {pm.include && <IconCheck size={11} />}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-ink-800 flex items-center gap-1.5 flex-wrap">
                    {primary} {pm.proposed.strength}
                    {secondary && <span className="text-ink-400 font-normal italic">{secondary}</span>}
                    {pm.isDuplicate && (
                      <span className="text-[9px] text-ochre bg-ochre-light/60 px-1.5 py-0.5 rounded-md font-normal normal-case tracking-normal">
                        Already in Medicines
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-ink-400 mt-0.5">
                    {pm.proposed.time_of_day.join(', ')} · {pm.proposed.food_relation.replace('_', ' ')}
                  </p>
                </div>
              </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSaveMedicationList(msg)}
              disabled={includedCount === 0}
              className="flex-1 py-2.5 bg-terracotta-light text-terracotta font-medium rounded-xl hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
            >
              Add {includedCount || ''} to medicines
            </button>
            <button
              onClick={() => setDismissedIds((prev) => new Set(prev).add(msg.id))}
              className="px-4 py-2.5 border border-paper-500 text-ink-400 hover:text-ink-700 rounded-xl transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      );
    }

    if (response.type === 'medication_update_draft' && response.medicationUpdate) {
      const update = response.medicationUpdate;

      if (isConfirmed) {
        return (
          <p className="ml-7 text-[10.5px] text-sage flex items-center gap-1">
            <IconCheck size={12} /> Updated in medicines
          </p>
        );
      }

      const resolved = resolveMedicationUpdate(update);

      if (resolved === null) {
        return (
          <p className="ml-7 text-[10.5px] text-terracotta">
            Couldn&apos;t find an active &ldquo;{update.molecule}&rdquo; to update — check the spelling, or ask me to
            add it as a new medicine instead.
          </p>
        );
      }

      if (resolved === 'ambiguous') {
        return (
          <p className="ml-7 text-[10.5px] text-terracotta">
            There&apos;s more than one active {update.molecule} entry and I&apos;m not sure which one you mean —
            please update it directly from the Medicines tab instead.
          </p>
        );
      }

      const changes: string[] = [];
      if (update.new_strength && update.new_strength !== resolved.strength) {
        changes.push(`${resolved.strength} → ${update.new_strength}`);
      }
      if (update.new_time_of_day) changes.push(`timing → ${update.new_time_of_day.join(', ')}`);
      if (update.new_food_relation) changes.push(update.new_food_relation.replace('_', ' '));

      return (
        <div className="ml-7 space-y-3">
          <div className="bg-white border border-paper-400 rounded-xl p-3 space-y-1.5 shadow-2xs">
            <p className="text-[9.5px] uppercase tracking-wider text-ink-400">
              Update {resolved.molecule}
              {resolved.brand_name ? ` (${resolved.brand_name})` : ''}
            </p>
            <p className="text-xs text-ink-800 font-serif">{changes.join(' · ') || 'No changes specified'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleConfirmMedicationUpdate(msg, resolved, update)}
              disabled={changes.length === 0}
              className="flex-1 py-2.5 bg-terracotta-light text-terracotta font-medium rounded-xl hover:opacity-90 active:scale-98 transition-all disabled:opacity-50"
            >
              Update medicine
            </button>
            <button
              onClick={() => setDismissedIds((prev) => new Set(prev).add(msg.id))}
              className="px-4 py-2.5 border border-paper-500 text-ink-400 hover:text-ink-700 rounded-xl transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[85dvh] h-[85dvh] md:h-[600px] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium"
              style={{ backgroundColor: currentPerson.avatar_bg, color: currentPerson.avatar_color }}
            >
              {currentPerson.avatar_initial}
            </div>
            <span className="text-[13px] font-medium text-ink-800">{currentPerson.name}</span>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs pr-0.5">
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <div key={msg.id} className="flex justify-end">
                <p className="bg-paper-300 text-ink-800 px-3.5 py-2 rounded-2xl rounded-tr-xs max-w-[85%] leading-relaxed">
                  {msg.text}
                </p>
              </div>
            ) : (
              <div key={msg.id} className="space-y-2.5">
                <div className="flex gap-2 items-start">
                  <div className="w-5 h-5 rounded-full bg-lavender-light text-lavender flex items-center justify-center flex-shrink-0 mt-0.5">
                    <IconSparkles size={12} />
                  </div>
                  <p className="text-ink-700 leading-relaxed text-[12px]">{msg.text}</p>
                </div>
                {msg.response && renderDraftCard(msg, msg.response)}
              </div>
            )
          )}

          {isLoading && (
            <div className="flex gap-2 items-center text-ink-500 py-1">
              <div className="w-5 h-5 rounded-full bg-lavender-light text-lavender flex items-center justify-center animate-spin">
                <IconLoader size={12} />
              </div>
              <span className="text-xs text-lavender font-medium">Thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Follow-up input — keeps the conversation going without closing the drawer */}
        <div className="flex-shrink-0 pt-2 border-t border-paper-300">
          <div className="flex items-center gap-2 bg-paper-400 rounded-full p-1 shadow-inner border border-paper-300">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a follow-up..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-[11.5px] text-ink-800 placeholder:text-ink-300 focus:outline-none px-2.5 py-1.5 disabled:opacity-60"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                inputText.trim() && !isLoading
                  ? 'bg-lavender text-white hover:opacity-90 active:scale-90'
                  : 'bg-lavender-light text-lavender/60 cursor-default'
              }`}
              aria-label="Send follow-up"
            >
              <IconArrowUp size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
