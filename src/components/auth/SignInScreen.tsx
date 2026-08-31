import React, { useState } from 'react';
import { signInWithGoogle } from '../../firebase/auth';
import { IconHeartHandshake } from '@tabler/icons-react';

export const SignInScreen: React.FC = () => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setError('Sign-in did not complete. Please try again.');
      setIsSigningIn(false);
    }
  };

  return (
    <div className="h-full h-[100dvh] w-full bg-[#FBFAF6] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-terracotta-light text-terracotta flex items-center justify-center mb-4 shadow-2xs">
        <IconHeartHandshake size={28} />
      </div>
      <h1 className="font-serif text-2xl text-ink-800 mb-1.5">aroku</h1>
      <p className="text-xs text-ink-500 max-w-[280px] leading-relaxed mb-8">
        Sign in with the Google account you share with your family to see everyone&apos;s records, medicines, and
        visits, kept in sync across all your devices.
      </p>

      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="w-full max-w-[280px] py-3 px-4 bg-ink-900 text-white rounded-xl text-sm font-medium hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3C33.7 32 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.1-5.1C33.9 6 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l5.9 4.3C13.7 15.5 18.5 12 24 12c3.1 0 5.9 1.2 8 3.1l5.1-5.1C33.9 6 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.4-5.1l-6.2-5.2C29.2 35.5 26.7 36.4 24 36.4c-5.3 0-9.7-3.4-11.3-8.1l-6.1 4.7C9.5 39.6 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.8 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
        </svg>
        {isSigningIn ? 'Signing in…' : 'Continue with Google'}
      </button>

      {error && <p className="text-[11px] text-terracotta mt-3">{error}</p>}

      <p className="text-[10px] text-ink-300 mt-8 max-w-[260px] leading-relaxed">
        Only people you invite into your family space can see this data.
      </p>
    </div>
  );
};
