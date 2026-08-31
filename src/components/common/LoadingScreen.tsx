import React, { useEffect, useState } from 'react';
import { IconLoader } from '@tabler/icons-react';

interface LoadingScreenProps {
  error?: string | null;
}

// A plain spinner that never resolves looks identical to a genuinely broken app.
// After a few seconds we add a visible way out — reload, or a specific error —
// rather than leaving someone staring at a spinner with no idea whether to wait
// or give up.
export const LoadingScreen: React.FC<LoadingScreenProps> = ({ error }) => {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (error) return;
    const timer = setTimeout(() => setShowHelp(true), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div className="h-full h-[100dvh] w-full bg-[#FBFAF6] flex flex-col items-center justify-center px-6 text-center gap-3">
      {!error && <IconLoader size={24} className="animate-spin text-terracotta" />}

      {error && <p className="text-xs text-terracotta max-w-[260px] leading-relaxed">{error}</p>}

      {(showHelp || error) && (
        <div className="space-y-2">
          {!error && (
            <p className="text-[11px] text-ink-400 max-w-[240px]">
              This is taking longer than expected — could be a slow connection.
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            className="py-2 px-4 bg-paper-300 hover:bg-paper-400 text-ink-700 text-xs font-medium rounded-xl transition-colors"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
};
