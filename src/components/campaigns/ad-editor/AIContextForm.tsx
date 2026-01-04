'use client';

import { AdGenerationContext, LANGUAGES, PATH_MAX_LENGTH } from '@/types/ad-generation';

interface AIContextFormProps {
  context: AdGenerationContext;
  onChange: (updates: Partial<AdGenerationContext>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export default function AIContextForm({ context, onChange, onGenerate, isGenerating }: AIContextFormProps) {
  const handleArrayChange = (field: 'keyStatistics' | 'keyBenefits', value: string) => {
    // Split by newlines or commas and filter empty
    const items = value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ [field]: items });
  };

  const handleKeywordsChange = (value: string) => {
    const keywords = value
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ targetKeywords: keywords });
  };

  return (
    <div className="space-y-4">
      {/* Language */}
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">Language</label>
        <select
          value={context.language}
          onChange={(e) => onChange({ language: e.target.value as AdGenerationContext['language'] })}
          className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* Company Name */}
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">
          Company Name <span className="text-text3 font-normal">*</span>
        </label>
        <input
          type="text"
          value={context.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
          placeholder="Enter your company/brand name"
          className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
        />
        <p className="text-[10px] text-text3 mt-1 italic">Insert your brand name here</p>
      </div>

      {/* Product/Service Offering */}
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">
          Product or Service Offering <span className="text-text3 font-normal">*</span>
        </label>
        <textarea
          value={context.productOffering}
          onChange={(e) => onChange({ productOffering: e.target.value })}
          placeholder="e.g., Premium web hosting with 99.9% uptime"
          rows={2}
          className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
        />
        <p className="text-[10px] text-text3 mt-1 italic">Insert what you are selling here (e.g. product or service)</p>
      </div>

      {/* Key Selling Statistics */}
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">Key Selling Statistics</label>
        <textarea
          value={context.keyStatistics.join('\n')}
          onChange={(e) => handleArrayChange('keyStatistics', e.target.value)}
          placeholder="5000+ happy customers&#10;24/7 support&#10;99.9% uptime"
          rows={3}
          className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
        />
        <p className="text-[10px] text-text3 mt-1 italic">
          Insert concrete values like 1-hour service, 5-star rating, 5000+ users etc.
        </p>
      </div>

      {/* Key Benefits */}
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">Key Benefits</label>
        <textarea
          value={context.keyBenefits.join('\n')}
          onChange={(e) => handleArrayChange('keyBenefits', e.target.value)}
          placeholder="Free shipping&#10;30-day money back guarantee&#10;Expert consultation included"
          rows={3}
          className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
        />
        <p className="text-[10px] text-text3 mt-1 italic">
          Insert the key benefits to the user about your product or service
        </p>
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-xs font-medium text-text2 mb-1.5">
          Keywords Ad is Targeting <span className="text-text3 font-normal">*</span>
        </label>
        <textarea
          value={context.targetKeywords.join('\n')}
          onChange={(e) => handleKeywordsChange(e.target.value)}
          placeholder="web hosting&#10;cloud hosting&#10;managed hosting"
          rows={3}
          className="w-full px-3 py-2 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all resize-none"
        />
        <p className="text-[10px] text-text3 mt-1 italic">Insert the keywords that your ad is primarily targeting</p>
        {context.targetKeywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {context.targetKeywords.slice(0, 5).map((kw, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded">
                {kw}
              </span>
            ))}
            {context.targetKeywords.length > 5 && (
              <span className="px-2 py-0.5 bg-surface text-text3 text-xs rounded">
                +{context.targetKeywords.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-divider pt-4">
        <h4 className="text-xs font-medium text-text2 mb-3">URL Display Paths (Optional)</h4>

        {/* Path Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-text3 mb-1">Path 1</label>
            <div className="relative">
              <input
                type="text"
                value={context.pathField1 || ''}
                onChange={(e) => onChange({ pathField1: e.target.value.slice(0, PATH_MAX_LENGTH) })}
                placeholder="e.g., deals"
                maxLength={PATH_MAX_LENGTH}
                className="w-full px-3 py-2 pr-10 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
              <span className="absolute right-2 top-2 text-[10px] text-text3">
                {(context.pathField1 || '').length}/{PATH_MAX_LENGTH}
              </span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-text3 mb-1">Path 2</label>
            <div className="relative">
              <input
                type="text"
                value={context.pathField2 || ''}
                onChange={(e) => onChange({ pathField2: e.target.value.slice(0, PATH_MAX_LENGTH) })}
                placeholder="e.g., hosting"
                maxLength={PATH_MAX_LENGTH}
                className="w-full px-3 py-2 pr-10 bg-surface2 border border-divider rounded-lg text-sm text-text placeholder-text3 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
              />
              <span className="absolute right-2 top-2 text-[10px] text-text3">
                {(context.pathField2 || '').length}/{PATH_MAX_LENGTH}
              </span>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-text3 mt-1.5">
          example.com/<span className="text-accent">{context.pathField1 || 'path1'}</span>/
          <span className="text-accent">{context.pathField2 || 'path2'}</span>
        </p>
      </div>

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating || !context.companyName.trim() || !context.productOffering.trim()}
        className="w-full py-3 bg-accent text-white font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isGenerating ? (
          <>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Generating...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Write me some ads!
          </>
        )}
      </button>
    </div>
  );
}
