'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import StepTracker, {
  BRAND_DNA_STEPS,
  AUDIENCE_DNA_STEPS,
  COMPETITOR_DNA_STEPS,
  buildStepsFromStatus,
  calculateProgress
} from '@/components/intelligence/StepTracker';

interface StepLog {
  step: string;
  status: string;
  message?: string;
  timestamp?: string;
  duration_ms?: number;
}

interface Project {
  id: string;
  name: string;
  brandName: string;
  domain: string | null;
  industry: string | null;
  businessModel: string | null;
  status: string;
  brandDnaStatus: string;
  audienceDnaStatus: string;
  competitorDnaStatus: string;
  unifiedReportStatus: string;
  unifiedReport: string | null;
  totalApiCost: number;
  createdAt: string;
  updatedAt: string;
}

interface BrandDNA {
  id: string;
  status: string;
  currentStep: string;
  stepProgress: number;
  stepMessage: string | null;
  stepsLog: StepLog[];
  modelUsed: string | null;
  missionVision: string | null;
  brandValues: Array<{ value: string; description: string }> | null;
  brandPositioning: string | null;
  uniqueDifferentiators: string[] | null;
  targetMarket: string | null;
  brandVoice: string | null;
  companyStory: string | null;
  fullReport: string | null;
  errorMessage: string | null;
  apiCost: number;
}

interface AudiencePersona {
  id: string;
  position: number;
  personaName: string;
  personaTitle: string;
  avatarEmoji: string;
  demographics: {
    ageRange: string;
    gender: string;
    income: string;
    education: string;
    occupation: string;
    location: string;
    familyStatus: string;
  };
  lifeSituation: string;
  goalsAspirations: string[];
  painPoints: string[];
  fearsAnxieties: string[];
  valuesBeliefs: string[];
  behaviorPatterns: {
    researchStyle: string;
    decisionTimeline: string;
    influencers: string;
    preferredChannels: string[];
  };
  decisionFactors: {
    keyMessages: string[];
    adCopyHooks: string[];
  };
  purchaseMotivations: string[];
  objections: string[];
  trustSignals: string[];
  awarenessLevel: string;
  channels: string[];
  status: string;
  apiCost: number;
  modelUsed: string | null;
}

interface AudienceDNAStatus {
  currentStep: string;
  stepProgress: number;
  stepMessage: string | null;
  stepsLog: StepLog[];
}

interface CompetitorAnalysis {
  id: string;
  position: number;
  competitorName: string;
  competitorDomain: string;
  threatLevel: 'direct' | 'indirect' | 'emerging';
  brandPositioning: string;
  uniqueValueProp: string;
  targetAudience: string;
  contentStrategy: string;
  strengths: string[];
  weaknesses: string[];
  keyDifferentiators: string[];
  marketPosition: string;
  fullReport: string | null;
  status: string;
  apiCost: number;
  modelUsed: string | null;
}

