'use client';

import { useState, useRef, useEffect } from 'react';
import { MentionSuggestion } from '@/types/comments';
import { usePermissions } from '@/contexts/PermissionsContext';

interface CommentInputProps {
  onSubmit: (content: string, mentions: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
  isSubmitting?: boolean;
  onCancel?: () => void;
  initialValue?: string;
}

export default function CommentInput({
  onSubmit,
  placeholder = 'Add a comment...',
  autoFocus = false,
  isSubmitting = false,
  onCancel,
  initialValue = '',
}: CommentInputProps) {
  const { currentUser } = usePermissions();
  const [content, setContent] = useState(initialValue);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mock mention suggestions - in real app, fetch from API
  const mentionSuggestions: MentionSuggestion[] = [
    { id: '1', name: 'Admin User', email: 'admin@company.com' },
    { id: '2', name: 'Marketing Manager', email: 'manager@company.com' },
    { id: '3', name: 'Data Analyst', email: 'analyst@company.com' },
  ];

  const filteredSuggestions = mentionSuggestions.filter(
    (user) =>
      user.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    // Check for @ mention trigger
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);
      // Only show mentions if there's no space after @
      if (!textAfterAt.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionPosition(lastAtSymbol);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleMentionSelect = (user: MentionSuggestion) => {
    const beforeMention = content.slice(0, mentionPosition);
    const afterMention = content.slice(mentionPosition + mentionQuery.length + 1);
    const newContent = `${beforeMention}@${user.name} ${afterMention}`;

    setContent(newContent);
    setMentions([...mentions, user.id]);
    setShowMentions(false);
    setMentionQuery('');

    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || isSubmitting) {
      return;
    }

    onSubmit(content.trim(), mentions);
    setContent('');
    setMentions([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* User Avatar */}
      <div className="flex gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-medium text-white">
          {currentUser?.name?.[0]?.toUpperCase() || '?'}
        </div>

        <div className="flex-1">
          {/* Textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isSubmitting}
              className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50"
              rows={2}
            />

            {/* Mention Suggestions */}
            {showMentions && filteredSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredSuggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleMentionSelect(user)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-xs text-white">
                      {user.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Use @ to mention team members • {content.length > 0 && `${content.length} characters`}
            </p>
            <div className="flex gap-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="rounded-lg px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!content.trim() || isSubmitting}
                className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Posting...
                  </span>
                ) : (
                  'Comment'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
