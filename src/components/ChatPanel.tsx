'use client';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatPanel({ isOpen, onClose }: ChatPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-gray-200 bg-white shadow-xl sm:w-96">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span className="font-medium text-gray-900">AI Assistant</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Chat content placeholder */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-900">AI Chat Coming Soon</h3>
        <p className="text-sm text-gray-500">
          Ask questions about your campaigns, get optimization suggestions, and receive AI-powered insights.
        </p>
      </div>

      {/* Input placeholder */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2">
          <input
            type="text"
            placeholder="Ask about your campaigns..."
            className="flex-1 bg-transparent text-sm outline-none"
            disabled
          />
          <button
            className="rounded-lg bg-blue-600 p-1.5 text-white opacity-50"
            disabled
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
