import React from 'react';

export type EmptyStateColor = 'terracotta' | 'sage' | 'ochre' | 'lavender';

interface EmptyStateProps {
  icon: React.ReactNode;
  color: EmptyStateColor;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}

// Shared first-run guidance for every tab that can start out empty for a
// brand-new person — same layout and tone everywhere, so the only thing that
// changes tab to tab is what's actually different: the icon, the accent, and
// the instructions for that specific kind of data.
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, color, title, description, ctaLabel, onCta }) => {
  const iconClasses: Record<EmptyStateColor, string> = {
    terracotta: 'bg-terracotta-light text-terracotta',
    sage: 'bg-sage-light text-sage',
    ochre: 'bg-ochre-light text-ochre',
    lavender: 'bg-lavender-light text-lavender',
  };
  const ctaClasses: Record<EmptyStateColor, string> = {
    terracotta: 'bg-terracotta-light text-terracotta hover:opacity-90',
    sage: 'bg-sage-light text-sage hover:opacity-90',
    ochre: 'bg-ochre-light text-ochre hover:opacity-90',
    lavender: 'bg-lavender-light text-lavender hover:opacity-90',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-10 select-none">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${iconClasses[color]}`}>
        {icon}
      </div>
      <h3 className="font-serif text-lg text-ink-800 mb-1.5">{title}</h3>
      <p className="text-xs text-ink-400 max-w-[240px] leading-relaxed">{description}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className={`mt-5 px-4 py-2 text-xs font-medium rounded-xl active:scale-95 transition-all ${ctaClasses[color]}`}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
};
