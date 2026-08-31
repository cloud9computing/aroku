import React, { useState } from 'react';
import { Person, Species } from '../../types';
import { IconPaw, IconUser, IconX } from '@tabler/icons-react';

interface AddPersonModalProps {
  isOpen: boolean;
  onAddPerson: (person: Person) => void;
  onClose: () => void;
}

export const AddPersonModal: React.FC<AddPersonModalProps> = ({ isOpen, onAddPerson, onClose }) => {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('Parent');
  const [species, setSpecies] = useState<Species>('human');
  const [sex, setSex] = useState<'M' | 'F' | 'Other'>('M');
  const [age, setAge] = useState<number>(65);
  const [conditions, setConditions] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const initials = species === 'dog' ? '🐾' : species === 'cat' ? '🐱' : name.trim().charAt(0).toUpperCase();
    const colors = [
      { bg: '#E3D9EE', color: '#7A5FA0' },
      { bg: '#F3E9E3', color: '#8A6352' },
      { bg: '#EDF0E6', color: '#6B7E5C' },
      { bg: '#F8F1E2', color: '#C9A05C' },
    ];
    const chosenColor = colors[Math.floor(Math.random() * colors.length)];

    const newPerson: Person = {
      id: `p-${Date.now()}`,
      name: name.trim(),
      relationship: species === 'human' ? relationship : `Pet ${species}`,
      species,
      sex: species === 'human' ? sex : undefined,
      age: age ? Number(age) : undefined,
      avatar_initial: initials,
      avatar_bg: chosenColor.bg,
      avatar_color: chosenColor.color,
      active_conditions: conditions
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    };

    onAddPerson(newPerson);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-ink-900/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-paper-50 rounded-t-[26px] md:rounded-2xl border-t md:border border-paper-300 shadow-modal p-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] max-h-[88dvh] flex flex-col z-10 animate-sheet-up">
        <div className="w-10 h-1 bg-paper-600 rounded-full mx-auto mb-2 md:hidden" />

        <div className="flex items-center justify-between pb-2.5 border-b border-paper-300 flex-shrink-0">
          <h3 className="font-serif text-lg text-ink-800">Add Family Member</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-800 p-1">
            <IconX size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-3 text-left text-ink-700 pr-0.5">
          {/* Species Picker */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSpecies('human')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs border transition-all ${
                  species === 'human'
                    ? 'bg-terracotta text-white border-terracotta'
                    : 'bg-white border-paper-300 text-ink-600'
                }`}
              >
                <IconUser size={14} /> Human
              </button>
              <button
                type="button"
                onClick={() => setSpecies('dog')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs border transition-all ${
                  species === 'dog'
                    ? 'bg-sage text-white border-sage'
                    : 'bg-white border-paper-300 text-ink-600'
                }`}
              >
                <IconPaw size={14} /> Dog
              </button>
              <button
                type="button"
                onClick={() => setSpecies('cat')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs border transition-all ${
                  species === 'cat'
                    ? 'bg-sage text-white border-sage'
                    : 'bg-white border-paper-300 text-ink-600'
                }`}
              >
                <IconPaw size={14} /> Cat
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">
              {species === 'human' ? 'Full Name' : 'Pet Name'}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={species === 'human' ? 'e.g. Ramesh Kumar' : 'e.g. Bruno'}
              className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none focus:border-terracotta"
            />
          </div>

          {species === 'human' ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Relationship</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Self">Self</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Child">Child</option>
                    <option value="Relative">Relative</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">Age (Years)</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none"
              />
            </div>
          )}

          {/* Conditions */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-ink-400 mb-1">
              Known Conditions (comma-separated)
            </label>
            <input
              type="text"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="e.g. Diabetes, Hypertension, Carotid"
              className="w-full px-3 py-2 bg-white border border-paper-300 rounded-xl text-xs text-ink-800 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-terracotta text-white rounded-xl text-xs font-medium hover:bg-terracotta-dark active:scale-98 transition-all"
            >
              Add Profile
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
