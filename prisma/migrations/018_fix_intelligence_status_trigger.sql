-- =====================================================
-- Migration: 018_fix_intelligence_status_trigger
-- Description: Fix the update_project_status trigger to map
--              brand_dna statuses correctly to project statuses
-- Created: 2026-01-04
-- =====================================================

-- Drop and recreate the trigger function with correct status mapping
CREATE OR REPLACE FUNCTION update_project_status()
RETURNS TRIGGER AS $$
DECLARE
    v_project_id UUID;
    v_brand_status TEXT;
    v_audience_status TEXT;
    v_competitor_status TEXT;
    v_new_status TEXT;
    v_raw_brand_status TEXT;
BEGIN
    -- Get project_id from the changed row
    v_project_id := COALESCE(NEW.project_id, OLD.project_id);

    -- Get current statuses
    SELECT brand_dna_status, audience_dna_status, competitor_dna_status
    INTO v_brand_status, v_audience_status, v_competitor_status
    FROM intelligence_projects
    WHERE id = v_project_id;

    -- Override with new value if this is the corresponding table
    IF TG_TABLE_NAME = 'brand_dna' THEN
        -- Get raw status from brand_dna
        v_raw_brand_status := COALESCE(NEW.status, 'pending');

        -- Map brand_dna.status to project.brand_dna_status
        -- brand_dna allows: pending, researching, scraping, analyzing, completed, failed
        -- project allows: pending, in_progress, completed, failed
        v_brand_status := CASE v_raw_brand_status
            WHEN 'pending' THEN 'pending'
            WHEN 'researching' THEN 'in_progress'
            WHEN 'scraping' THEN 'in_progress'
            WHEN 'analyzing' THEN 'in_progress'
            WHEN 'completed' THEN 'completed'
            WHEN 'failed' THEN 'failed'
            ELSE 'pending'
        END;

    ELSIF TG_TABLE_NAME = 'audience_dna' THEN
        -- For audience, check if ALL personas are complete
        SELECT CASE
            WHEN COUNT(*) = 0 THEN 'pending'
            WHEN COUNT(*) FILTER (WHERE status = 'completed') = COUNT(*) THEN 'completed'
            WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 THEN 'failed'
            ELSE 'in_progress'
        END INTO v_audience_status
        FROM audience_dna
        WHERE project_id = v_project_id;

    ELSIF TG_TABLE_NAME = 'competitor_dna' THEN
        -- For competitors, check if ALL are complete
        SELECT CASE
            WHEN COUNT(*) = 0 THEN 'pending'
            WHEN COUNT(*) FILTER (WHERE status = 'completed') = COUNT(*) THEN 'completed'
            WHEN COUNT(*) FILTER (WHERE status = 'failed') > 0 THEN 'failed'
            ELSE 'in_progress'
        END INTO v_competitor_status
        FROM competitor_dna
        WHERE project_id = v_project_id;
    END IF;

    -- Determine overall project status
    IF v_brand_status = 'failed' OR v_audience_status = 'failed' OR v_competitor_status = 'failed' THEN
        v_new_status := 'failed';
    ELSIF v_brand_status = 'completed' AND v_audience_status = 'completed' AND v_competitor_status = 'completed' THEN
        v_new_status := 'completed';
    ELSIF v_brand_status = 'pending' AND v_audience_status = 'pending' AND v_competitor_status = 'pending' THEN
        v_new_status := 'draft';
    ELSE
        v_new_status := 'analyzing';
    END IF;

    -- Update project
    UPDATE intelligence_projects
    SET
        brand_dna_status = v_brand_status,
        audience_dna_status = v_audience_status,
        competitor_dna_status = v_competitor_status,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_project_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The triggers already exist and will use the updated function
-- No need to recreate them

-- =====================================================
-- Verification Query
-- =====================================================
-- Test the function by checking a brand_dna record:
-- SELECT bd.status as brand_dna_status, ip.brand_dna_status as project_brand_dna_status
-- FROM brand_dna bd
-- JOIN intelligence_projects ip ON ip.id = bd.project_id
-- LIMIT 5;
