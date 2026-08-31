import React, { useState } from 'react';
import { UserProfile } from '../../firebase/auth';
import { createFamily, joinFamilyWithCode } from '../../firebase/family';
import { signOutCurrentUser } from '../../firebase/auth';
import { IconUsers } from '@tabler/icons-react';

interface FamilyOnboardingProps {
  user: UserProfile;
  onFamilyReady: (familyId: string) => void;
}

export const FamilyOnboarding: React.FC<FamilyOnboardingProps> = ({ user, onFamilyReady }) => {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [familyName, setFamilyName] = useState(`${user.displayName.split(' ')[0]}'s family`);
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const familyId = await createFamily(user, familyName.trim());
      onFamilyReady(familyId);
    } catch (err) {
      console.error(err);
      setError('Could not create your family space. Try again.');
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const familyId = await joinFamilyWithCode(user, inviteCode);
      onFamilyReady(familyId);
    } catch (err: any) {
      setError(err?.message || 'Could not join with that code.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full h-[100dvh] w-full bg-[#FBFAF6] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-lavender-light text-lavender flex items-center justify-center mb-4 shadow-2xs">
        <IconUsers size={26} />
      </div>
      <h1 className="font-serif text-xl text-ink-800 mb-1.5">Welcome, {user.displayName.split(' ')[0]}</h1>
      <p className="text-xs text-ink-500 max-w-[280px] leading-relaxed mb-6">
        You&apos;re not part of a family space yet. Create one, or join one someone else already started.
      </p>

      <div className="w-full max-w-[300px] space-y-3">
        {mode === 'choose' && (
          <>
            <button
              onClick={() => setMode('create')}
              className="w-full py-3 px-4 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta-dark active:scale-98 transition-all"
            >
              Create a new family
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-3 px-4 bg-paper-300 text-ink-700 rounded-xl text-sm font-medium hover:bg-paper-400 active:scale-98 transition-all"
            >
              Join with an invite code
            </button>
          </>
        )}

        {mode === 'create' && (
          <>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              placeholder="Family name"
              className="w-full px-3 py-2.5 bg-white border border-paper-300 rounded-xl text-sm text-ink-800 focus:outline-none focus:border-terracotta text-center"
            />
            <button
              onClick={handleCreate}
              disabled={isSubmitting || !familyName.trim()}
              className="w-full py-3 px-4 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta-dark active:scale-98 transition-all disabled:opacity-60"
            >
              {isSubmitting ? 'Creating…' : 'Create family'}
            </button>
            <button onClick={() => setMode('choose')} className="text-xs text-ink-400 hover:text-ink-700">
              Back
            </button>
          </>
        )}

        {mode === 'join' && (
          <>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="6-letter invite code"
              maxLength={6}
              className="w-full px-3 py-2.5 bg-white border border-paper-300 rounded-xl text-sm text-ink-800 tracking-[0.3em] text-center font-mono focus:outline-none focus:border-terracotta"
            />
            <button
              onClick={handleJoin}
              disabled={isSubmitting || inviteCode.trim().length < 6}
              className="w-full py-3 px-4 bg-terracotta text-white rounded-xl text-sm font-medium hover:bg-terracotta-dark active:scale-98 transition-all disabled:opacity-60"
            >
              {isSubmitting ? 'Joining…' : 'Join family'}
            </button>
            <button onClick={() => setMode('choose')} className="text-xs text-ink-400 hover:text-ink-700">
              Back
            </button>
          </>
        )}

        {error && <p className="text-[11px] text-terracotta">{error}</p>}
      </div>

      <button onClick={() => signOutCurrentUser()} className="text-[11px] text-ink-300 hover:text-ink-600 mt-8">
        Sign out
      </button>
    </div>
  );
};
