'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface IntelligenceProject {
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
  hasBrandReport: boolean;
  personaCount: number;
  competitorCount: number;
  totalApiCost: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-600' },
  completed: { bg: 'bg-green-100', text: 'text-green-600' },
  failed: { bg: 'bg-red-100', text: 'text-red-600' },
  draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
  researching: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
  analyzing: { bg: 'bg-purple-100', text: 'text-purple-600' },
};

export default function IntelligencePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<IntelligenceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    brandName: '',
    domain: '',
    industry: '',
    businessModel: '',
  });
  const [creating, setCreating] = useState(false);

  const isAuthenticated = status === 'authenticated' && session?.user;

  // Fetch projects
  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated]);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await fetch('/api/intelligence');

      if (!res.ok) {
        if (res.status === 401) {
          // User not authenticated - this is expected, page will show login prompt
          setProjects([]);
          return;
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch projects (${res.status})`);
      }

      const data = await res.json();
      setProjects(data.projects || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Failed to load intelligence projects');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject() {
    if (!newProject.name.trim() || !newProject.brandName.trim()) return;

    try {
      setCreating(true);
      const res = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const data = await res.json();
      router.push(`/intelligence/${data.project.id}`);
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  function getStatusBadge(status: string) {
    const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
        {status.replace('_', ' ')}
      </span>
    );
  }

  function getDnaStatus(status: string) {
    if (status === 'completed') return <span className="text-green-500">&#10003;</span>;
    if (status === 'failed') return <span className="text-red-500">&#10007;</span>;
    if (status === 'in_progress' || status === 'researching' || status === 'analyzing') {
      return <span className="text-blue-500 animate-pulse">&#9679;</span>;
    }
    return <span className="text-gray-300">&#9675;</span>;
  }

  function timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  if (status === 'loading') {
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
          <h2 className="text-xl font-semibold text-gray-700">Please sign in to access Intelligence Center</h2>
          <Link href="/auth/signin" className="mt-4 inline-block text-blue-600 hover:underline">
            Sign In
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
              <Link href="/" className="text-gray-500 hover:text-gray-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-3xl">&#129504;</span> Intelligence Center
                </h1>
                <p className="text-sm text-gray-500">Deep research into brands, audiences, and competitors</p>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Analysis
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

        {/* DNA Types Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">
                &#127970;
              </div>
              <h3 className="font-semibold text-gray-900">Brand DNA</h3>
            </div>
            <p className="text-sm text-gray-600">
              Deep research into brand identity, values, positioning, and voice.
              Scrapes website and researches online presence.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl">
                &#128101;
              </div>
              <h3 className="font-semibold text-gray-900">Audience DNA</h3>
            </div>
            <p className="text-sm text-gray-600">
              Creates 3 detailed customer personas with psychological profiling,
              pain points, and behavior patterns.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-xl">
                &#9876;
              </div>
              <h3 className="font-semibold text-gray-900">Competitor DNA</h3>
            </div>
            <p className="text-sm text-gray-600">
              Identifies and analyzes top 3 competitors with SEO metrics,
              content strategy, and gap opportunities.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <div className="text-6xl mb-4">&#129504;</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No analyses yet</h3>
            <p className="text-gray-500 mb-6">Start researching a brand to generate intelligence reports</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Start Your First Analysis
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Analyses</h2>
            <div className="grid grid-cols-1 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          &#127970; {project.brandName}
                          {getStatusBadge(project.status)}
                        </h3>
                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                          {project.domain && <span>{project.domain}</span>}
                          {project.industry && <span>&#8226; {project.industry}</span>}
                          {project.businessModel && <span>&#8226; {project.businessModel}</span>}
                        </p>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div>Updated {timeAgo(project.updatedAt)}</div>
                        {project.totalApiCost > 0 && (
                          <div className="text-xs text-gray-400">Cost: ${project.totalApiCost.toFixed(4)}</div>
                        )}
                      </div>
                    </div>

                    {/* DNA Status Row */}
                    <div className="flex items-center gap-6 py-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        {getDnaStatus(project.brandDnaStatus)}
                        <span className="text-sm text-gray-600">Brand DNA</span>
                        {project.hasBrandReport && (
                          <span className="text-xs text-green-600">(Report Ready)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getDnaStatus(project.audienceDnaStatus)}
                        <span className="text-sm text-gray-600">Audience DNA</span>
                        {project.personaCount > 0 && (
                          <span className="text-xs text-gray-500">({project.personaCount} personas)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getDnaStatus(project.competitorDnaStatus)}
                        <span className="text-sm text-gray-600">Competitor DNA</span>
                        {project.competitorCount > 0 && (
                          <span className="text-xs text-gray-500">({project.competitorCount} competitors)</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                      <Link
                        href={`/intelligence/${project.id}`}
                        className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        View Details
                      </Link>
                      {project.status === 'completed' && (
                        <Link
                          href={`/campaigns/create?intelligence=${project.id}`}
                          className="px-4 py-2 text-sm bg-green-600 text-white hover:bg-green-700 rounded-lg transition"
                        >
                          Use in Campaign
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">New Intelligence Analysis</h2>
              <p className="text-sm text-gray-500 mt-1">
                Research a brand to generate deep intelligence reports
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g., Q1 2026 Competitor Research"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brand Name *
                </label>
                <input
                  type="text"
                  value={newProject.brandName}
                  onChange={(e) => setNewProject({ ...newProject, brandName: e.target.value })}
                  placeholder="e.g., Acme Corporation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Website Domain
                </label>
                <input
                  type="text"
                  value={newProject.domain}
                  onChange={(e) => setNewProject({ ...newProject, domain: e.target.value })}
                  placeholder="e.g., acme.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Industry
                  </label>
                  <input
                    type="text"
                    value={newProject.industry}
                    onChange={(e) => setNewProject({ ...newProject, industry: e.target.value })}
                    placeholder="e.g., SaaS, Real Estate"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Model
                  </label>
                  <select
                    value={newProject.businessModel}
                    onChange={(e) => setNewProject({ ...newProject, businessModel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="B2B">B2B</option>
                    <option value="B2C">B2C</option>
                    <option value="SaaS">SaaS</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="service">Service</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProject({ name: '', brandName: '', domain: '', industry: '', businessModel: '' });
                }}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProject.name.trim() || !newProject.brandName.trim() || creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? 'Creating...' : 'Create & Start'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