interface CompetitorDNAStatus {
  currentStep: string;
  stepProgress: number;
  stepMessage: string | null;
  stepsLog: StepLog[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  researching: { bg: 'bg-yellow-50', text: 'text-yellow-600', border: 'border-yellow-200' },
  scraping: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  analyzing: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  completed: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  failed: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
};

export default function IntelligenceProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [brandDna, setBrandDna] = useState<BrandDNA | null>(null);
  const [audiencePersonas, setAudiencePersonas] = useState<AudiencePersona[]>([]);
  const [audienceDnaStatus, setAudienceDnaStatus] = useState<AudienceDNAStatus | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorAnalysis[]>([]);
  const [competitorDnaStatus, setCompetitorDnaStatus] = useState<CompetitorDNAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingAudience, setGeneratingAudience] = useState(false);
  const [generatingCompetitors, setGeneratingCompetitors] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'brand' | 'audience' | 'competitor' | 'report'>('brand');
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const audiencePollingRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef(false);
  const audienceStartTimeRef = useRef<number | null>(null);
  const audienceHighestStepRef = useRef<number>(0);
  const competitorStartTimeRef = useRef<number | null>(null);
  const competitorHighestStepRef = useRef<number>(0);

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Check if Brand DNA is currently processing
  const isBrandProcessing = brandDna &&
    brandDna.status !== 'pending' &&
    brandDna.status !== 'completed' &&
    brandDna.status !== 'failed' &&
    brandDna.currentStep !== 'idle' &&
    brandDna.currentStep !== 'completed' &&
    brandDna.currentStep !== 'failed';

  // Check if Audience DNA is currently processing
  const isAudienceProcessing = project?.audienceDnaStatus === 'in_progress' || generatingAudience;

  // Check if Competitor DNA is currently processing
  const isCompetitorProcessing = project?.competitorDnaStatus === 'in_progress' || generatingCompetitors;

  // Any processing happening
  const isProcessing = isBrandProcessing || isAudienceProcessing || isCompetitorProcessing;

  // Step order for audience DNA
  const AUDIENCE_STEP_ORDER = ['initializing', 'loading_brand', 'generating', 'parsing', 'saving', 'completed'];

  // Calculate audience DNA step based on elapsed time (estimation until we have real step tracking)
  const getAudienceStep = useCallback(() => {
    if (!audienceStartTimeRef.current) return 'initializing';
    const elapsed = Date.now() - audienceStartTimeRef.current;

    // Estimate steps based on typical timings (adjusted for longer API calls)
    let estimatedStepIndex = 0;
    if (elapsed < 2000) estimatedStepIndex = 0; // initializing
    else if (elapsed < 5000) estimatedStepIndex = 1; // loading_brand
    else if (elapsed < 120000) estimatedStepIndex = 2; // generating - can take up to 2 minutes
    else if (elapsed < 125000) estimatedStepIndex = 3; // parsing
    else estimatedStepIndex = 4; // saving

    // Never go backwards - always use the highest step we've reached
    if (estimatedStepIndex > audienceHighestStepRef.current) {
      audienceHighestStepRef.current = estimatedStepIndex;
    }

    return AUDIENCE_STEP_ORDER[audienceHighestStepRef.current];
  }, []);

  // Update audience step estimation
  useEffect(() => {
    if (isAudienceProcessing && audienceStartTimeRef.current) {
      const interval = setInterval(() => {
        const currentStep = getAudienceStep();
        const progress = calculateProgress(currentStep, AUDIENCE_DNA_STEPS);
        setAudienceDnaStatus({
          currentStep,
          stepProgress: progress,
          stepMessage: null,
          stepsLog: [],
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isAudienceProcessing, getAudienceStep]);

  // Step order for competitor DNA
  const COMPETITOR_STEP_ORDER = ['initializing', 'discovering', 'analyzing', 'generating_report', 'saving', 'completed'];

  // Calculate competitor DNA step based on elapsed time
  const getCompetitorStep = useCallback(() => {
    if (!competitorStartTimeRef.current) return 'initializing';
    const elapsed = Date.now() - competitorStartTimeRef.current;

    // Estimate steps based on typical timings (competitor analysis takes longer)
    let estimatedStepIndex = 0;
    if (elapsed < 2000) estimatedStepIndex = 0; // initializing
    else if (elapsed < 30000) estimatedStepIndex = 1; // discovering (~30s)
    else if (elapsed < 120000) estimatedStepIndex = 2; // analyzing (~90s for 3 competitors)
    else if (elapsed < 150000) estimatedStepIndex = 3; // generating_report (~30s)
    else estimatedStepIndex = 4; // saving

    // Never go backwards
    if (estimatedStepIndex > competitorHighestStepRef.current) {
      competitorHighestStepRef.current = estimatedStepIndex;
    }

    return COMPETITOR_STEP_ORDER[competitorHighestStepRef.current];
  }, []);

  // Update competitor step estimation
  useEffect(() => {
    if (isCompetitorProcessing && competitorStartTimeRef.current) {
      const interval = setInterval(() => {
        const currentStep = getCompetitorStep();
        const progress = calculateProgress(currentStep, COMPETITOR_DNA_STEPS);
        setCompetitorDnaStatus({
          currentStep,
          stepProgress: progress,
          stepMessage: null,
          stepsLog: [],
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isCompetitorProcessing, getCompetitorStep]);

  // Fetch project data
  useEffect(() => {
    if (isAuthenticated && resolvedParams.id) {
      fetchProject();
    }
  }, [isAuthenticated, resolvedParams.id]);

  // Polling for real-time updates during analysis
  useEffect(() => {
    if (isProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        if (!isFetchingRef.current) {
          fetchProjectSilent();
        }
      }, 1500); // Poll every 1.5 seconds
    }

    if (!isProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isProcessing]);

  // Silent fetch (no loading state change)
  async function fetchProjectSilent() {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await fetch(`/api/intelligence/${resolvedParams.id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data.project);
        setBrandDna(data.brandDna);
        if (data.audienceDna) setAudiencePersonas(data.audienceDna);
        if (data.competitorDna) setCompetitors(data.competitorDna);
      }
    } catch (err) {
      console.error('Silent fetch error:', err);
    } finally {
      isFetchingRef.current = false;
    }
  }

  async function fetchProject() {
    try {
      setLoading(true);
      const res = await fetch(`/api/intelligence/${resolvedParams.id}`);

      if (!res.ok) {
        if (res.status === 404) {
          router.push('/intelligence');
          return;
        }
        throw new Error('Failed to fetch project');
      }

      const data = await res.json();
      setProject(data.project);
      setBrandDna(data.brandDna);
      setAudiencePersonas(data.audienceDna || []);
      setCompetitors(data.competitorDna || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartAudienceDNA() {
    if (!project) return;

    try {
      setGeneratingAudience(true);
      setError(null);

      // Initialize step tracking
      audienceStartTimeRef.current = Date.now();
      audienceHighestStepRef.current = 0; // Reset to first step
      setAudienceDnaStatus({
        currentStep: 'initializing',
        stepProgress: 0,
        stepMessage: 'Starting persona generation...',
        stepsLog: [],
      });

      const res = await fetch(`/api/intelligence/${project.id}/audience-dna`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate personas');
      }

      // Mark as completed
      setAudienceDnaStatus({
        currentStep: 'completed',
        stepProgress: 100,
        stepMessage: '3 personas generated',
        stepsLog: [],
      });

      // Refresh project data to get the new personas
      await fetchProject();
    } catch (err: any) {
      console.error('Error generating Audience DNA:', err);
      setError(err.message || 'Failed to generate personas');
      setAudienceDnaStatus(null);
    } finally {
      setGeneratingAudience(false);
      audienceStartTimeRef.current = null;
    }
  }

  async function handleStartCompetitorDNA() {
    if (!project) return;

    try {
      setGeneratingCompetitors(true);
      setError(null);

      // Initialize step tracking
      competitorStartTimeRef.current = Date.now();
      competitorHighestStepRef.current = 0; // Reset to first step
      setCompetitorDnaStatus({
        currentStep: 'initializing',
        stepProgress: 0,
        stepMessage: 'Starting competitor discovery...',
        stepsLog: [],
      });

      const res = await fetch(`/api/intelligence/${project.id}/competitor-dna`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to discover competitors');
      }

      // Mark as completed
      setCompetitorDnaStatus({
        currentStep: 'completed',
        stepProgress: 100,
        stepMessage: '3 competitors analyzed',
        stepsLog: [],
      });

      // Refresh project data to get the new competitors
      await fetchProject();
    } catch (err: any) {
      console.error('Error generating Competitor DNA:', err);
      setError(err.message || 'Failed to discover competitors');
      setCompetitorDnaStatus(null);
    } finally {
      setGeneratingCompetitors(false);
      competitorStartTimeRef.current = null;
    }
  }

  async function handleGenerateUnifiedReport() {
    if (!project) return;

    try {
      setGeneratingReport(true);
      setError(null);

      const res = await fetch(`/api/intelligence/${project.id}/unified-report`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate report');
      }

      // Refresh project data to get the new report
      await fetchProject();
    } catch (err: any) {
      console.error('Error generating unified report:', err);
      setError(err.message || 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleStartBrandDNA() {
    if (!project) return;

    try {
      setAnalyzing(true);
      setError(null);

      const res = await fetch(`/api/intelligence/${project.id}/brand-dna`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start analysis');
      }

      // Refresh project data
      await fetchProject();
    } catch (err: any) {
      console.error('Error starting Brand DNA:', err);
      setError(err.message || 'Failed to start analysis');
    } finally {
      setAnalyzing(false);
    }
  }

  function getStatusInfo(status: string) {
    return STATUS_COLORS[status] || STATUS_COLORS.pending;
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Please sign in</h2>
          <Link href="/auth/signin" className="mt-4 inline-block text-blue-600 hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Project not found</h2>
          <Link href="/intelligence" className="mt-4 inline-block text-blue-600 hover:underline">
            Back to Intelligence Center
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/intelligence" className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project.brandName}</h1>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  {project.domain && <span>{project.domain}</span>}
                  {project.industry && <span>&#8226; {project.industry}</span>}
                  {project.totalApiCost > 0 && (
                    <span className="text-xs text-gray-400">&#8226; Cost: ${project.totalApiCost.toFixed(4)}</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1 border-b border-gray-200 -mb-px">
            <button
              onClick={() => setActiveTab('brand')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'brand'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              &#127970; Brand DNA
            </button>
            <button
              onClick={() => setActiveTab('audience')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'audience'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              &#128101; Audience DNA
            </button>
            <button
              onClick={() => setActiveTab('competitor')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'competitor'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              &#9876; Competitor DNA
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'report'
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              &#128203; Brand Report
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
          </div>
        )}

        {/* Brand DNA Tab */}
        {activeTab === 'brand' && (
          <div>
            {!brandDna || brandDna.status === 'pending' ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-6xl mb-4">&#127970;</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Brand DNA Analysis</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Research {project.brandName}'s identity, values, positioning, and voice.
                  We'll scrape their website and research their online presence.
                </p>
                <div className="text-sm text-gray-400 mb-4">
                  Estimated cost: ~$0.09 | Time: ~30 seconds
                </div>
                <button
                  onClick={handleStartBrandDNA}
                  disabled={analyzing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {analyzing ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin">&#9696;</span> Analyzing...
                    </span>
                  ) : (
                    'Start Brand DNA Analysis'
                  )}
                </button>
              </div>
            ) : isBrandProcessing ? (
              <StepTracker
                steps={buildStepsFromStatus(brandDna.currentStep, brandDna.stepsLog)}
                currentStep={brandDna.currentStep}
                progress={brandDna.stepProgress || calculateProgress(brandDna.currentStep)}
                message={brandDna.stepMessage || undefined}
                estimatedTotal="45s"
                cost={brandDna.apiCost > 0 ? brandDna.apiCost : undefined}
                title="Brand DNA Analysis"
              />
            ) : brandDna.status === 'failed' || brandDna.currentStep === 'failed' ? (
              <div className="bg-red-50 rounded-xl border border-red-200 p-8 text-center">
                <div className="text-6xl mb-4">&#10060;</div>
                <h3 className="text-xl font-semibold text-red-700 mb-2">Analysis Failed</h3>
                <p className="text-red-600 mb-4">{brandDna.errorMessage || 'Unknown error'}</p>
                <button
                  onClick={handleStartBrandDNA}
                  disabled={analyzing}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {analyzing ? 'Retrying...' : 'Retry Analysis'}
                </button>
              </div>
            ) : (brandDna.status === 'completed' || brandDna.currentStep === 'completed') && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Positioning</h4>
                    <p className="text-gray-900">{brandDna.brandPositioning || '-'}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Target Market</h4>
                    <p className="text-gray-900">{brandDna.targetMarket || '-'}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Brand Voice</h4>
                    <p className="text-gray-900">{brandDna.brandVoice || '-'}</p>
                  </div>
                </div>

                {/* Brand Values */}
                {brandDna.brandValues && brandDna.brandValues.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Core Values</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {brandDna.brandValues.map((v, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-900">{v.value}</h5>
                          <p className="text-sm text-gray-600 mt-1">{v.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Differentiators */}
                {brandDna.uniqueDifferentiators && brandDna.uniqueDifferentiators.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h4 className="text-sm font-medium text-gray-500 mb-3">Unique Differentiators</h4>
                    <ul className="space-y-2">
                      {brandDna.uniqueDifferentiators.map((d, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">&#10003;</span>
                          <span className="text-gray-700">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Full Report */}
                {brandDna.fullReport && (
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium text-gray-500">Full Report</h4>
                      <div className="flex items-center gap-3">
                        {brandDna.modelUsed && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            {brandDna.modelUsed.includes('opus') ? 'Claude Opus 4.5' :
                             brandDna.modelUsed.includes('sonnet') ? 'Claude Sonnet' :
                             brandDna.modelUsed}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          Cost: ${brandDna.apiCost.toFixed(4)}
                        </span>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{brandDna.fullReport}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Re-run button */}
                <div className="text-center pt-4">
                  <button
                    onClick={handleStartBrandDNA}
                    disabled={analyzing}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    {analyzing ? 'Re-analyzing...' : 'Re-run Analysis'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audience DNA Tab */}
        {activeTab === 'audience' && (
          <div>
            {/* Check if Brand DNA is completed */}
            {(!brandDna || brandDna.status !== 'completed') ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-6xl mb-4">&#128274;</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Brand DNA Required</h3>
                <p className="text-gray-500 mb-6">
                  Complete Brand DNA analysis first to generate audience personas.
                </p>
                <button
                  onClick={() => setActiveTab('brand')}
                  className="px-4 py-2 text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                >
                  Go to Brand DNA
                </button>
              </div>
            ) : isAudienceProcessing && audienceDnaStatus ? (
              /* Show Step Tracker during generation */
              <StepTracker
                steps={buildStepsFromStatus(audienceDnaStatus.currentStep, audienceDnaStatus.stepsLog, AUDIENCE_DNA_STEPS)}
                currentStep={audienceDnaStatus.currentStep}
                progress={audienceDnaStatus.stepProgress || calculateProgress(audienceDnaStatus.currentStep, AUDIENCE_DNA_STEPS)}
                message={audienceDnaStatus.stepMessage || 'Generating with Claude Opus 4.5...'}
                estimatedTotal="25s"
                title="Audience DNA Generation"
              />
            ) : audiencePersonas.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-6xl mb-4">&#128101;</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Audience DNA</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Generate 3 detailed customer personas with psychological profiling,
                  pain points, motivations, and ready-to-use ad copy hooks.
                </p>
                <div className="text-sm text-gray-400 mb-4">
                  Estimated cost: ~$0.10 | Time: ~15-20 seconds
                </div>
                <button
                  onClick={handleStartAudienceDNA}
                  disabled={generatingAudience}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  Generate 3 Customer Personas
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Personas Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {audiencePersonas.map((persona) => (
                    <div
                      key={persona.id}
                      className={`bg-white rounded-xl border-2 transition-all cursor-pointer ${
                        expandedPersona === persona.id
                          ? 'border-purple-400 shadow-lg'
                          : 'border-gray-200 hover:border-purple-200 hover:shadow'
                      }`}
                      onClick={() => setExpandedPersona(expandedPersona === persona.id ? null : persona.id)}
                    >
                      {/* Persona Header */}
                      <div className="p-5 border-b border-gray-100">
                        <div className="flex items-start gap-3">
                          <div className="text-4xl">{persona.avatarEmoji}</div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{persona.personaName}</h3>
                            <p className="text-sm text-purple-600 font-medium">{persona.personaTitle}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {persona.demographics?.ageRange} • {persona.demographics?.occupation}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            persona.position === 1 ? 'bg-green-100 text-green-700' :
                            persona.position === 2 ? 'bg-blue-100 text-blue-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {persona.position === 1 ? 'Primary' : persona.position === 2 ? 'Secondary' : 'Aspirational'}
                          </span>
                        </div>
                      </div>

                      {/* Collapsed View */}
                      {expandedPersona !== persona.id && (
                        <div className="p-5 space-y-4">
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Life Situation</h4>
                            <p className="text-sm text-gray-700 line-clamp-2">{persona.lifeSituation}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Top Pain Points</h4>
                            <ul className="space-y-1">
                              {persona.painPoints?.slice(0, 2).map((pain, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-red-500">&#8226;</span>
                                  <span className="line-clamp-1">{pain}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-xs text-purple-600 text-center pt-2">Click to expand</p>
                        </div>
                      )}

                      {/* Expanded View */}
                      {expandedPersona === persona.id && (
                        <div className="p-5 space-y-5">
                          {/* Life Situation */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Life Situation</h4>
                            <p className="text-sm text-gray-700">{persona.lifeSituation}</p>
                          </div>

                          {/* Demographics */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Demographics</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div><span className="text-gray-500">Age:</span> {persona.demographics?.ageRange}</div>
                              <div><span className="text-gray-500">Income:</span> {persona.demographics?.income}</div>
                              <div><span className="text-gray-500">Location:</span> {persona.demographics?.location}</div>
                              <div><span className="text-gray-500">Family:</span> {persona.demographics?.familyStatus}</div>
                            </div>
                          </div>

                          {/* Goals */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Goals & Aspirations</h4>
                            <ul className="space-y-1">
                              {persona.goalsAspirations?.map((goal, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-green-500">&#10003;</span>{goal}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Pain Points */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Pain Points</h4>
                            <ul className="space-y-1">
                              {persona.painPoints?.map((pain, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-red-500">&#8226;</span>{pain}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Fears */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Fears & Anxieties</h4>
                            <ul className="space-y-1">
                              {persona.fearsAnxieties?.map((fear, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-orange-500">&#9888;</span>{fear}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Objections */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Common Objections</h4>
                            <ul className="space-y-1">
                              {persona.objections?.map((obj, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-yellow-600">&#128172;</span>{obj}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Trust Signals */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">What Builds Trust</h4>
                            <ul className="space-y-1">
                              {persona.trustSignals?.map((trust, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-blue-500">&#128077;</span>{trust}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Ad Copy Hooks */}
                          {persona.decisionFactors?.adCopyHooks && (
                            <div className="bg-purple-50 rounded-lg p-4">
                              <h4 className="text-xs font-medium text-purple-700 uppercase mb-2">&#128161; Ad Copy Hooks</h4>
                              <ul className="space-y-2">
                                {persona.decisionFactors.adCopyHooks.map((hook, i) => (
                                  <li key={i} className="text-sm text-purple-900 font-medium">"{hook}"</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Awareness Level */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <span className="text-xs text-gray-500">Awareness Level:</span>
                            <span className="text-xs font-medium text-purple-600">{persona.awarenessLevel}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary Stats */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>&#128101; {audiencePersonas.length} Personas</span>
                      <span>&#128176; Cost: ${audiencePersonas.reduce((sum, p) => sum + (p.apiCost || 0), 0).toFixed(4)}</span>
                      {audiencePersonas[0]?.modelUsed && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                          Claude Opus 4.5
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleStartAudienceDNA}
                      disabled={generatingAudience}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                      {generatingAudience ? 'Regenerating...' : 'Regenerate Personas'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Competitor DNA Tab */}
        {activeTab === 'competitor' && (
          <div>
            {/* Check if Brand DNA is completed */}
            {(!brandDna || brandDna.status !== 'completed') ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-6xl mb-4">&#128274;</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Brand DNA Required</h3>
                <p className="text-gray-500 mb-6">
                  Complete Brand DNA analysis first to discover competitors.
                </p>
                <button
                  onClick={() => setActiveTab('brand')}
                  className="px-4 py-2 text-blue-600 hover:text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                >
                  Go to Brand DNA
                </button>
              </div>
            ) : isCompetitorProcessing && competitorDnaStatus ? (
              /* Show Step Tracker during generation */
              <StepTracker
                steps={buildStepsFromStatus(competitorDnaStatus.currentStep, competitorDnaStatus.stepsLog, COMPETITOR_DNA_STEPS)}
                currentStep={competitorDnaStatus.currentStep}
                progress={competitorDnaStatus.stepProgress || calculateProgress(competitorDnaStatus.currentStep, COMPETITOR_DNA_STEPS)}
                message={competitorDnaStatus.stepMessage || 'Discovering competitors...'}
                estimatedTotal="2m 30s"
                title="Competitor DNA Discovery"
              />
            ) : competitors.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-6xl mb-4">&#9876;</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Competitor DNA</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Discover and analyze your top 3 competitors. Get insights into their
                  positioning, strengths, weaknesses, and market strategy.
                </p>
                <div className="text-sm text-gray-400 mb-4">
                  Estimated cost: ~$0.15 | Time: ~2-3 minutes
                </div>
                <button
                  onClick={handleStartCompetitorDNA}
                  disabled={generatingCompetitors}
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  Discover Top 3 Competitors
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Competitors Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {competitors.map((competitor) => (
                    <div
                      key={competitor.id}
                      className={`bg-white rounded-xl border-2 transition-all cursor-pointer ${
                        expandedCompetitor === competitor.id
                          ? 'border-orange-400 shadow-lg'
                          : 'border-gray-200 hover:border-orange-200 hover:shadow'
                      }`}
                      onClick={() => setExpandedCompetitor(expandedCompetitor === competitor.id ? null : competitor.id)}
                    >
                      {/* Competitor Header */}
                      <div className="p-5 border-b border-gray-100">
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold ${
                            competitor.threatLevel === 'direct' ? 'bg-red-500' :
                            competitor.threatLevel === 'indirect' ? 'bg-orange-500' :
                            'bg-yellow-500'
                          }`}>
                            #{competitor.position}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{competitor.competitorName}</h3>
                            <p className="text-sm text-gray-500">{competitor.competitorDomain}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            competitor.threatLevel === 'direct' ? 'bg-red-100 text-red-700' :
                            competitor.threatLevel === 'indirect' ? 'bg-orange-100 text-orange-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {competitor.threatLevel === 'direct' ? 'Direct Threat' :
                             competitor.threatLevel === 'indirect' ? 'Indirect' :
                             'Emerging'}
                          </span>
                        </div>
                      </div>

                      {/* Collapsed View */}
                      {expandedCompetitor !== competitor.id && (
                        <div className="p-5 space-y-4">
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Positioning</h4>
                            <p className="text-sm text-gray-700 line-clamp-2">{competitor.brandPositioning}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Key Strengths</h4>
                            <ul className="space-y-1">
                              {competitor.strengths?.slice(0, 2).map((strength, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-green-500">&#10003;</span>
                                  <span className="line-clamp-1">{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-xs text-orange-600 text-center pt-2">Click to expand</p>
                        </div>
                      )}

                      {/* Expanded View */}
                      {expandedCompetitor === competitor.id && (
                        <div className="p-5 space-y-5">
                          {/* Positioning */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Brand Positioning</h4>
                            <p className="text-sm text-gray-700">{competitor.brandPositioning}</p>
                          </div>

                          {/* Unique Value Prop */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Unique Value Proposition</h4>
                            <p className="text-sm text-gray-700">{competitor.uniqueValueProp}</p>
                          </div>

                          {/* Target Audience */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Target Audience</h4>
                            <p className="text-sm text-gray-700">{competitor.targetAudience}</p>
                          </div>

                          {/* Strengths */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Strengths</h4>
                            <ul className="space-y-1">
                              {competitor.strengths?.map((strength, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-green-500">&#10003;</span>{strength}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Weaknesses */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Weaknesses</h4>
                            <ul className="space-y-1">
                              {competitor.weaknesses?.map((weakness, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-red-500">&#10007;</span>{weakness}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Key Differentiators */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Key Differentiators</h4>
                            <ul className="space-y-1">
                              {competitor.keyDifferentiators?.map((diff, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-blue-500">&#9733;</span>{diff}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Content Strategy */}
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Content Strategy</h4>
                            <p className="text-sm text-gray-700">{competitor.contentStrategy}</p>
                          </div>

                          {/* Market Position */}
                          <div className="bg-orange-50 rounded-lg p-4">
                            <h4 className="text-xs font-medium text-orange-700 uppercase mb-2">&#128200; Market Position</h4>
                            <p className="text-sm text-orange-900">{competitor.marketPosition}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary Stats */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>&#9876; {competitors.length} Competitors</span>
                      <span>&#128176; Cost: ${competitors.reduce((sum, c) => sum + (c.apiCost || 0), 0).toFixed(4)}</span>
                      {competitors[0]?.modelUsed && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                          {competitors[0].modelUsed.includes('sonnet') ? 'Claude Sonnet' : competitors[0].modelUsed}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleStartCompetitorDNA}
                      disabled={generatingCompetitors}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                      {generatingCompetitors ? 'Re-discovering...' : 'Re-discover Competitors'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Brand Report Tab */}
        {activeTab === 'report' && (
          <div>
            {/* Check prerequisites */}
            {(!brandDna || brandDna.status !== 'completed' ||
              project.audienceDnaStatus !== 'completed' ||
              project.competitorDnaStatus !== 'completed') ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-6xl mb-4">&#128274;</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Complete All DNA Analysis First</h3>
                <p className="text-gray-500 mb-6">
                  Generate the Brand Intelligence Report after completing all three DNA analyses.
                </p>
                <div className="flex justify-center gap-4 text-sm">
                  <div className={`px-3 py-1 rounded-full ${
                    brandDna?.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {brandDna?.status === 'completed' ? '✓' : '○'} Brand DNA
                  </div>
                  <div className={`px-3 py-1 rounded-full ${
                    project.audienceDnaStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {project.audienceDnaStatus === 'completed' ? '✓' : '○'} Audience DNA
                  </div>
                  <div className={`px-3 py-1 rounded-full ${
                    project.competitorDnaStatus === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {project.competitorDnaStatus === 'completed' ? '✓' : '○'} Competitor DNA
                  </div>
                </div>
              </div>
            ) : generatingReport ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700">Generating Brand Intelligence Report</h3>
                    <p className="text-gray-500 text-sm">Synthesizing all DNA analyses with Claude Opus 4.5...</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500">
                  This may take 30-60 seconds. Combining Brand DNA, Audience DNA, and Competitor DNA
                  into a comprehensive marketing asset.
                </div>
              </div>
            ) : !project.unifiedReport ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-6xl mb-4">&#128203;</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Brand Intelligence Report</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  Combine all DNA analyses into a comprehensive marketing report with
                  ready-to-use ad copy, messaging frameworks, and strategic insights.
                </p>
                <div className="text-sm text-gray-400 mb-4">
                  Estimated cost: ~$0.12 | Time: ~45 seconds
                </div>
                <button
                  onClick={handleGenerateUnifiedReport}
                  disabled={generatingReport}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                >
                  Generate Brand Intelligence Report
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Report Header */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Brand Intelligence Report</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Comprehensive marketing asset for {project.brandName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        Claude Opus 4.5
                      </span>
                      <button
                        onClick={handleGenerateUnifiedReport}
                        disabled={generatingReport}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-white transition"
                      >
                        {generatingReport ? 'Regenerating...' : 'Regenerate'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Report Content */}
                <div className="bg-white rounded-xl border border-gray-200 p-8 overflow-auto">
                  <div className="prose prose-lg max-w-none prose-green">
                    <ReactMarkdown>{project.unifiedReport}</ReactMarkdown>
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      Use this report as a reference for creating Google Ads campaigns,
                      landing pages, and marketing content.
                    </div>
                    <button
                      onClick={() => {
                        if (project.unifiedReport) {
                          navigator.clipboard.writeText(project.unifiedReport);
                          alert('Report copied to clipboard!');
                        }
                      }}
                      className="px-4 py-2 text-sm text-green-600 hover:text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition"
                    >
                      &#128203; Copy Report
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
