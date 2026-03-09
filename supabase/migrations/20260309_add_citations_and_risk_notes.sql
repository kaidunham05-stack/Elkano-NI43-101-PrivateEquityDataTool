-- Add citations JSONB column for storing field-level source citations
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS citations JSONB;

-- Add missing risk notes columns (infrastructure + geopolitical)
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS infrastructure_notes TEXT;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS geopolitical_notes TEXT;
