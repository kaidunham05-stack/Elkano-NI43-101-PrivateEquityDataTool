-- Migration: Add all new JSONB columns for Fraxia intelligence features
-- Run this on your live Supabase database

-- Citations (Task 1)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS citations JSONB;

-- Risk notes (Task 1/3)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS infrastructure_notes TEXT;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS geopolitical_notes TEXT;

-- Magellan Score Breakdown (Task 2)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS magellan_score_breakdown JSONB;

-- Learning Velocity (Task 3)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS learning_velocity JSONB;

-- Jurisdiction Intelligence (Task 4)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS jurisdiction_intel JSONB;

-- Exit Phenotype (Task 5)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS exit_phenotype JSONB;

-- Qualified Person (Task 6)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS qualified_person JSONB;
