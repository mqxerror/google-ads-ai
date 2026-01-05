'use client';

import React, { useState } from 'react';
import { UTM_TEMPLATES, generateUtmUrl, applyUtmTemplate, type UtmTemplate } from '@/constants/utm';

interface UtmBuilderProps {
  baseUrl: string;
  onUrlChange: (fullUrl: string) => void;
  campaignName?: string;
  defaultSource?: string;
  showToggle?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Reusable UTM parameter builder component
 * Use in: Search, PMax, Display, Demand Gen, Video campaigns
 */
export function UtmBuilder({
  baseUrl,
  onUrlChange,
  campaignName = '',
  showToggle = true,
  defaultOpen = false,
  className = '',
}: UtmBuilderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customParams, setCustomParams] = useState<Record<string, string>>({});

  // Check if URL has UTM params
  const hasUtmParams = (): boolean => {
    if (!baseUrl) return false;
    try {
      const url = new URL(baseUrl);
      return url.searchParams.has('utm_source') || url.searchParams.has('utm_campaign');
    } catch {
      return false;
    }
  };

  // Get current UTM params from URL
  const getCurrentUtmParams = (): Array<[string, string]> => {
    if (!baseUrl) return [];
    try {
      const url = new URL(baseUrl);
      return Array.from(url.searchParams.entries()).filter(([key]) =>
        key.startsWith('utm_')
      );
    } catch {
      return [];
    }
  };

  // Apply a template to the URL
  const applyTemplate = (templateId: string) => {
    const template = UTM_TEMPLATES.find((t) => t.id === templateId);
    if (!template || !baseUrl) return;

    try {
      // Get base URL without existing UTM params
      const url = new URL(baseUrl);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_matchtype'].forEach(
        (param) => url.searchParams.delete(param)
      );
      const cleanUrl = url.toString().replace(/\?$/, '');

      // Apply template with campaign name substitution
      const utmParams = applyUtmTemplate(template, campaignName);
      const newUrl = generateUtmUrl(cleanUrl, utmParams);
      onUrlChange(newUrl);
      setSelectedTemplateId(templateId);
    } catch {
      // Invalid URL, do nothing
    }
  };

  // Remove all UTM params
  const removeUtmParams = () => {
    if (!baseUrl) return;
    try {
      const url = new URL(baseUrl);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_matchtype'].forEach(
        (param) => url.searchParams.delete(param)
      );
      onUrlChange(url.toString().replace(/\?$/, ''));
      setSelectedTemplateId(null);
    } catch {
      // Invalid URL, do nothing
    }
  };

  // Update a single custom UTM param
  const updateCustomParam = (key: string, value: string) => {
    const newParams = { ...customParams, [key]: value };
    setCustomParams(newParams);

    // Apply to URL if we have a base URL
    if (baseUrl) {
      try {
        const url = new URL(baseUrl);
        if (value) {
          url.searchParams.set(key, value);
        } else {
          url.searchParams.delete(key);
        }
        onUrlChange(url.toString());
      } catch {
        // Invalid URL
      }
    }
  };

  const hasParams = hasUtmParams();
  const currentParams = getCurrentUtmParams();

  // Toggle button for compact mode
  if (showToggle) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors ${
            isOpen || hasParams
              ? 'bg-accent/10 text-accent'
              : 'bg-surface2 text-text3 hover:text-accent hover:bg-accent/10'
          }`}
        >
          <span>🔗</span>
          <span>{hasParams ? 'UTM Added' : 'Add UTM Tracking'}</span>
        </button>

        {isOpen && (
          <div className="mt-3 bg-surface2 border border-divider rounded-lg p-4 animate-fade-in">
            <UtmBuilderContent
              baseUrl={baseUrl}
              hasParams={hasParams}
              currentParams={currentParams}
              selectedTemplateId={selectedTemplateId}
              onApplyTemplate={applyTemplate}
              onRemoveParams={removeUtmParams}
              onUpdateCustomParam={updateCustomParam}
            />
          </div>
        )}
      </div>
    );
  }

  // Full panel mode (no toggle)
  return (
    <div className={`bg-surface2 border border-divider rounded-lg p-4 ${className}`}>
      <UtmBuilderContent
        baseUrl={baseUrl}
        hasParams={hasParams}
        currentParams={currentParams}
        selectedTemplateId={selectedTemplateId}
        onApplyTemplate={applyTemplate}
        onRemoveParams={removeUtmParams}
        onUpdateCustomParam={updateCustomParam}
      />
    </div>
  );
}

// Internal component for the builder content
interface UtmBuilderContentProps {
  baseUrl: string;
  hasParams: boolean;
  currentParams: Array<[string, string]>;
  selectedTemplateId: string | null;
  onApplyTemplate: (templateId: string) => void;
  onRemoveParams: () => void;
  onUpdateCustomParam: (key: string, value: string) => void;
}

function UtmBuilderContent({
  baseUrl,
  hasParams,
  currentParams,
  selectedTemplateId,
  onApplyTemplate,
  onRemoveParams,
}: UtmBuilderContentProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔗</span>
          <span className="font-medium text-text text-sm">Smart UTM Builder</span>
        </div>
        {hasParams && (
          <button
            type="button"
            onClick={onRemoveParams}
            className="text-xs text-danger hover:text-danger/80 transition-colors"
          >
            Remove UTM
          </button>
        )}
      </div>

      {!baseUrl ? (
        <p className="text-xs text-text3 italic">
          Enter a landing page URL first to add UTM parameters
        </p>
      ) : (
        <>
          {/* Template Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {UTM_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onApplyTemplate(template.id)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  selectedTemplateId === template.id
                    ? 'border-accent bg-accent/10'
                    : 'border-divider bg-surface hover:border-accent/50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{template.icon}</span>
                  <span className="font-medium text-text text-xs">{template.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Current UTM Preview */}
          {hasParams && (
            <div className="bg-surface rounded-lg p-3 border border-divider">
              <div className="text-xs text-text3 mb-2 font-medium">Generated URL Preview:</div>
              <div className="text-xs text-text font-mono break-all bg-bg p-2 rounded border border-divider">
                {baseUrl}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {currentParams.map(([key, value]) => (
                  <span
                    key={key}
                    className="px-2 py-0.5 bg-accent/10 text-accent text-[10px] rounded-full"
                  >
                    {key}={value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Info about ValueTrack */}
          <div className="mt-3 p-2.5 bg-accent/5 rounded-lg border border-accent/20">
            <p className="text-xs text-text3 flex items-start gap-2">
              <span>💡</span>
              <span>
                <strong className="text-text">Pro tip:</strong> Parameters like{' '}
                <code className="text-accent">{'{keyword}'}</code> and{' '}
                <code className="text-accent">{'{matchtype}'}</code> are Google ValueTrack
                parameters - they get replaced with actual values when your ad is shown.
              </span>
            </p>
          </div>
        </>
      )}
    </>
  );
}

export default UtmBuilder;
