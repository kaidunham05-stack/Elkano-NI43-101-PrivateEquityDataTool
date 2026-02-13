-- Elkano NI 43-101 Intelligence Platform
-- Supabase Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: extractions
-- Stores extracted data from NI 43-101 technical reports
CREATE TABLE IF NOT EXISTS extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- PDF info
  pdf_filename TEXT,
  pdf_url TEXT,
  
  -- Metadata
  issuer_name TEXT,
  project_name TEXT,
  effective_date DATE,
  report_stage TEXT,
  
  -- Project Basics
  primary_commodity TEXT,
  secondary_commodities TEXT[],
  country TEXT,
  province_state TEXT,
  
  -- Resource Estimate
  total_indicated_mt DECIMAL,
  indicated_avg_grade TEXT,
  total_inferred_mt DECIMAL,
  inferred_avg_grade TEXT,
  total_measured_mt DECIMAL,
  measured_avg_grade TEXT,
  cutoff_grade TEXT,
  resource_date DATE,
  
  -- Economics
  has_economic_study BOOLEAN,
  npv_aftertax_musd DECIMAL,
  npv_discount_rate DECIMAL,
  irr_aftertax_percent DECIMAL,
  capex_musd DECIMAL,
  opex_per_unit TEXT,
  payback_years DECIMAL,
  mine_life_years DECIMAL,
  commodity_price_assumption TEXT,
  
  -- Risk Assessment
  metallurgy_risk TEXT CHECK (metallurgy_risk IN ('low', 'moderate', 'high')),
  metallurgy_notes TEXT,
  permitting_risk TEXT CHECK (permitting_risk IN ('low', 'moderate', 'high')),
  permitting_notes TEXT,
  infrastructure_risk TEXT CHECK (infrastructure_risk IN ('low', 'moderate', 'high')),
  geopolitical_risk TEXT CHECK (geopolitical_risk IN ('low', 'moderate', 'high')),
  
  -- Investment Analysis
  investigation_priority TEXT CHECK (investigation_priority IN ('high', 'medium', 'low', 'pass')),
  priority_rationale TEXT,
  next_catalyst TEXT,
  catalyst_timeline TEXT,
  red_flags TEXT[],
  positive_signals TEXT[],
  magellan_score INTEGER CHECK (magellan_score >= 1 AND magellan_score <= 10),
  
  -- Derived Metrics
  ind_inf_ratio DECIMAL,
  resource_confidence TEXT CHECK (resource_confidence IN ('high', 'moderate', 'low')),
  
  -- User annotations
  notes TEXT,
  
  -- Auto-computed status
  status TEXT CHECK (status IN ('🔍 INVESTIGATE', '👀 WATCH', '❌ PASS'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_extractions_user_id ON extractions(user_id);
CREATE INDEX IF NOT EXISTS idx_extractions_created_at ON extractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extractions_status ON extractions(status);
CREATE INDEX IF NOT EXISTS idx_extractions_priority ON extractions(investigation_priority);
CREATE INDEX IF NOT EXISTS idx_extractions_commodity ON extractions(primary_commodity);
CREATE INDEX IF NOT EXISTS idx_extractions_country ON extractions(country);

-- Enable Row Level Security
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own extractions
CREATE POLICY "Users can view own extractions" ON extractions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extractions" ON extractions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extractions" ON extractions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extractions" ON extractions
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for PDFs
-- NOTE: Create this in Supabase Dashboard > Storage > New bucket
-- Name: ni43101-pdfs
-- Public: false (private bucket)
-- Allowed MIME types: application/pdf
-- Max file size: 52428800 (50MB)

-- Storage policies (run these after creating the bucket)
-- These allow users to manage their own files in user_id/ folders

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('ni43101-pdfs', 'ni43101-pdfs', false)
-- ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY "Users can upload PDFs to own folder"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--   bucket_id = 'ni43101-pdfs' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can view own PDFs"
-- ON storage.objects FOR SELECT
-- USING (
--   bucket_id = 'ni43101-pdfs' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );

-- CREATE POLICY "Users can delete own PDFs"
-- ON storage.objects FOR DELETE
-- USING (
--   bucket_id = 'ni43101-pdfs' AND
--   auth.uid()::text = (storage.foldername(name))[1]
-- );
