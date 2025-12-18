'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Settings {
  anthropicApiKey: string | null;
  openaiApiKey: string | null;
  defaultLlmProvider: string;
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [defaultProvider, setDefaultProvider] = useState('anthropic');
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSettings();
    }
  }, [status]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
        setDefaultProvider(data.settings.defaultLlmProvider);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const updateData: Record<string, string | undefined> = {
        defaultLlmProvider: defaultProvider,
      };

      // Only include API keys if they were changed (not empty placeholder)
      if (anthropicKey) {
        updateData.anthropicApiKey = anthropicKey;
      }
      if (openaiKey) {
        updateData.openaiApiKey = openaiKey;
      }

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
        setAnthropicKey('');
        setOpenaiKey('');
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearKey = async (provider: 'anthropic' | 'openai') => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [provider === 'anthropic' ? 'anthropicApiKey' : 'openaiApiKey']: '',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSettings(data.settings);
        setMessage({ type: 'success', text: `${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API key cleared` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to clear API key' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear API key' });
    } finally {
      setIsSaving(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* AI Provider Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">AI Provider Settings</h2>
            <p className="mt-1 text-sm text-gray-500">
              Configure your AI providers for campaign analysis and insights
            </p>
          </div>

          <div className="px-6 py-6 space-y-6">
            {/* Default Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default AI Provider
              </label>
              <select
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value)}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai">OpenAI GPT</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                The provider to use for AI-powered features
              </p>
            </div>

            {/* Anthropic API Key */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Anthropic API Key
                </label>
                {settings?.hasAnthropicKey && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Configured
                  </span>
                )}
              </div>
              {settings?.hasAnthropicKey && (
                <p className="text-sm text-gray-500 mb-2">
                  Current key: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{settings.anthropicApiKey}</code>
                </p>
              )}
              <div className="flex gap-3">
                <div className="relative flex-1 max-w-md">
                  <input
                    type={showAnthropicKey ? 'text' : 'password'}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder={settings?.hasAnthropicKey ? 'Enter new key to update' : 'sk-ant-...'}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showAnthropicKey ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {settings?.hasAnthropicKey && (
                  <button
                    onClick={() => handleClearKey('anthropic')}
                    disabled={isSaving}
                    className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Get your API key from{' '}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  console.anthropic.com
                </a>
              </p>
            </div>

            {/* OpenAI API Key */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  OpenAI API Key
                </label>
                {settings?.hasOpenaiKey && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Configured
                  </span>
                )}
              </div>
              {settings?.hasOpenaiKey && (
                <p className="text-sm text-gray-500 mb-2">
                  Current key: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{settings.openaiApiKey}</code>
                </p>
              )}
              <div className="flex gap-3">
                <div className="relative flex-1 max-w-md">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder={settings?.hasOpenaiKey ? 'Enter new key to update' : 'sk-proj-...'}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showOpenaiKey ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {settings?.hasOpenaiKey && (
                  <button
                    onClick={() => handleClearKey('openai')}
                    disabled={isSaving}
                    className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Get your API key from{' '}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  platform.openai.com
                </a>
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-100">
          <h3 className="text-sm font-medium text-blue-800 mb-2">About AI Providers</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li><strong>Anthropic Claude:</strong> Best for nuanced analysis and detailed recommendations</li>
            <li><strong>OpenAI GPT:</strong> Fast and reliable for general insights</li>
          </ul>
          <p className="mt-3 text-sm text-blue-600">
            Your API keys are stored securely and never shared. They are only used to make requests to the respective AI services on your behalf.
          </p>
        </div>
      </main>
    </div>
  );
}
