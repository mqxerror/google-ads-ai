'use client';

import React, { useEffect, useState } from 'react';
import { useDnaAdCopy, type DNAProject, type AdCopyCampaignType, type GeneratedAdCopy } from '@/hooks/useDnaAdCopy';

interface DnaAdCopySelectorProps {
  campaignType: AdCopyCampaignType;
  onAdCopyGenerated: (adCopy: GeneratedAdCopy) => void;
  onProjectSelected?: (project: DNAProject | null) => void;
  className?: string;
}

interface ProjectDetails {
  brandDna?: {
    businessName?: string;
    missionVision?: string;
    brandPositioning?: string;
    industry?: string;
    targetMarket?: string;
  };
  audiences?: Array<{
    id: string;
    personaName: string;
    personaTitle: string;
  }>;
}

/**
 * Reusable component for selecting a DNA project and generating ad copy
 * Shows dropdown selection with project details and audiences
 */
export function DnaAdCopySelector({
  campaignType,
  onAdCopyGenerated,
  onProjectSelected,
  className = '',
}: DnaAdCopySelectorProps) {
  const {
    dnaProjects,
    loadingProjects,
    loadingGeneration,
    error,
    applied,
    selectedProjectId,
    fetchProjects,
    generateFromDna,
    reset,
  } = useDnaAdCopy();

  const [projectDetails, setProjectDetails] = useState<ProjectDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch project details when a project is selected
  const fetchProjectDetails = async (projectId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/intelligence/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProjectDetails({
          brandDna: data.brandDna,
          audiences: data.audiences || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch project details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    if (!projectId) {
      reset();
      setProjectDetails(null);
      onProjectSelected?.(null);
      return;
    }

    const project = dnaProjects.find(p => p.id === projectId);
    onProjectSelected?.(project || null);

    // Fetch project details for display
    await fetchProjectDetails(projectId);

    // Generate ad copy
    const adCopy = await generateFromDna(projectId, campaignType);
    if (adCopy) {
      onAdCopyGenerated(adCopy);
    }
  };

  const handleReset = () => {
    reset();
    setProjectDetails(null);
    onProjectSelected?.(null);
  };

  const selectedProject = dnaProjects.find(p => p.id === selectedProjectId);

  return (
    <div className={`p-4 bg-accent/5 border border-accent/20 rounded-xl ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">🧬</span>
        <div className="flex-1">
          <h3 className="font-medium text-accent mb-1">Generate from DNA Report</h3>
          <p className="text-sm text-text3 mb-3">
            AI-powered ad copy generation using your brand intelligence
          </p>

          {/* Error state */}
          {error && (
            <div className="mb-3 p-2 bg-danger/10 border border-danger/20 rounded text-sm text-danger">
              {error}
            </div>
          )}

          {/* Loading projects */}
          {loadingProjects ? (
            <div className="flex items-center gap-2 text-sm text-text3">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading DNA reports...
            </div>
          ) : dnaProjects.length > 0 ? (
            <div className="space-y-3">
              {/* Dropdown Selection */}
              <div className="relative">
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  disabled={loadingGeneration || applied}
                  className="w-full px-4 py-3 bg-surface border border-divider rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a DNA Report...</option>
                  {dnaProjects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.brandName}
                      {project.industry ? ` • ${project.industry}` : ''}
                      {project.personaCount > 0 ? ` • ${project.personaCount} audience${project.personaCount !== 1 ? 's' : ''}` : ''}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {loadingGeneration ? (
                    <svg className="animate-spin h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-text3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Loading generation message */}
              {loadingGeneration && (
                <div className="flex items-center gap-2 text-sm text-accent p-2 bg-accent/10 rounded-lg">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating AI-powered ad copy from brand intelligence...
                </div>
              )}

              {/* Applied state - show project details */}
              {applied && selectedProject && (
                <div className="space-y-3">
                  {/* Success banner */}
                  <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-success font-medium">Ad copy generated successfully</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 text-sm bg-surface border border-divider rounded-lg hover:border-accent transition-colors"
                    >
                      Change
                    </button>
                  </div>

                  {/* Project Details Card */}
                  <div className="p-3 bg-surface border border-divider rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-text">{selectedProject.brandName}</h4>
                        {selectedProject.industry && (
                          <p className="text-xs text-text3">{selectedProject.industry}</p>
                        )}
                        {selectedProject.domain && (
                          <p className="text-xs text-accent">{selectedProject.domain}</p>
                        )}
                      </div>
                      <span className="px-2 py-0.5 bg-success/10 text-success text-xs rounded-full">
                        {selectedProject.brandDnaStatus}
                      </span>
                    </div>

                    {/* Brand positioning snippet */}
                    {projectDetails?.brandDna?.brandPositioning && (
                      <div className="mt-2 pt-2 border-t border-divider">
                        <p className="text-xs text-text3 line-clamp-2">
                          {projectDetails.brandDna.brandPositioning}
                        </p>
                      </div>
                    )}

                    {/* Audiences */}
                    {projectDetails?.audiences && projectDetails.audiences.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-divider">
                        <p className="text-xs text-text3 mb-2">Target Audiences:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {projectDetails.audiences.map((audience, idx) => (
                            <span
                              key={audience.id || idx}
                              className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-full"
                              title={audience.personaTitle}
                            >
                              {audience.personaName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Loading details */}
                    {loadingDetails && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-text3">
                        <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading details...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty state */
            <div className="text-sm text-text3">
              <p className="mb-2">No DNA reports available yet.</p>
              <a
                href="/intelligence"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                Create a Brand DNA Report
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DnaAdCopySelector;
