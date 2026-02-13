// Database Types - matches Supabase schema

export interface Extraction {
  id: string;
  created_at: string;
  user_id: string;
  pdf_filename: string | null;
  pdf_url: string | null;
  
  // Metadata
  issuer_name: string | null;
  project_name: string | null;
  effective_date: string | null;
  report_stage: ReportStage | null;
  
  // Project Basics
  primary_commodity: string | null;
  secondary_commodities: string[] | null;
  country: string | null;
  province_state: string | null;
  
  // Resource Estimate
  total_indicated_mt: number | null;
  indicated_avg_grade: string | null;
  total_inferred_mt: number | null;
  inferred_avg_grade: string | null;
  total_measured_mt: number | null;
  measured_avg_grade: string | null;
  cutoff_grade: string | null;
  resource_date: string | null;
  
  // Economics
  has_economic_study: boolean | null;
  npv_aftertax_musd: number | null;
  npv_discount_rate: number | null;
  irr_aftertax_percent: number | null;
  capex_musd: number | null;
  opex_per_unit: string | null;
  payback_years: number | null;
  mine_life_years: number | null;
  commodity_price_assumption: string | null;
  
  // Risk Assessment
  metallurgy_risk: RiskLevel | null;
  metallurgy_notes: string | null;
  permitting_risk: RiskLevel | null;
  permitting_notes: string | null;
  infrastructure_risk: RiskLevel | null;
  geopolitical_risk: RiskLevel | null;
  
  // Investment Analysis
  investigation_priority: Priority | null;
  priority_rationale: string | null;
  next_catalyst: string | null;
  catalyst_timeline: string | null;
  red_flags: string[] | null;
  positive_signals: string[] | null;
  magellan_score: number | null;
  
  // Derived Metrics
  ind_inf_ratio: number | null;
  resource_confidence: ResourceConfidence | null;
  
  // Notes (user annotations)
  notes: string | null;
  
  // Auto-computed status
  status: Status | null;
}

export type ReportStage = 
  | 'Preliminary Assessment'
  | 'PEA'
  | 'Pre-Feasibility'
  | 'PFS'
  | 'Feasibility'
  | 'FS'
  | 'Resource Update'
  | 'Technical Report';

export type RiskLevel = 'low' | 'moderate' | 'high';

export type Priority = 'high' | 'medium' | 'low' | 'pass';

export type ResourceConfidence = 'high' | 'moderate' | 'low';

export type Status = '🔍 INVESTIGATE' | '👀 WATCH' | '❌ PASS';

// Claude API extraction response type
export interface ClaudeExtractionResponse {
  metadata: {
    issuer_name: string | null;
    project_name: string | null;
    effective_date: string | null;
    report_stage: string | null;
  };
  project_basics: {
    primary_commodity: string | null;
    secondary_commodities: string[] | null;
    country: string | null;
    province_state: string | null;
  };
  resource_estimate: {
    total_indicated_mt: number | null;
    indicated_avg_grade: string | null;
    total_inferred_mt: number | null;
    inferred_avg_grade: string | null;
    total_measured_mt: number | null;
    measured_avg_grade: string | null;
    cutoff_grade: string | null;
    resource_date: string | null;
  };
  economics: {
    has_economic_study: boolean | null;
    npv_aftertax_musd: number | null;
    npv_discount_rate: number | null;
    irr_aftertax_percent: number | null;
    capex_musd: number | null;
    opex_per_unit: string | null;
    payback_years: number | null;
    mine_life_years: number | null;
    commodity_price_assumption: string | null;
  };
  risk_assessment: {
    metallurgy_risk: RiskLevel | null;
    metallurgy_notes: string | null;
    permitting_risk: RiskLevel | null;
    permitting_notes: string | null;
    infrastructure_risk: RiskLevel | null;
    geopolitical_risk: RiskLevel | null;
  };
  investment_analysis: {
    investigation_priority: Priority | null;
    priority_rationale: string | null;
    next_catalyst: string | null;
    catalyst_timeline: string | null;
    red_flags: string[] | null;
    positive_signals: string[] | null;
    magellan_score: number | null;
  };
  derived_metrics: {
    indicated_inferred_ratio: number | null;
    resource_confidence: ResourceConfidence | null;
  };
}

// Insert type (for creating new extractions)
export type ExtractionInsert = Omit<Extraction, 'id' | 'created_at'>;

// Filter/Sort types for the table
export interface ExtractionFilters {
  status?: Status | 'all';
  priority?: Priority | 'all';
  commodity?: string | 'all';
  country?: string | 'all';
  stage?: ReportStage | 'all';
  search?: string;
}

export type SortField = 
  | 'created_at'
  | 'project_name'
  | 'issuer_name'
  | 'primary_commodity'
  | 'country'
  | 'report_stage'
  | 'ind_inf_ratio'
  | 'investigation_priority'
  | 'status';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

// Upload state
export type UploadState = 
  | 'idle'
  | 'validating'
  | 'uploading'
  | 'processing'
  | 'extracting'
  | 'saving'
  | 'complete'
  | 'error';

export interface UploadProgress {
  state: UploadState;
  message: string;
  progress?: number;
  error?: string;
}

