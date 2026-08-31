import React, { useEffect, useState } from 'react';
import { CareTeamMember } from '../../types';
import { IconStethoscope, IconX } from '@tabler/icons-react';

interface AddDoctorModalProps {
  isOpen: boolean;
  initialValues?: { name?: string; specialty?: string; clinic?: string };
  onAddDoctor: (doctor: CareTeamMember) => void;
  onClose: () => void;
}

export const AddDoctorModal: React.FC<AddDoctorModalProps> = ({ isOpen, initialValues, onAddDoctor, onClose }) => {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [clinic, setClinic] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(initialValues?.name || '');
      setSpecialty(initialValues?.specialty || '');
      setClinic(initialValues?.clinic || '');
      setPhone('');
      setAddress('');
      setNotes('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddDoctor({
      id: `ct-${Date.now()}`,
      name: name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`,
      specialty: specialty.trim() || 'General Medicine',
      clinic: clinic.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      consent_state: 'not_asked',
    });

    setName('');
    setSpecialty('');
    setClinic('');
    setPhone('');
    setAddress('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <div className="flex items-center gap-2">
            <IconStethoscope size={18} className="text-terracotta" />
            <h3 className="font-serif text-lg text-ink-800">Add Doctor</h3>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-3 text-xs text-ink-700 pr-0.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. S. Nair"
                className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Specialty</label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Cardiology"
                className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Hospital / Clinic</label>
            <input
              type="text"
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              placeholder="e.g. Apollo Hospitals"
              className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Clinic address"
                className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Note (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Recommended by Aunt Priya"
              className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-terracotta text-white rounded-xl text-xs font-medium hover:bg-terracotta-dark active:scale-98 transition-all"
            >
              Save Doctor
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-paper-300 text-ink-600 rounded-xl text-xs font-medium hover:bg-paper-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
