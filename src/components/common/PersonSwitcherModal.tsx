import React from 'react';
import { Person } from '../../types';
import { IconCheck, IconPlus, IconX } from '@tabler/icons-react';

interface PersonSwitcherModalProps {
  isOpen: boolean;
  people: Person[];
  currentPerson: Person;
  onSelectPerson: (person: Person) => void;
  onOpenAddMember: () => void;
  onClose: () => void;
}

export const PersonSwitcherModal: React.FC<PersonSwitcherModalProps> = ({
  isOpen,
  people,
  currentPerson,
  onSelectPerson,
  onOpenAddMember,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-ink-900/30 backdrop-blur-xs animate-fadeIn">
      {/* Backdrop tap to close */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-xs bg-white rounded-2xl shadow-modal p-2 border border-paper-300 z-10 animate-slideDown">
        <div className="flex items-center justify-between px-3 py-2 border-b border-paper-400 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 font-sans">
            Family Profiles
          </span>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-800 p-1">
            <IconX size={14} />
          </button>
        </div>

        {/* List of family members */}
        <div className="space-y-1">
          {people.map((person) => {
            const isSelected = person.id === currentPerson.id;
            return (
              <button
                key={person.id}
                onClick={() => {
                  onSelectPerson(person);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isSelected
                    ? 'bg-paper-400 text-ink-800 font-medium'
                    : 'hover:bg-paper-100 text-ink-700'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 font-medium"
                  style={{ backgroundColor: person.avatar_bg, color: person.avatar_color }}
                >
                  {person.avatar_initial}
                </div>

                <div className="flex-1 truncate">
                  <div className="text-[12.5px] leading-snug truncate">
                    {person.name}{' '}
                    {person.relationship && person.relationship !== 'Self' && (
                      <span className="text-[11px] text-ink-400 font-normal">
                        ({person.relationship.toLowerCase()})
                      </span>
                    )}
                  </div>
                  {person.species !== 'human' && (
                    <span className="text-[9.5px] text-sage font-medium tracking-wide uppercase">
                      🐾 {person.species}
                    </span>
                  )}
                </div>

                {isSelected && <IconCheck size={14} className="text-sage-muted flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="h-[1px] bg-paper-400 my-1.5 mx-1" />

        {/* Add Family Member */}
        <button
          onClick={() => {
            onClose();
            onOpenAddMember();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-paper-100 text-ink-500 hover:text-ink-800 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-paper-400 flex items-center justify-center text-ink-400">
            <IconPlus size={13} />
          </div>
          <span className="text-[12px]">Add a family member</span>
        </button>
      </div>
    </div>
  );
};
