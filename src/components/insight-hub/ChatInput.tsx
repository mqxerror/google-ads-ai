'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { SUGGESTED_PROMPTS } from '@/hooks/useInsightChat';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  showSuggestions?: boolean;
}

export function ChatInput({
  onSend,
  isLoading = false,
  disabled = false,
  placeholder = 'Ask anything about your marketing data...',
  showSuggestions = true,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading && !disabled) {
      onSend(input.trim());
      setInput('');
      setShowSuggestionsDropdown(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestionsDropdown(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      {/* Suggestions */}
      {showSuggestions && input.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="text-xs text-gray-400">Try:</span>
          {SUGGESTED_PROMPTS.slice(0, 3).map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-full transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestionsDropdown(true)}
            onBlur={() => setTimeout(() => setShowSuggestionsDropdown(false), 200)}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className={`
              w-full px-4 py-3 pr-12
              bg-gray-50 border border-gray-200 rounded-xl
              text-sm text-gray-700 placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:bg-gray-100 disabled:cursor-not-allowed
              resize-none transition-all
            `}
          />

          {/* Character count */}
          {input.length > 0 && (
            <span className="absolute right-3 bottom-3 text-[10px] text-gray-400">
              {input.length}/2000
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading || disabled}
          className={`
            shrink-0 w-10 h-10 rounded-xl
            flex items-center justify-center
            transition-all duration-200
            ${input.trim() && !isLoading && !disabled
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isLoading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Hints */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>Powered by Claude AI</span>
      </div>
    </div>
  );
}
