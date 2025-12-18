'use client';

import { useState, useEffect, useCallback } from 'react';

interface LLMSettings {
  provider: 'anthropic' | 'openai';
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiModel: string;
}

interface LLMProviderSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance of speed and capability' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable, best for complex tasks' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest, most cost-effective' },
];

const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest multimodal model, fast and capable' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High quality, good for complex analysis' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
];

export default function LLMProviderSettings({ isOpen, onClose }: LLMProviderSettingsProps) {
  const [settings, setSettings] = useState<LLMSettings>({
    provider: 'anthropic',
    anthropicApiKey: '',
    anthropicModel: 'claude-3-5-sonnet-20241022',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState<'anthropic' | 'openai' | null>(null);

  // Handle Escape key to close dialog
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, handleEscape]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            provider: data.settings.llmProvider || 'anthropic',
            anthropicApiKey: data.settings.anthropicApiKey || '',
            anthropicModel: data.settings.anthropicModel || 'claude-3-5-sonnet-20241022',
            openaiApiKey: data.settings.openaiApiKey || '',
            openaiModel: data.settings.openaiModel || 'gpt-4o',
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llmProvider: settings.provider,
          anthropicApiKey: settings.anthropicApiKey || null,
          anthropicModel: settings.anthropicModel,
          openaiApiKey: settings.openaiApiKey || null,
          openaiModel: settings.openaiModel,
        }),
      });

      if (response.ok) {
        onClose();
      } else {
        const data = await response.json();
        setTestResult({ success: false, message: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setTestResult({ success: false, message: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.provider === 'anthropic' ? settings.anthropicApiKey : settings.openaiApiKey,
          model: settings.provider === 'anthropic' ? settings.anthropicModel : settings.openaiModel,
        }),
      });

      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.success ? 'Connection successful!' : data.error || 'Connection failed',
      });
    } catch (error) {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const maskApiKey = (key: string) => {
    if (!key) return '';
    if (key.length < 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  if (!isOpen) return null;

  const currentApiKey = settings.provider === 'anthropic' ? settings.anthropicApiKey : settings.openaiApiKey;
  const models = settings.provider === 'anthropic' ? ANTHROPIC_MODELS : OPENAI_MODELS;
  const currentModel = settings.provider === 'anthropic' ? settings.anthropicModel : settings.openaiModel;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div
        role="dialog"
        aria-labelledby="settings-title"
        aria-describedby="settings-description"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h2 id="settings-title" className="text-lg font-semibold text-gray-900">AI Provider Settings</h2>
            <p id="settings-description" className="text-sm text-gray-500">
              Configure your AI/LLM provider
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings panel"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Provider Selection */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-3">
              AI Provider
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 ${
                  settings.provider === 'anthropic'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="anthropic"
                  checked={settings.provider === 'anthropic'}
                  onChange={() => setSettings(prev => ({ ...prev, provider: 'anthropic' }))}
                  className="sr-only"
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                  <span className="text-2xl" aria-hidden="true">🔶</span>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-900">Anthropic</div>
                  <div className="text-xs text-gray-500">Claude Models</div>
                </div>
              </label>

              <label
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 ${
                  settings.provider === 'openai'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={settings.provider === 'openai'}
                  onChange={() => setSettings(prev => ({ ...prev, provider: 'openai' }))}
                  className="sr-only"
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <span className="text-2xl" aria-hidden="true">🟢</span>
                </div>
                <div className="text-center">
                  <div className="font-medium text-gray-900">OpenAI</div>
                  <div className="text-xs text-gray-500">GPT Models</div>
                </div>
              </label>
            </div>
          </fieldset>

          {/* API Key */}
          <div>
            <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 mb-2">
              {settings.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showApiKey === settings.provider ? 'text' : 'password'}
                value={showApiKey === settings.provider ? currentApiKey : maskApiKey(currentApiKey)}
                onChange={e => {
                  const key = settings.provider === 'anthropic' ? 'anthropicApiKey' : 'openaiApiKey';
                  setSettings(prev => ({ ...prev, [key]: e.target.value }));
                }}
                onFocus={() => setShowApiKey(settings.provider)}
                onBlur={() => setShowApiKey(null)}
                placeholder={settings.provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
                aria-describedby="api-key-help"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(showApiKey === settings.provider ? null : settings.provider)}
                aria-label={showApiKey === settings.provider ? 'Hide API key' : 'Show API key'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                {showApiKey === settings.provider ? (
                  <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p id="api-key-help" className="mt-1.5 text-xs text-gray-500">
              {settings.provider === 'anthropic'
                ? 'Get your API key from console.anthropic.com'
                : 'Get your API key from platform.openai.com'}
            </p>
          </div>

          {/* Model Selection */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 mb-2">
              Model
            </legend>
            <div className="space-y-2" role="radiogroup" aria-label="Select AI model">
              {models.map(model => (
                <label
                  key={model.id}
                  className={`w-full flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-500 ${
                    currentModel === model.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={currentModel === model.id}
                    onChange={() => {
                      const key = settings.provider === 'anthropic' ? 'anthropicModel' : 'openaiModel';
                      setSettings(prev => ({ ...prev, [key]: model.id }));
                    }}
                    className="sr-only"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{model.name}</div>
                    <div className="text-xs text-gray-500">{model.description}</div>
                  </div>
                  {currentModel === model.id && (
                    <svg className="h-5 w-5 text-blue-500" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Test Connection */}
          <div>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={!currentApiKey || isTesting}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isTesting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Testing...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Test Connection
                </>
              )}
            </button>

            {testResult && (
              <div
                role="status"
                aria-live="polite"
                className={`mt-3 rounded-lg p-3 text-sm ${
                  testResult.success
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {testResult.message}
                </div>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex gap-3">
              <svg className="h-5 w-5 text-blue-600 shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">About API Keys</p>
                <p className="mt-1 text-blue-700">
                  Your API keys are encrypted and stored securely. They are never exposed to the client and are only used server-side for AI requests.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </>
  );
}
