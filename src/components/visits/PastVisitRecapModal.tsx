import React from 'react';
import { Visit } from '../../types';
import { IconCalendar, IconCheck, IconTrash, IconX } from '@tabler/icons-react';

interface PastVisitRecapModalProps {
  visit: Visit | null;
  isOpen: boolean;
  onDeleteVisit: (visitId: string) => void;
  onClose: () => void;
}

export const PastVisitRecapModal: React.FC<PastVisitRecapModalProps> = ({ visit, isOpen, onDeleteVisit, onClose }) => {
  if (!isOpen || !visit) return null;

  const handleDelete = () => {
    if (window.confirm(`Delete this past visit with ${visit.doctor_name}? This removes its recap and any recording, for everyone in the family. This can't be undone.`)) {
      onDeleteVisit(visit.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="bg-paper-50 rounded-2xl w-full max-w-sm border border-paper-300 shadow-modal p-5 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-paper-300">
          <div>
            <span className="text-[9.5px] uppercase tracking-wider text-terracotta font-semibold">
              Past Visit Recap · {visit.date_display}
            </span>
            <h3 className="font-serif text-lg text-ink-800 leading-tight mt-0.5">
              {visit.doctor_name}
            </h3>
            <p className="text-[11px] text-ink-400">{visit.specialty} · {visit.location}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 text-xs text-ink-700">
          {visit.past_recap ? (
            <>
              {visit.past_recap.audio_url && (
                <div className="bg-white border border-paper-300 rounded-xl p-3 space-y-1.5">
                  <p className="text-[9.5px] uppercase tracking-wider text-ink-400 font-semibold">
                    Consultation Recording
                  </p>
                  <audio controls src={visit.past_recap.audio_url} className="w-full h-8" />
                </div>
              )}

              <div className="bg-white border border-paper-300 rounded-xl p-3 space-y-1">
                <p className="text-[9.5px] uppercase tracking-wider text-ink-400 font-semibold">
                  What Happened & Reasoned
                </p>
                <p className="text-xs text-ink-800 leading-relaxed font-serif">
                  {visit.past_recap.what_happened}
                </p>
              </div>

              {visit.past_recap.decisions && visit.past_recap.decisions.length > 0 && (
                <div className="bg-white border border-paper-300 rounded-xl p-3 space-y-1.5">
                  <p className="text-[9.5px] uppercase tracking-wider text-sage font-semibold">
                    Clinical Decisions & Changes
                  </p>
                  <ul className="space-y-1">
                    {visit.past_recap.decisions.map((dec, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-ink-800">
                        <IconCheck size={13} className="text-sage mt-0.5 flex-shrink-0" />
                        <span>{dec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {visit.past_recap.answers_captured && visit.past_recap.answers_captured.length > 0 && (
                <div className="bg-white border border-paper-300 rounded-xl p-3 space-y-1.5">
                  <p className="text-[9.5px] uppercase tracking-wider text-terracotta font-semibold">
                    Doctor Instructions & Advice
                  </p>
                  <ul className="space-y-1">
                    {visit.past_recap.answers_captured.map((ans, i) => (
                      <li key={i} className="text-xs text-ink-700 leading-relaxed">
                        • {ans}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {visit.past_recap.full_transcript && (
                <details className="bg-white border border-paper-300 rounded-xl p-3">
                  <summary className="text-[9.5px] uppercase tracking-wider text-ink-400 font-semibold cursor-pointer">
                    Full transcript
                  </summary>
                  <p className="text-[11px] text-ink-600 leading-relaxed mt-1.5 whitespace-pre-wrap">
                    {visit.past_recap.full_transcript}
                  </p>
                </details>
              )}
            </>
          ) : (
            <p className="text-center py-8 text-ink-400">No structured recap saved for this visit.</p>
          )}
        </div>

        <div className="pt-3 border-t border-paper-300 flex justify-between items-center">
          <button
            onClick={handleDelete}
            className="p-2 text-ink-300 hover:text-terracotta hover:bg-terracotta-light/40 rounded-xl transition-colors"
            title="Delete this visit"
            aria-label="Delete visit"
          >
            <IconTrash size={16} />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-paper-300 hover:bg-paper-400 text-ink-700 text-xs font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
