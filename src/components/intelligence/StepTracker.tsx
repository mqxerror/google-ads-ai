'use client';

import { useEffect, useState } from 'react';

export interface Step {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  duration?: number; // milliseconds
  message?: string;
}

interface StepTrackerProps {
  steps: Step[];
  currentStep: string;
  progress: number;
  message?: string;
  estimatedTotal?: string;
  cost?: number;
  title?: string;
}

export const BRAND_DNA_STEPS: Omit<Step, 'status' | 'duration' | 'message'>[] = [
  {
    id: 'initializing',
    label: 'Initializing',
    description: 'Setting up analysis',
    icon: '⚡',
  },
  {
    id: 'scraping_homepage',
    label: 'Scraping Homepage',
    description: 'Extracting website content',
    icon: '🌐',
  },
  {
    id: 'scraping_about',
    label: 'Scraping About Page',
    description: 'Finding company information',
    icon: '📄',
  },
  {
    id: 'researching',
    label: 'Web Research',
    description: 'Searching for brand information',
    icon: '🔍',
  },
  {
    id: 'analyzing',
    label: 'AI Analysis',
    description: 'Processing with Claude Opus 4.5',
    icon: '🧠',
  },
  {
    id: 'generating_report',
    label: 'Generating Report',
    description: 'Creating comprehensive Brand DNA',
    icon: '📊',
  },
  {
    id: 'saving',
    label: 'Saving Results',
    description: 'Storing to database',
    icon: '💾',
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Analysis finished',
    icon: '✅',
  },
];

export const AUDIENCE_DNA_STEPS: Omit<Step, 'status' | 'duration' | 'message'>[] = [
  {
    id: 'initializing',
    label: 'Initializing',
    description: 'Preparing persona generation',
    icon: '⚡',
  },
  {
    id: 'loading_brand',
    label: 'Loading Brand DNA',
    description: 'Reading brand context',
    icon: '📖',
  },
  {
    id: 'generating',
    label: 'AI Generation',
    description: 'Creating personas with Claude Opus 4.5',
    icon: '🧠',
  },
  {
    id: 'parsing',
    label: 'Processing Results',
    description: 'Parsing persona data',
    icon: '⚙️',
  },
  {
    id: 'saving',
    label: 'Saving Personas',
    description: 'Storing to database',
    icon: '💾',
  },
  {
    id: 'completed',
    label: 'Complete',
    description: '3 personas generated',
    icon: '✅',
  },
];

export const COMPETITOR_DNA_STEPS: Omit<Step, 'status' | 'duration' | 'message'>[] = [
  {
    id: 'initializing',
    label: 'Initializing',
    description: 'Preparing competitor discovery',
    icon: '⚡',
  },
  {
    id: 'discovering',
    label: 'Discovering Competitors',
    description: 'Finding top 3 competitors',
    icon: '🔍',
  },
  {
    id: 'analyzing',
    label: 'Analyzing Intelligence',
    description: 'Deep analysis of each competitor',
    icon: '🧠',
  },
  {
    id: 'generating_report',
    label: 'Generating Report',
    description: 'Creating competitive analysis',
    icon: '📊',
  },
  {
    id: 'saving',
    label: 'Saving Results',
    description: 'Storing to database',
    icon: '💾',
  },
  {
    id: 'completed',
    label: 'Complete',
    description: '3 competitors analyzed',
    icon: '✅',
  },
];