// Utility functions
export function computeStatus(extraction: Partial<Extraction>): Status {
  const { 
    investigation_priority, 
    ind_inf_ratio, 
    metallurgy_risk,
    report_stage, 
    has_economic_study, 
    permitting_risk 
  } = extraction;
  
  // High priority signals - INVESTIGATE
  if (
    investigation_priority === 'high' || 
    (ind_inf_ratio && ind_inf_ratio > 2 && metallurgy_risk !== 'high') ||
    ((report_stage === 'PEA' || report_stage === 'Preliminary Assessment') && !has_economic_study)
  ) {
    return '🔍 INVESTIGATE';
  }
  
  // Red flags - PASS
  if (
    investigation_priority === 'pass' || 
    metallurgy_risk === 'high' || 
    permitting_risk === 'high'
  ) {
    return '❌ PASS';
  }
  
  // Default - WATCH
  return '👀 WATCH';
}

export function computeIndInfRatio(
  indicated: number | null, 
  inferred: number | null
): number | null {
  if (!indicated || !inferred || inferred === 0) return null;
  return Number((indicated / inferred).toFixed(2));
}

export function computeResourceConfidence(ratio: number | null): ResourceConfidence | null {
  if (ratio === null) return null;
  if (ratio > 2) return 'high';
  if (ratio >= 0.5) return 'moderate';
  return 'low';
}

// Transform Claude response to database insert
export function transformClaudeResponseToExtraction(
  response: ClaudeExtractionResponse,
  userId: string,
  pdfFilename: string,
  pdfUrl: string
): ExtractionInsert {
  const indInfRatio = computeIndInfRatio(
    response.resource_estimate.total_indicated_mt,
    response.resource_estimate.total_inferred_mt
  );
  
  const resourceConfidence = computeResourceConfidence(indInfRatio);
  
  const extraction: ExtractionInsert = {
    user_id: userId,
    pdf_filename: pdfFilename,
    pdf_url: pdfUrl,
    
    // Metadata
    issuer_name: response.metadata.issuer_name,
    project_name: response.metadata.project_name,
    effective_date: response.metadata.effective_date,
    report_stage: response.metadata.report_stage as ReportStage | null,
    
    // Project Basics
    primary_commodity: response.project_basics.primary_commodity,
    secondary_commodities: response.project_basics.secondary_commodities,
    country: response.project_basics.country,
    province_state: response.project_basics.province_state,
    
    // Resource Estimate
    total_indicated_mt: response.resource_estimate.total_indicated_mt,
    indicated_avg_grade: response.resource_estimate.indicated_avg_grade,
    total_inferred_mt: response.resource_estimate.total_inferred_mt,
    inferred_avg_grade: response.resource_estimate.inferred_avg_grade,
    total_measured_mt: response.resource_estimate.total_measured_mt,
    measured_avg_grade: response.resource_estimate.measured_avg_grade,
    cutoff_grade: response.resource_estimate.cutoff_grade,
    resource_date: response.resource_estimate.resource_date,
    
    // Economics
    has_economic_study: response.economics.has_economic_study,
    npv_aftertax_musd: response.economics.npv_aftertax_musd,
    npv_discount_rate: response.economics.npv_discount_rate,
    irr_aftertax_percent: response.economics.irr_aftertax_percent,
    capex_musd: response.economics.capex_musd,
    opex_per_unit: response.economics.opex_per_unit,
    payback_years: response.economics.payback_years,
    mine_life_years: response.economics.mine_life_years,
    commodity_price_assumption: response.economics.commodity_price_assumption,
    
    // Risk Assessment
    metallurgy_risk: response.risk_assessment.metallurgy_risk,
    metallurgy_notes: response.risk_assessment.metallurgy_notes,
    permitting_risk: response.risk_assessment.permitting_risk,
    permitting_notes: response.risk_assessment.permitting_notes,
    infrastructure_risk: response.risk_assessment.infrastructure_risk,
    geopolitical_risk: response.risk_assessment.geopolitical_risk,
    
    // Investment Analysis
    investigation_priority: response.investment_analysis.investigation_priority,
    priority_rationale: response.investment_analysis.priority_rationale,
    next_catalyst: response.investment_analysis.next_catalyst,
    catalyst_timeline: response.investment_analysis.catalyst_timeline,
    red_flags: response.investment_analysis.red_flags,
    positive_signals: response.investment_analysis.positive_signals,
    magellan_score: response.investment_analysis.magellan_score,
    
    // Derived Metrics
    ind_inf_ratio: indInfRatio,
    resource_confidence: resourceConfidence,
    
    // Notes (empty initially)
    notes: null,
    
    // Status will be computed
    status: null
  };
  
  // Compute status
  extraction.status = computeStatus(extraction);
  
  return extraction;
}

// Priority sort order
export const priorityOrder: Record<Priority, number> = {
  'high': 1,
  'medium': 2,
  'low': 3,
  'pass': 4
};

// Status sort order
export const statusOrder: Record<Status, number> = {
  '🔍 INVESTIGATE': 1,
  '👀 WATCH': 2,
  '❌ PASS': 3
};
