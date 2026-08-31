import React, { useState, useRef } from 'react';
import { IconArrowUp, IconCamera } from '@tabler/icons-react';

interface AssistantBarProps {
  onOpenCapture: () => void;
  onSubmitQuery: (query: string) => void;
}

export const AssistantBar: React.FC<AssistantBarProps> = ({ onOpenCapture, onSubmitQuery }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      onSubmitQuery(input.trim());
      setInput('');
    }
  };

  const handleSend = () => {
    if (input.trim()) {
      onSubmitQuery(input.trim());
      setInput('');
    }
  };

  const handleFocus = () => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  return (
    <div className="bg-paper-50 px-3.5 py-2 select-none border-t border-paper-300">
      <div className="flex items-center gap-2 bg-paper-400 rounded-full p-1 shadow-inner border border-paper-300">
        {/* Camera Capture Trigger */}
        <button
          type="button"
          onClick={onOpenCapture}
          className="w-7 h-7 rounded-full bg-terracotta-light flex items-center justify-center text-terracotta hover:opacity-90 active:scale-90 transition-all flex-shrink-0"
          title="Scan or capture medical document"
          aria-label="Capture document"
        >
          <IconCamera size={15} />
        </button>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="Ask, or tell me something new…"
          className="flex-1 bg-transparent text-[11.5px] text-ink-800 placeholder:text-ink-300 focus:outline-none px-1 py-0.5"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim()}
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
            input.trim()
              ? 'bg-lavender text-white hover:opacity-90 active:scale-90'
              : 'bg-lavender-light text-lavender/60 cursor-default'
          }`}
          aria-label="Send query"
        >
          <IconArrowUp size={13} />
        </button>
      </div>
    </div>
  );
};
