'use client';

import { useState, useCallback, useEffect, useRef, ReactNode, createContext, useContext } from 'react';

export interface Step {
  id: string;
  title: string;
  description?: string;
  isOptional?: boolean;
  validate?: () => boolean | Promise<boolean>;
}

interface MultiStepFormContextType {
  currentStep: number;
  steps: Step[];
  isFirstStep: boolean;
  isLastStep: boolean;
  progress: number;
  goToStep: (step: number) => void;
  nextStep: () => Promise<boolean>;
  prevStep: () => void;
  canGoNext: boolean;
  setCanGoNext: (can: boolean) => void;
}

const MultiStepFormContext = createContext<MultiStepFormContextType | undefined>(undefined);

export function useMultiStepForm() {
  const context = useContext(MultiStepFormContext);
  if (!context) {
    throw new Error('useMultiStepForm must be used within a MultiStepForm');
  }
  return context;
}

interface MultiStepFormProps {
  steps: Step[];
  children: ReactNode[];
  onComplete: () => void;
  onCancel?: () => void;
  initialStep?: number;
  showProgress?: boolean;
}

export default function MultiStepForm({
  steps,
  children,
  onComplete,
  onCancel,
  initialStep = 0,
  showProgress = true,
}: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [canGoNext, setCanGoNext] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const announcementRef = useRef<HTMLDivElement>(null);
  const stepContentRef = useRef<HTMLDivElement>(null);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < steps.length) {
      setCurrentStep(step);
    }
  }, [steps.length]);

  const nextStep = useCallback(async () => {
    if (isLastStep) {
      onComplete();
      return true;
    }

    const step = steps[currentStep];
    if (step.validate) {
      setIsValidating(true);
      try {
        const isValid = await step.validate();
        if (!isValid) {
          setIsValidating(false);
          return false;
        }
      } catch {
        setIsValidating(false);
        return false;
      }
      setIsValidating(false);
    }

    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    return true;
  }, [currentStep, isLastStep, onComplete, steps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // Announce step changes for screen readers and manage focus
  useEffect(() => {
    const step = steps[currentStep];
    if (step) {
      const message = `Step ${currentStep + 1} of ${steps.length}: ${step.title}${step.description ? `. ${step.description}` : ''}`;
      setAnnouncement(message);
      // Focus the step content area for keyboard users
      setTimeout(() => {
        stepContentRef.current?.focus();
      }, 100);
    }
  }, [currentStep, steps]);

  const currentStepData = steps[currentStep];

  return (
    <MultiStepFormContext.Provider
      value={{
        currentStep,
        steps,
        isFirstStep,
        isLastStep,
        progress,
        goToStep,
        nextStep,
        prevStep,
        canGoNext,
        setCanGoNext,
      }}
    >
      {/* Screen reader announcements */}
      <div
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div className="flex flex-col h-full" role="form" aria-label="Multi-step form">
        {/* Progress Header */}
        {showProgress && (
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            {/* Progress Bar for screen readers */}
            <div
              role="progressbar"
              aria-valuenow={currentStep + 1}
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-label={`Progress: Step ${currentStep + 1} of ${steps.length}`}
              className="sr-only"
            >
              {Math.round(progress)}% complete
            </div>

            {/* Step Indicators */}
            <nav aria-label="Form steps" className="flex items-center justify-between mb-4">
              {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                const isPending = index > currentStep;

                return (
                  <div key={step.id} className="flex items-center flex-1">
                    {/* Step Circle */}
                    <button
                      onClick={() => isCompleted && goToStep(index)}
                      disabled={isPending}
                      aria-label={`${step.title}${isCompleted ? ' (completed)' : isCurrent ? ' (current step)' : ' (not yet available)'}`}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700'
                          : isCurrent
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span aria-hidden="true">{index + 1}</span>
                      )}
                    </button>

                    {/* Connector Line */}
                    {index < steps.length - 1 && (
                      <div
                        aria-hidden="true"
                        className={`flex-1 h-0.5 mx-2 ${
                          isCompleted
                            ? 'bg-blue-600'
                            : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Step Labels - hidden on mobile */}
            <div className="hidden md:flex justify-between">
              {steps.map((step, index) => (
                <div
                  key={`label-${step.id}`}
                  className={`text-center flex-1 ${
                    index === currentStep ? 'text-blue-600' : 'text-gray-500'
                  }`}
                >
                  <div className="text-sm font-medium">{step.title}</div>
                  {step.isOptional && (
                    <div className="text-xs text-gray-400">(Optional)</div>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: Current step title */}
            <div className="md:hidden text-center">
              <div className="text-sm font-medium text-gray-900">
                Step {currentStep + 1} of {steps.length}: {currentStepData.title}
              </div>
              {currentStepData.description && (
                <div className="text-xs text-gray-500 mt-1">
                  {currentStepData.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step Content */}
        <div
          ref={stepContentRef}
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-6 focus:outline-none"
          aria-labelledby={`step-heading-${currentStepData.id}`}
        >
          {/* Step Description - desktop */}
          {currentStepData.description && (
            <div className="hidden md:block mb-6">
              <h3
                id={`step-heading-${currentStepData.id}`}
                className="text-lg font-semibold text-gray-900"
              >
                {currentStepData.title}
              </h3>
              <p className="text-sm text-gray-500">
                {currentStepData.description}
              </p>
            </div>
          )}

          {/* Render current step content */}
          {children[currentStep]}
        </div>

        {/* Navigation Footer */}
        <div
          role="navigation"
          aria-label="Form navigation"
          className="border-t border-gray-200 bg-white px-6 py-4"
        >
          <div className="flex items-center justify-between">
            <div>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label="Cancel and close form"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={prevStep}
                  aria-label={`Go back to step ${currentStep}: ${steps[currentStep - 1]?.title || 'Previous'}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
              )}

              <button
                type="button"
                onClick={nextStep}
                disabled={!canGoNext || isValidating}
                aria-label={
                  isValidating
                    ? 'Validating current step'
                    : isLastStep
                    ? 'Complete the form'
                    : `Continue to step ${currentStep + 2}: ${steps[currentStep + 1]?.title || 'Next'}`
                }
                aria-busy={isValidating}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isValidating ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
                    Validating...
                  </>
                ) : isLastStep ? (
                  <>
                    Complete
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </MultiStepFormContext.Provider>
  );
}