export default function StepTracker({
  steps,
  currentStep,
  progress,
  message,
  estimatedTotal,
  cost,
  title = 'Brand DNA Analysis',
}: StepTrackerProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  // Update elapsed time
  useEffect(() => {
    if (currentStep === 'completed' || currentStep === 'failed' || currentStep === 'idle') {
      return;
    }
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [currentStep, startTime]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const isComplete = currentStep === 'completed';
  const isFailed = currentStep === 'failed';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
              isComplete ? 'bg-green-100' : isFailed ? 'bg-red-100' : 'bg-purple-100 animate-pulse'
            }`}>
              {isComplete ? '✅' : isFailed ? '❌' : '🧠'}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">
                {isComplete ? 'Analysis complete' : isFailed ? 'Analysis failed' : message || 'Processing...'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{progress}%</div>
            <div className="text-xs text-gray-500">
              {formatTime(elapsedTime)} {estimatedTotal && !isComplete && `/ ~${estimatedTotal}`}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              isComplete ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="p-6">
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isCompleted = step.status === 'completed';
              const isPending = step.status === 'pending';
              const hasFailed = step.status === 'failed';

              return (
                <div key={step.id} className="relative flex items-start gap-4">
                  {/* Step Icon */}
                  <div
                    className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-200 scale-110'
                        : isCompleted
                        ? 'bg-green-100 text-green-600'
                        : hasFailed
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isActive ? (
                      <span className="animate-pulse">{step.icon}</span>
                    ) : isCompleted ? (
                      '✓'
                    ) : hasFailed ? (
                      '✗'
                    ) : (
                      step.icon
                    )}
                  </div>

                  {/* Step Content */}
                  <div className={`flex-1 pb-4 ${index === steps.length - 1 ? 'pb-0' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4
                          className={`font-medium ${
                            isActive
                              ? 'text-purple-600'
                              : isCompleted
                              ? 'text-green-600'
                              : hasFailed
                              ? 'text-red-600'
                              : 'text-gray-400'
                          }`}
                        >
                          {step.label}
                        </h4>
                        <p className={`text-sm ${isActive || isCompleted ? 'text-gray-600' : 'text-gray-400'}`}>
                          {step.message || step.description}
                        </p>
                      </div>
                      {step.duration && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                          {formatTime(step.duration)}
                        </span>
                      )}
                    </div>

                    {/* Active Step Animation */}
                    {isActive && !isComplete && !isFailed && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-purple-500">Processing...</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      {(cost !== undefined || isComplete) && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            {cost !== undefined && (
              <span className="flex items-center gap-1">
                <span>💰</span> Cost: ${cost.toFixed(4)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <span>⏱️</span> Duration: {formatTime(elapsedTime)}
            </span>
          </div>
          {isComplete && (
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <span>✨</span> Report Ready
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to convert step status to Step array
export function buildStepsFromStatus(
  currentStep: string,
  stepsLog: Array<{ step: string; status: string; message?: string; duration_ms?: number }> = [],
  stepDefinitions: Omit<Step, 'status' | 'duration' | 'message'>[] = BRAND_DNA_STEPS
): Step[] {
  const logMap = new Map(stepsLog.map(l => [l.step, l]));

  return stepDefinitions.map(step => {
    const log = logMap.get(step.id);
    const stepIndex = stepDefinitions.findIndex(s => s.id === step.id);
    const currentIndex = stepDefinitions.findIndex(s => s.id === currentStep);

    let status: Step['status'] = 'pending';
    if (log?.status === 'failed' || currentStep === 'failed') {
      status = currentStep === step.id || log?.status === 'failed' ? 'failed' : stepIndex < currentIndex ? 'completed' : 'pending';
    } else if (step.id === currentStep) {
      status = 'active';
    } else if (stepIndex < currentIndex || currentStep === 'completed') {
      status = 'completed';
    }

    return {
      ...step,
      status,
      duration: log?.duration_ms,
      message: log?.message,
    };
  });
}

// Calculate progress percentage
export function calculateProgress(
  currentStep: string,
  stepDefinitions: Omit<Step, 'status' | 'duration' | 'message'>[] = BRAND_DNA_STEPS
): number {
  if (currentStep === 'idle' || currentStep === 'pending') return 0;
  if (currentStep === 'completed') return 100;
  if (currentStep === 'failed') return 0;

  const stepIndex = stepDefinitions.findIndex(s => s.id === currentStep);
  if (stepIndex === -1) return 0;

  return Math.round((stepIndex / (stepDefinitions.length - 1)) * 100);
}
