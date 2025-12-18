'use client';

import { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';

interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  metrics?: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    ctr: number;
    conversionRate: number;
  };
}

interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'archived';
  type: 'ad_copy' | 'landing_page' | 'bid_strategy' | 'audience' | 'budget';
  controlVariant: ExperimentVariant;
  testVariants: ExperimentVariant[];
  trafficSplit: number;
  targetMetric: string;
  confidenceLevel: number;
  startDate?: string;
  endDate?: string;
  results?: {
    winner: string | null;
    confidence: number;
    lift: number;
    isStatisticallySignificant: boolean;
    recommendation: string;
  };
  createdAt: string;
}

interface ABTestingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'list' | 'create' | 'details';
type ExperimentType = 'ad_copy' | 'landing_page' | 'bid_strategy' | 'audience' | 'budget';

export default function ABTestingPanel({ isOpen, onClose }: ABTestingPanelProps) {
  const { currentAccount } = useAccount();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'ad_copy' as ExperimentType,
    trafficSplit: 50,
    targetMetric: 'conversions',
    confidenceLevel: 95,
    controlName: 'Control',
    controlDescription: '',
    testName: 'Variant B',
    testDescription: '',
  });

  useEffect(() => {
    if (isOpen && currentAccount) {
      fetchExperiments();
    }
  }, [isOpen, currentAccount]);

  const fetchExperiments = async () => {
    if (!currentAccount) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/ab-testing?accountId=${currentAccount.id}`);
      const data = await response.json();
      if (data.experiments) {
        setExperiments(data.experiments);
      }
    } catch (error) {
      console.error('Error fetching experiments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateExperiment = async () => {
    if (!currentAccount) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/ab-testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: currentAccount.id,
          name: formData.name,
          description: formData.description,
          type: formData.type,
          trafficSplit: formData.trafficSplit,
          targetMetric: formData.targetMetric,
          confidenceLevel: formData.confidenceLevel,
          controlVariant: {
            name: formData.controlName,
            description: formData.controlDescription,
            config: {},
          },
          testVariants: [{
            name: formData.testName,
            description: formData.testDescription,
            config: {},
          }],
        }),
      });

      const data = await response.json();
      if (data.success && data.experiment) {
        setExperiments(prev => [data.experiment, ...prev]);
        setViewMode('list');
        resetForm();
      }
    } catch (error) {
      console.error('Error creating experiment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (experimentId: string, action: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ab-testing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: experimentId, action }),
      });

      const data = await response.json();
      if (data.success) {
        fetchExperiments();
        if (data.results && selectedExperiment) {
          setSelectedExperiment({
            ...selectedExperiment,
            results: data.results,
          });
        }
      }
    } catch (error) {
      console.error('Error performing action:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'ad_copy',
      trafficSplit: 50,
      targetMetric: 'conversions',
      confidenceLevel: 95,
      controlName: 'Control',
      controlDescription: '',
      testName: 'Variant B',
      testDescription: '',
    });
  };

  const getStatusColor = (status: Experiment['status']) => {
    switch (status) {
      case 'running': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: ExperimentType) => {
    switch (type) {
      case 'ad_copy': return 'Ad Copy';
      case 'landing_page': return 'Landing Page';
      case 'bid_strategy': return 'Bid Strategy';
      case 'audience': return 'Audience';
      case 'budget': return 'Budget';
      default: return type;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            {viewMode !== 'list' && (
              <button
                onClick={() => {
                  setViewMode('list');
                  setSelectedExperiment(null);
                }}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {viewMode === 'list' ? 'A/B Testing' : viewMode === 'create' ? 'New Experiment' : selectedExperiment?.name}
              </h2>
              <p className="text-sm text-gray-500">
                {viewMode === 'list' ? 'Create and manage experiments' : viewMode === 'create' ? 'Configure your experiment' : 'Experiment details'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              <button
                onClick={() => setViewMode('create')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-4 text-gray-600 transition-colors hover:border-blue-400 hover:text-blue-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Experiment
              </button>

              {isLoading && experiments.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="h-8 w-8 animate-spin text-blue-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : experiments.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-8 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No experiments yet</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Create your first A/B test to optimize your campaigns with data-driven decisions.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {experiments.map(exp => (
                    <div
                      key={exp.id}
                      onClick={() => {
                        setSelectedExperiment(exp);
                        setViewMode('details');
                      }}
                      className="cursor-pointer rounded-lg border border-gray-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/50"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-gray-900">{exp.name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(exp.status)}`}>
                              {exp.status}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            {getTypeLabel(exp.type)} - {exp.trafficSplit}% test traffic
                          </p>
                        </div>
                        {exp.results?.isStatisticallySignificant && (
                          <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Significant
                          </div>
                        )}
                      </div>
                      {exp.results && (
                        <div className="mt-3 flex items-center gap-4 text-sm">
                          <span className="text-gray-600">
                            Confidence: <span className="font-medium">{exp.results.confidence.toFixed(1)}%</span>
                          </span>
                          <span className={`font-medium ${exp.results.lift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {exp.results.lift >= 0 ? '+' : ''}{exp.results.lift.toFixed(1)}% lift
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create View */}
          {viewMode === 'create' && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experiment Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Headlines Test Q4"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What are you testing and why?"
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experiment Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as ExperimentType }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="ad_copy">Ad Copy</option>
                    <option value="landing_page">Landing Page</option>
                    <option value="bid_strategy">Bid Strategy</option>
                    <option value="audience">Audience</option>
                    <option value="budget">Budget</option>
                  </select>
                </div>
              </div>

              {/* Variants */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Variants</h3>

                <div className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">CONTROL</span>
                  </div>
                  <input
                    type="text"
                    value={formData.controlName}
                    onChange={e => setFormData(prev => ({ ...prev, controlName: e.target.value }))}
                    placeholder="Control variant name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={formData.controlDescription}
                    onChange={e => setFormData(prev => ({ ...prev, controlDescription: e.target.value }))}
                    placeholder="Description (optional)"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">TEST</span>
                  </div>
                  <input
                    type="text"
                    value={formData.testName}
                    onChange={e => setFormData(prev => ({ ...prev, testName: e.target.value }))}
                    placeholder="Test variant name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={formData.testDescription}
                    onChange={e => setFormData(prev => ({ ...prev, testDescription: e.target.value }))}
                    placeholder="Description (optional)"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">Settings</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Traffic Split: {formData.trafficSplit}% to test
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={formData.trafficSplit}
                    onChange={e => setFormData(prev => ({ ...prev, trafficSplit: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{100 - formData.trafficSplit}% Control</span>
                    <span>{formData.trafficSplit}% Test</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Metric</label>
                    <select
                      value={formData.targetMetric}
                      onChange={e => setFormData(prev => ({ ...prev, targetMetric: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="conversions">Conversions</option>
                      <option value="ctr">Click-Through Rate</option>
                      <option value="cpc">Cost Per Click</option>
                      <option value="roas">ROAS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confidence Level</label>
                    <select
                      value={formData.confidenceLevel}
                      onChange={e => setFormData(prev => ({ ...prev, confidenceLevel: parseInt(e.target.value) }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value={90}>90%</option>
                      <option value={95}>95%</option>
                      <option value={99}>99%</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreateExperiment}
                disabled={!formData.name || isLoading}
                className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Experiment'}
              </button>
            </div>
          )}

          {/* Details View */}
          {viewMode === 'details' && selectedExperiment && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className={`rounded-lg p-4 ${
                selectedExperiment.status === 'running' ? 'bg-green-50' :
                selectedExperiment.status === 'completed' ? 'bg-blue-50' :
                'bg-gray-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(selectedExperiment.status)}`}>
                      {selectedExperiment.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">
                      {getTypeLabel(selectedExperiment.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedExperiment.status === 'draft' && (
                      <button
                        onClick={() => handleAction(selectedExperiment.id, 'start')}
                        disabled={isLoading}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Start
                      </button>
                    )}
                    {selectedExperiment.status === 'running' && (
                      <>
                        <button
                          onClick={() => handleAction(selectedExperiment.id, 'pause')}
                          disabled={isLoading}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Pause
                        </button>
                        <button
                          onClick={() => handleAction(selectedExperiment.id, 'analyze')}
                          disabled={isLoading}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Analyze
                        </button>
                      </>
                    )}
                    {selectedExperiment.status === 'paused' && (
                      <button
                        onClick={() => handleAction(selectedExperiment.id, 'resume')}
                        disabled={isLoading}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Results */}
              {selectedExperiment.results && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Results</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-sm text-gray-500">Confidence</div>
                      <div className="text-xl font-semibold text-gray-900">
                        {selectedExperiment.results.confidence.toFixed(1)}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-sm text-gray-500">Lift</div>
                      <div className={`text-xl font-semibold ${
                        selectedExperiment.results.lift >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedExperiment.results.lift >= 0 ? '+' : ''}{selectedExperiment.results.lift.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className={`mt-4 rounded-lg p-3 ${
                    selectedExperiment.results.isStatisticallySignificant ? 'bg-green-50' : 'bg-yellow-50'
                  }`}>
                    <p className={`text-sm ${
                      selectedExperiment.results.isStatisticallySignificant ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {selectedExperiment.results.recommendation}
                    </p>
                  </div>
                </div>
              )}

              {/* Variants */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Variants</h3>
                <div className="space-y-3">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">CONTROL</span>
                      <span className="font-medium text-gray-900">{selectedExperiment.controlVariant.name}</span>
                    </div>
                    {selectedExperiment.controlVariant.metrics && (
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Clicks:</span>{' '}
                          <span className="font-medium">{selectedExperiment.controlVariant.metrics.clicks}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Conv:</span>{' '}
                          <span className="font-medium">{selectedExperiment.controlVariant.metrics.conversions}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">CTR:</span>{' '}
                          <span className="font-medium">{selectedExperiment.controlVariant.metrics.ctr.toFixed(2)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedExperiment.testVariants.map(variant => (
                    <div key={variant.id} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600">TEST</span>
                        <span className="font-medium text-gray-900">{variant.name}</span>
                        {selectedExperiment.results?.winner === variant.id && (
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-600">WINNER</span>
                        )}
                      </div>
                      {variant.metrics && (
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Clicks:</span>{' '}
                            <span className="font-medium">{variant.metrics.clicks}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Conv:</span>{' '}
                            <span className="font-medium">{variant.metrics.conversions}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">CTR:</span>{' '}
                            <span className="font-medium">{variant.metrics.ctr.toFixed(2)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Settings</h3>
                <div className="rounded-lg border border-gray-200 p-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Traffic Split:</span>{' '}
                    <span className="font-medium">{selectedExperiment.trafficSplit}% to test</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Target Metric:</span>{' '}
                    <span className="font-medium capitalize">{selectedExperiment.targetMetric}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Confidence Level:</span>{' '}
                    <span className="font-medium">{selectedExperiment.confidenceLevel}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>{' '}
                    <span className="font-medium">{new Date(selectedExperiment.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
