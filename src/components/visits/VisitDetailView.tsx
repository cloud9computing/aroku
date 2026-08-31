import React, { useMemo, useState } from 'react';
import { Person, Question, Visit, Medication, DocumentRecord } from '../../types';
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconPencil,
  IconPrinter,
  IconShare,
  IconTrash,
} from '@tabler/icons-react';
import { LiveAudioConsultRecorder } from './LiveAudioConsultRecorder';
import { computeFactTrends } from '../../utils/factTrends';
import { TrendDisplay } from '../common/TrendDisplay';

interface VisitDetailViewProps {
  familyId: string;
  visit: Visit;
  person: Person;
  medications: Medication[];
  records: DocumentRecord[];
  onBack: () => void;
  onUpdateVisit: (visit: Visit) => void;
  onDeleteVisit: (visitId: string) => void;
}

export const VisitDetailView: React.FC<VisitDetailViewProps> = ({
  familyId,
  visit,
  person,
  medications,
  records,
  onBack,
  onUpdateVisit,
  onDeleteVisit,
}) => {
  // Question editing state
  const [questions, setQuestions] = useState<Question[]>(visit.questions || []);
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copied, setCopied] = useState(false);

  const trends = useMemo(() => computeFactTrends(records).slice(0, 4), [records]);

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

  const handleSaveConsultRecap = (recap: {
    what_happened: string;
    decisions: string[];
    answers_captured: string[];
    audio_url?: string;
    full_transcript?: string;
  }) => {
    onUpdateVisit({
      ...visit,
      past_recap: recap,
    });
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

  return (
    <div className="flex flex-col flex-1 pb-4">
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
      <div className="px-4 pt-3.5 flex-1 overflow-y-auto space-y-3.5">
        {/* Doctor & Date Header */}
        <div>
          <h2 className="font-serif text-[17.5px] text-ink-800 leading-tight">
            {visit.doctor_name} · {visit.specialty}
          </h2>
          <p className="text-[11px] text-ink-400 mt-0.5">
            {visit.date_display} · {visit.time} · {visit.location}
          </p>
        </div>

        {/* Live Audio Consultation Recording Module */}
        <LiveAudioConsultRecorder
          familyId={familyId}
          visitId={visit.id}
          doctorName={visit.doctor_name}
          specialty={visit.specialty}
          consentState={visit.consent_state}
          onSaveRecap={handleSaveConsultRecap}
        />

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
    </div>
  );
};
