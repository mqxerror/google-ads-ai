'use client';

import { useGuardrails } from '@/contexts/GuardrailsContext';

interface GuardrailsSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuardrailsSettingsPanel({ isOpen, onClose }: GuardrailsSettingsPanelProps) {
  const { settings, updateSettings, resetSettings } = useGuardrails();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <svg
                className="h-5 w-5 text-yellow-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Safety Guardrails</h2>
              <p className="text-sm text-gray-500">Configure protection settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Master Toggle */}
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900">Enable Guardrails</h3>
                <p className="text-sm text-gray-500">
                  Show warnings and block risky actions
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => updateSettings({ enabled: e.target.checked })}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300" />
              </label>
            </div>
          </div>

          {/* Settings (disabled when guardrails are off) */}
          <div className={settings.enabled ? '' : 'opacity-50 pointer-events-none'}>
            {/* Campaign Pause Protection */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Campaign Protection
              </h3>

              <div className="space-y-4">
                {/* Allow Pause All */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Block pausing all campaigns</h4>
                    <p className="text-sm text-gray-500">
                      Prevent accidentally pausing every active campaign
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={!settings.allowPauseAllCampaigns}
                      onChange={(e) => updateSettings({ allowPauseAllCampaigns: !e.target.checked })}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300" />
                  </label>
                </div>

                {/* Warn on High Performer Pause */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Warn on high performer pause</h4>
                    <p className="text-sm text-gray-500">
                      Alert when pausing campaigns with AI Score above threshold
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={settings.warnOnHighPerformerPause}
                      onChange={(e) => updateSettings({ warnOnHighPerformerPause: e.target.checked })}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300" />
                  </label>
                </div>

                {/* High Performer Threshold */}
                {settings.warnOnHighPerformerPause && (
                  <div className="ml-4 pl-4 border-l-2 border-gray-200">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">
                        High performer threshold (AI Score)
                      </span>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="range"
                          min="50"
                          max="95"
                          step="5"
                          value={settings.highPerformerThreshold}
                          onChange={(e) => updateSettings({ highPerformerThreshold: Number(e.target.value) })}
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="w-12 text-center text-sm font-medium text-gray-900">
                          {settings.highPerformerThreshold}
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Budget Protection */}
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Budget Protection
              </h3>

              <div className="space-y-4">
                {/* Block Zero Budget */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900">Block $0 budgets</h4>
                    <p className="text-sm text-gray-500">
                      Prevent setting campaign budgets to zero (use pause instead)
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={!settings.allowZeroBudget}
                      onChange={(e) => updateSettings({ allowZeroBudget: !e.target.checked })}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300" />
                  </label>
                </div>

                {/* Budget Change Threshold */}
                <div>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">
                      Large budget change warning threshold
                    </span>
                    <p className="text-sm text-gray-500 mb-2">
                      Warn when budget changes exceed this percentage
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={settings.budgetChangeThresholdPercent}
                        onChange={(e) => updateSettings({ budgetChangeThresholdPercent: Number(e.target.value) })}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="w-16 text-center text-sm font-medium text-gray-900">
                        {settings.budgetChangeThresholdPercent}%
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={resetSettings}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
