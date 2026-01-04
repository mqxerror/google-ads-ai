'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface ApiKeyConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    type: 'text' | 'password';
  }[];
  docsUrl: string;
  features: string[];
}

// Available Anthropic models for ad generation
const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Most capable, best quality output', tier: 'premium' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Balanced performance and speed', tier: 'standard' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Fast and cost-effective', tier: 'standard' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest, lowest cost', tier: 'budget' },
] as const;

const API_CONFIGS: ApiKeyConfig[] = [
  {
    id: 'moz',
    name: 'Moz API',
    description: 'Domain authority, page authority, spam score, and search intent',
    icon: '🔗',
    fields: [
      { key: 'moz_api_token', label: 'API Token', placeholder: 'Your Moz API token', type: 'password' },
    ],
    docsUrl: 'https://moz.com/help/links-api',
    features: ['Domain Authority (DA)', 'Page Authority (PA)', 'Spam Score', 'Search Intent', 'Link Metrics'],
  },
  {
    id: 'dataforseo',
    name: 'DataForSEO',
    description: 'Keyword data, SERP analysis, and intent classification',
    icon: '📊',
    fields: [
      { key: 'dataforseo_login', label: 'Login Email', placeholder: 'your@email.com', type: 'text' },
      { key: 'dataforseo_password', label: 'API Password', placeholder: 'Your API password', type: 'password' },
    ],
    docsUrl: 'https://dataforseo.com/apis',
    features: ['Search Intent Classification', 'Keyword Difficulty', 'Search Volume', 'SERP Analysis'],
  },
  {
    id: 'semrush',
    name: 'SEMrush API',
    description: 'Comprehensive keyword and competitor data',
    icon: '🔍',
    fields: [
      { key: 'semrush_api_key', label: 'API Key', placeholder: 'Your SEMrush API key', type: 'password' },
    ],
    docsUrl: 'https://www.semrush.com/api-documentation/',
    features: ['Keyword Analytics', 'Competitor Analysis', 'Backlink Data', 'Traffic Analytics'],
  },
  {
    id: 'openai',
    name: 'OpenAI API',
    description: 'AI-powered analysis with GPT and embeddings',
    icon: '🤖',
    fields: [
      { key: 'openai_api_key', label: 'API Key', placeholder: 'sk-...', type: 'password' },
    ],
    docsUrl: 'https://platform.openai.com/api-keys',
    features: ['Embeddings (text-embedding-3-small)', 'GPT-4 Analysis', 'Content Generation'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Advanced AI analysis with Claude',
    icon: '🧠',
    fields: [
      { key: 'anthropic_api_key', label: 'API Key', placeholder: 'sk-ant-...', type: 'password' },
    ],
    docsUrl: 'https://console.anthropic.com/',
    features: ['Intent Analysis', 'Keyword Validation', 'Pattern Discovery', 'Context Understanding'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek API',
    description: 'Ultra-low-cost AI analysis (~10x cheaper than GPT)',
    icon: '🚀',
    fields: [
      { key: 'deepseek_api_key', label: 'API Key', placeholder: 'sk-...', type: 'password' },
    ],
    docsUrl: 'https://platform.deepseek.com/',
    features: ['Intent Analysis', 'Keyword Classification', '10x Cheaper than GPT', 'Fast Inference'],
  },
];

export default function ApiKeysSettingsPage() {
  const { data: session, status } = useSession();
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [testingApi, setTestingApi] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ api: string; success: boolean; message: string } | null>(null);
  const [selectedAnthropicModel, setSelectedAnthropicModel] = useState('claude-sonnet-4-20250514');

  const isAuthenticated = status === 'authenticated' && session?.user;

  useEffect(() => {
    if (isAuthenticated) {
      loadApiKeys();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  async function loadApiKeys() {
    try {
      const res = await fetch('/api/settings/api-keys');
      const data = await res.json();
      if (data.keys) {
        setApiKeys(data.keys);
        // Load saved model preference
        if (data.keys.anthropic_model) {
          setSelectedAnthropicModel(data.keys.anthropic_model);
        }
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  }

  async function saveAnthropicModel(modelId: string) {
    setSaving('anthropic-model');
    setSavedMessage(null);
    setSelectedAnthropicModel(modelId);

    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'anthropic_model', value: modelId }),
      });

      const data = await res.json();
      if (data.success) {
        setApiKeys(prev => ({ ...prev, anthropic_model: modelId }));
        const modelName = ANTHROPIC_MODELS.find(m => m.id === modelId)?.name || modelId;
        setSavedMessage(`Model changed to ${modelName}`);
        setTimeout(() => setSavedMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving model preference:', error);
    } finally {
      setSaving(null);
    }
  }

  async function saveApiKey(apiId: string, fieldKey: string, value: string) {
    setSaving(`${apiId}-${fieldKey}`);
    setSavedMessage(null);

    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: fieldKey, value }),
      });

      const data = await res.json();
      if (data.success) {
        setApiKeys(prev => ({ ...prev, [fieldKey]: value }));
        setSavedMessage(`${fieldKey} saved successfully`);
        setTimeout(() => setSavedMessage(null), 3000);
      }
    } catch (error) {
      console.error('Error saving API key:', error);
    } finally {
      setSaving(null);
    }
  }

  async function testApiConnection(apiId: string) {
    setTestingApi(apiId);
    setTestResult(null);

    try {
      const res = await fetch('/api/settings/api-keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId }),
      });

      const data = await res.json();
      setTestResult({
        api: apiId,
        success: data.success,
        message: data.message || (data.success ? 'Connection successful!' : 'Connection failed'),
      });
    } catch (error) {
      setTestResult({
        api: apiId,
        success: false,
        message: 'Test failed - check your API keys',
      });
    } finally {
      setTestingApi(null);
    }
  }

  function maskValue(value: string): string {
    if (!value || value.length < 8) return value;
    return value.slice(0, 4) + '•'.repeat(value.length - 8) + value.slice(-4);
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text mb-2">API Settings</h1>
          <p className="text-text2 mb-6">Sign in to manage your API keys</p>
          <Link href="/login" className="btn-primary">Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <header className="bg-surface border-b border-divider">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-text2 hover:text-text transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-text">API Settings</h1>
              <p className="text-xs text-text3">Configure external API integrations</p>
            </div>
          </div>
        </div>
      </header>

      {/* Success Message */}
      {savedMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg bg-success text-white">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm font-medium">{savedMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mx-auto mb-2" />
            <p className="text-text3">Loading settings...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="card p-4 bg-accent-light border border-accent/20">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-accent mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-text">API Keys are stored securely</p>
                  <p className="text-xs text-text2 mt-1">
                    Keys are encrypted and stored in your account. They are never exposed in the browser after saving.
                  </p>
                </div>
              </div>
            </div>

            {/* AI Model Preferences */}
            <div className="card">
              <div className="p-6 border-b border-divider">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h3 className="font-semibold text-text">AI Model Preferences</h3>
                    <p className="text-sm text-text2">Choose the AI model for ad generation</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <label className="block text-sm font-medium text-text mb-3">
                  Anthropic Claude Model for Ad Generation
                </label>
                <div className="space-y-2">
                  {ANTHROPIC_MODELS.map(model => (
                    <label
                      key={model.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedAnthropicModel === model.id
                          ? 'border-accent bg-accent/5'
                          : 'border-divider hover:border-accent/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="anthropic-model"
                        value={model.id}
                        checked={selectedAnthropicModel === model.id}
                        onChange={() => saveAnthropicModel(model.id)}
                        className="w-4 h-4 text-accent focus:ring-accent"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text">{model.name}</span>
                          {model.tier === 'premium' && (
                            <span className="px-1.5 py-0.5 bg-warning/20 text-warning text-[10px] font-medium rounded">
                              PREMIUM
                            </span>
                          )}
                          {model.tier === 'budget' && (
                            <span className="px-1.5 py-0.5 bg-success/20 text-success text-[10px] font-medium rounded">
                              BUDGET
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text3 mt-0.5">{model.description}</p>
                      </div>
                      {saving === 'anthropic-model' && selectedAnthropicModel === model.id && (
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-text3 mt-3">
                  Higher-tier models produce better quality ad copy but cost more per request.
                </p>
              </div>
            </div>

            {/* API Configurations */}
            {API_CONFIGS.map(config => (
              <div key={config.id} className="card">
                <div className="p-6 border-b border-divider">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{config.icon}</span>
                      <div>
                        <h3 className="font-semibold text-text">{config.name}</h3>
                        <p className="text-sm text-text2">{config.description}</p>
                      </div>
                    </div>
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent hover:underline flex items-center gap-1"
                    >
                      Docs
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {config.features.map(feature => (
                      <span key={feature} className="px-2 py-1 bg-surface2 text-text3 text-xs rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {config.fields.map(field => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-text mb-2">
                        {field.label}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={field.type}
                          placeholder={field.placeholder}
                          defaultValue={apiKeys[field.key] || ''}
                          onBlur={(e) => {
                            if (e.target.value !== apiKeys[field.key]) {
                              saveApiKey(config.id, field.key, e.target.value);
                            }
                          }}
                          className="flex-1 px-4 py-2 bg-surface2 rounded-lg text-text placeholder:text-text3 focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                        {saving === `${config.id}-${field.key}` && (
                          <div className="flex items-center px-3">
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      {apiKeys[field.key] && (
                        <p className="text-xs text-success mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Configured
                        </p>
                      )}
                    </div>
                  ))}

                  {/* Test Connection Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => testApiConnection(config.id)}
                      disabled={testingApi === config.id || !config.fields.every(f => apiKeys[f.key])}
                      className="px-4 py-2 bg-surface2 text-text2 text-sm rounded-lg hover:bg-divider transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {testingApi === config.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-text3 border-t-transparent rounded-full animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Test Connection
                        </>
                      )}
                    </button>

                    {testResult && testResult.api === config.id && (
                      <div className={`mt-2 p-3 rounded-lg text-sm ${
                        testResult.success ? 'bg-success-light text-success' : 'bg-danger-light text-danger'
                      }`}>
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Environment Variables Note */}
            <div className="card p-6 bg-surface2">
              <h3 className="font-medium text-text mb-2">Using Environment Variables?</h3>
              <p className="text-sm text-text2 mb-4">
                If you prefer to use environment variables instead of storing keys in the database,
                add them to your <code className="px-1 py-0.5 bg-surface rounded text-accent">.env.local</code> file:
              </p>
              <pre className="bg-surface p-4 rounded-lg text-xs text-text3 overflow-x-auto">
{`# Moz API
MOZ_ACCESS_ID=your-access-id
MOZ_SECRET_KEY=your-secret-key

# DataForSEO
DATAFORSEO_LOGIN=your@email.com
DATAFORSEO_PASSWORD=your-password

# SEMrush
SEMRUSH_API_KEY=your-api-key

# OpenAI (already configured)
OPENAI_API_KEY=sk-...

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-...`}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
