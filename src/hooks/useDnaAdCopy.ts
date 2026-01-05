'use client';

import { useState, useCallback } from 'react';

/**
 * DNA Project data from the intelligence API
 */
export interface DNAProject {
  id: string;
  name: string;
  brandName: string;
  domain?: string;
  industry?: string;
  brandDnaStatus: string;
  audienceDnaStatus: string;
  hasBrandReport: boolean;
  personaCount: number;
}

/**
 * Brand DNA data structure
 */
export interface BrandDNA {
  businessName?: string;
  missionVision?: string;
  brandPositioning?: string;
  brandVoice?: string;
  brandKeywords?: string[];
  uniqueDifferentiators?: string[];
  targetMarket?: string;
  brandValues?: Array<{ value: string; description: string }>;
}

/**
 * Audience DNA data structure (persona)
 */
export interface AudienceDNA {
  personaName: string;
  personaTitle: string;
  painPoints?: string[];
  goalsAspirations?: string[];
  purchaseMotivations?: string[];
}

/**
 * Generated ad copy result
 */
export interface GeneratedAdCopy {
  headlines: string[];
  longHeadlines: string[];
  descriptions: string[];
  businessName: string;
}

/**
 * Campaign types supported for ad copy generation
 */
export type AdCopyCampaignType = 'PMAX' | 'DISPLAY' | 'DEMAND_GEN' | 'SEARCH' | 'VIDEO';

/**
 * Hook return type
 */
export interface UseDnaAdCopyReturn {
  // State
  dnaProjects: DNAProject[];
  loadingProjects: boolean;
  loadingGeneration: boolean;
  error: string | null;
  applied: boolean;
  selectedProjectId: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  generateFromDna: (projectId: string, campaignType: AdCopyCampaignType) => Promise<GeneratedAdCopy | null>;
  reset: () => void;
}

/**
 * Custom hook for generating ad copy from DNA reports
 *
 * Usage:
 * ```tsx
 * const { dnaProjects, loadingProjects, generateFromDna, applied } = useDnaAdCopy();
 *
 * useEffect(() => {
 *   fetchProjects();
 * }, []);
 *
 * const handleApplyDna = async (projectId: string) => {
 *   const adCopy = await generateFromDna(projectId, 'PMAX');
 *   if (adCopy) {
 *     setHeadlines(adCopy.headlines);
 *     setDescriptions(adCopy.descriptions);
 *   }
 * };
 * ```
 */
export function useDnaAdCopy(): UseDnaAdCopyReturn {
  const [dnaProjects, setDnaProjects] = useState<DNAProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingGeneration, setLoadingGeneration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  /**
   * Fetch available DNA projects
   */
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    setError(null);
    try {
      const response = await fetch('/api/intelligence');
      if (!response.ok) {
        throw new Error('Failed to fetch DNA projects');
      }

      const data = await response.json();

      // Filter to only show projects with completed or in-progress brand DNA
      const availableProjects = (data.projects || []).filter(
        (p: DNAProject) => p.brandDnaStatus === 'completed' || p.hasBrandReport
      );

      setDnaProjects(availableProjects);
    } catch (err) {
      console.error('[useDnaAdCopy] Failed to fetch projects:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch DNA projects');
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  /**
   * Generate ad copy from a DNA project
   */
  const generateFromDna = useCallback(async (
    projectId: string,
    campaignType: AdCopyCampaignType
  ): Promise<GeneratedAdCopy | null> => {
    setLoadingGeneration(true);
    setError(null);
    setSelectedProjectId(projectId);

    try {
      // First, fetch the DNA report data
      const dnaResponse = await fetch(`/api/intelligence/${projectId}`);
      if (!dnaResponse.ok) {
        throw new Error('Failed to fetch DNA report');
      }

      const dnaData = await dnaResponse.json();
      const { project, brandDna } = dnaData;

      if (!brandDna) {
        throw new Error('No brand DNA data found');
      }

      console.log('[useDnaAdCopy] Generating AI-powered ad copy...');

      // Call the AI generation endpoint
      const generateResponse = await fetch('/api/campaigns/wizard/generate-from-dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: project.brandName || brandDna.businessName,
          brandPositioning: brandDna.brandPositioning,
          missionVision: brandDna.missionVision,
          brandVoice: brandDna.brandVoice,
          targetMarket: brandDna.targetMarket,
          uniqueDifferentiators: brandDna.uniqueDifferentiators,
          brandKeywords: brandDna.brandKeywords,
          brandValues: brandDna.brandValues,
          campaignType: campaignType,
        }),
      });

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error || 'Failed to generate ad copy');
      }

      const aiCopy = await generateResponse.json();
      console.log('[useDnaAdCopy] Generated ad copy:', aiCopy);

      const result: GeneratedAdCopy = {
        headlines: aiCopy.headlines || [],
        longHeadlines: aiCopy.longHeadlines || [],
        descriptions: aiCopy.descriptions || [],
        businessName: aiCopy.businessName || project.brandName || '',
      };

      setApplied(true);
      return result;

    } catch (err) {
      console.error('[useDnaAdCopy] Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate ad copy');
      return null;
    } finally {
      setLoadingGeneration(false);
    }
  }, []);

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setApplied(false);
    setSelectedProjectId(null);
    setError(null);
  }, []);

  return {
    dnaProjects,
    loadingProjects,
    loadingGeneration,
    error,
    applied,
    selectedProjectId,
    fetchProjects,
    generateFromDna,
    reset,
  };
}

export default useDnaAdCopy;
