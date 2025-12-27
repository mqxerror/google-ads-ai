'use client';

interface TrackSuccessModalProps {
  isOpen: boolean;
  keywordCount: number;
  onClose: () => void;
  onViewDashboard: () => void;
}

export default function TrackSuccessModal({
  isOpen,
  keywordCount,
  onClose,
  onViewDashboard,
}: TrackSuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full border border-divider shadow-2xl">
        {/* Success Icon */}
        <div className="px-6 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-text mb-2">Keywords Added!</h2>
          <p className="text-text3 mb-6">
            {keywordCount} keyword{keywordCount !== 1 ? 's' : ''} added to SERP Intelligence tracking
          </p>

          {/* What's Next */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm font-medium text-text mb-2">What's Next?</p>
            <ul className="text-xs text-text3 space-y-2">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Visit the SERP Intelligence dashboard to check positions</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Daily checks will automatically track position changes</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>AI will analyze SERP data and suggest PPC opportunities</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-surface2 hover:bg-divider text-text rounded-xl font-medium transition-colors"
            >
              Continue Here
            </button>
            <button
              onClick={onViewDashboard}
              className="flex-1 px-4 py-3 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>View Dashboard</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
