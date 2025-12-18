'use client';

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading?: boolean;
  /** Optional message to display */
  message?: string;
  /** Overlay opacity (0-100) */
  opacity?: number;
  /** Whether to show a spinner */
  showSpinner?: boolean;
}

export default function LoadingOverlay({
  isLoading = true,
  message,
  opacity = 60,
  showSpinner = true,
}: LoadingOverlayProps) {
  if (!isLoading) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200"
      style={{ backgroundColor: `rgba(255, 255, 255, ${opacity / 100})` }}
    >
      <div className="flex flex-col items-center gap-3">
        {showSpinner && (
          <div className="relative">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
          </div>
        )}
        {message && (
          <p className="text-sm font-medium text-slate-600">{message}</p>
        )}
      </div>
    </div>
  );
}
