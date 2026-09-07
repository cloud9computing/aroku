import React, { useEffect, useState } from 'react';
import { DocumentRecord, DocumentType } from '../../types';
import { monthYearFromDate } from '../../utils/recordDate';
import { IconCalendarEvent, IconFlask, IconRadioactive, IconX } from '@tabler/icons-react';

interface RescheduleTestModalProps {
  isOpen: boolean;
  record: DocumentRecord | null;
  onUpdateRecord: (record: DocumentRecord) => void;
  onClose: () => void;
}

const TYPE_OPTIONS: { value: DocumentType; label: string; icon: React.ReactNode }[] = [
  { value: 'lab', label: 'Lab test', icon: <IconFlask size={13} /> },
  { value: 'imaging', label: 'Imaging', icon: <IconRadioactive size={13} /> },
];

export const RescheduleTestModal: React.FC<RescheduleTestModalProps> = ({ isOpen, record, onUpdateRecord, onClose }) => {
  const [testName, setTestName] = useState('');
  const [date, setDate] = useState('');
  const [docType, setDocType] = useState<DocumentType>('lab');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!record) return;
    setTestName(record.title);
    setDate(record.date);
    setDocType(record.doc_type);
    setNotes(record.subtitle === 'Scheduled — no report yet' ? '' : record.subtitle);
  }, [record?.id]);

  if (!isOpen || !record) return null;

  const canSave = testName.trim().length > 0 && date.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onUpdateRecord({
      ...record,
      doc_type: docType,
      title: testName.trim(),
      date,
      month_year: monthYearFromDate(date),
      subtitle: notes.trim() || 'Scheduled — no report yet',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-terracotta-light text-terracotta flex items-center justify-center">
              <IconCalendarEvent size={16} />
            </div>
            <div>
              <h3 className="font-serif text-lg text-ink-800 leading-tight">Reschedule Test</h3>
              <p className="text-[10px] text-ink-400">Updates this reminder card in Records</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="py-3 space-y-3 text-xs overflow-y-auto pr-0.5 flex-1">
          <div>
            <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Test name</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-2.5 py-2 bg-white border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none focus:border-terracotta"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2.5 py-2 bg-white border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none focus:border-terracotta"
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Type</label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDocType(opt.value)}
                  className={`flex-1 py-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                    docType === opt.value ? 'bg-terracotta text-white' : 'bg-white border border-paper-300 text-ink-600'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-ink-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Fasting required, ordered by Dr. Rao"
              rows={2}
              className="w-full px-2.5 py-2 bg-white border border-paper-300 rounded-lg text-xs text-ink-800 focus:outline-none focus:border-terracotta resize-none"
            />
          </div>
        </div>

        <div className="pt-2.5 border-t border-paper-300 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full py-2.5 bg-terracotta text-white text-xs font-medium rounded-xl hover:bg-terracotta-dark active:scale-98 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            Save new date
          </button>
        </div>
      </div>
    </div>
  );
};
