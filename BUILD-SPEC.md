# Elkano NI 43-101 Intelligence Platform - Build Spec

## OBJECTIVE
Premium web app for processing NI 43-101 technical reports. Extract key investment metrics, maintain searchable deal flow database.

## TECH STACK
- **Frontend:** Next.js 14+ (App Router) with TypeScript
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Claude API (claude-opus-4-5-20251101)
- **Styling:** Tailwind CSS with Apple-inspired dark design
- **Deployment:** Vercel

## DESIGN SYSTEM (Apple-esque Premium Dark)

### Visual Identity
- Background: Deep black (#000000) with dark gray (#0A0A0A) cards
- Accents: Vibrant orange (#FF6B35) for CTAs, highlights, status
- Typography: Inter for clean, readable text
- Effects: Subtle glass morphism, smooth framer-motion animations, ambient glow on hover

### Layout
- "ELKANO" wordmark top-left (elegant, minimal)
- Spacious padding, generous whitespace
- Clean iconography (Lucide icons)

### Key UI Components
- Drag-and-drop upload zone with animated feedback
- Smooth skeleton loaders during processing
- Card-based extraction results with collapsible sections
- Filterable/sortable data table with premium aesthetics
- Toast notifications with slide animations

## DATABASE SCHEMA (Supabase)

```sql
-- Table: extractions
CREATE TABLE extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  pdf_filename TEXT,
  pdf_url TEXT,
  
  -- Metadata
  issuer_name TEXT,
  project_name TEXT,
  effective_date DATE,
  report_stage TEXT,
  
  -- Project Basics
  primary_commodity TEXT,
  country TEXT,
  province_state TEXT,
  
  -- Resource Estimate
  total_indicated_mt DECIMAL,
  indicated_avg_grade TEXT,
  total_inferred_mt DECIMAL,
  inferred_avg_grade TEXT,
  cutoff_grade TEXT,
  ind_inf_ratio DECIMAL,
  
  -- Economics
  has_economic_study BOOLEAN,
  npv_aftertax_musd DECIMAL,
  irr_aftertax_percent DECIMAL,
  
  -- Risk Assessment
  metallurgy_risk TEXT, -- low/moderate/high
  permitting_risk TEXT, -- low/moderate/high
  
  -- Investment Flags
  investigation_priority TEXT, -- high/medium/low/pass
  next_catalyst TEXT,
  red_flags TEXT[],
  rationale TEXT,
  notes TEXT, -- manual annotations
  
  -- Auto-computed
  status TEXT -- INVESTIGATE/PASS/WATCH
);

-- RLS policies
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extractions" ON extractions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own extractions" ON extractions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extractions" ON extractions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extractions" ON extractions
  FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket: ni43101-pdfs (create in Supabase dashboard, private)
```

## STATUS LOGIC (Auto-computed)

```typescript
function computeStatus(extraction: Extraction): string {
  const { investigation_priority, ind_inf_ratio, metallurgy_risk, 
          report_stage, has_economic_study, permitting_risk } = extraction;
  
  if (investigation_priority === "high" || 
      (ind_inf_ratio && ind_inf_ratio > 2 && metallurgy_risk !== "high") ||
      (report_stage === "PEA" && !has_economic_study)) {
    return "🔍 INVESTIGATE";
  }
  
  if (investigation_priority === "pass" || 
      metallurgy_risk === "high" || 
      permitting_risk === "high") {
    return "❌ PASS";
  }
  
  return "👀 WATCH";
}
```

## EXTRACTION PROMPT (Claude API)

The extraction prompt should:
1. Accept PDF as base64-encoded document
2. Extract all fields from database schema
3. Return structured JSON matching database columns
4. Focus on identifying projects where geological uncertainty collapses faster than market pricing
5. Flag high-priority based on:
   - Indicated/Inferred ratio >2 (upgrade potential)
   - Mature metallurgy for early-stage projects
   - Low-risk jurisdictions (Canada, Australia, US)
   - Recent effective dates (fresh data)
   - PEA/PFS stage without economics (data quality check)

Reference: ../extraction-prompt.md

## FILE STRUCTURE

```
/app
  /layout.tsx           // Root layout with Elkano header
  /page.tsx             // Dashboard (main view)
  /login/page.tsx       // Auth page
  /api
    /extract/route.ts   // API: PDF upload + Claude extraction
    
/components
  /ui                   // Shadcn components (dark theme)
  /UploadZone.tsx       // Drag & drop upload
  /ExtractionsTable.tsx // Data table with filters
  /ExtractionCard.tsx   // Individual extraction display
  /StatusBadge.tsx      // Status indicator
  /Header.tsx           // Elkano header
  
/lib
  /supabase.ts          // Supabase client
  /claude.ts            // Claude API integration
  /extraction-prompt.ts // Extraction prompt template
  /types.ts             // TypeScript interfaces
  /utils.ts             // Status computation, helpers
  
/styles
  /globals.css          // Custom Tailwind dark theme
```

## CORE FEATURES

### A. Upload Flow
1. Drag & drop PDF or click to browse
2. Validate (PDF only, <50MB)
3. Upload to Supabase Storage
4. Show processing animation with status updates
5. Call Claude API with PDF base64
6. Parse JSON response
7. Calculate auto-computed fields (status, ratio)
8. Insert into Supabase extractions table
9. Display formatted results card
10. Add to main dashboard table

### B. Dashboard/History View
- Data table showing all extractions
- Columns: Date | Project | Issuer | Commodity | Country | Stage | Ind/Inf Ratio | Priority | Status | Actions
- Filters: Status, Priority, Commodity, Country, Stage
- Search: Project name, Issuer
- Sort: Any column (default: newest first)
- Row click: Expand to full extraction details
- Export: Download as CSV
- Delete: Remove extraction (with confirmation)

### C. Detail View (Expanded Row or Modal)
- Full extraction data in clean, sectioned layout
- Sections: Metadata | Project | Resources | Economics | Risk | Investment Analysis
- Visual indicators: Green dot (low risk), Yellow (moderate), Red (high)
- Orange "INVESTIGATE" badge for high-priority
- Link to view original PDF
- Notes field for manual annotations (editable)

### D. Authentication
- Supabase Auth with email/password
- Protected routes (redirect to login if not authenticated)
- Simple login page with Elkano branding

## ENVIRONMENT VARIABLES

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## SUCCESS CRITERIA
- Upload PDF → See results in <30 seconds
- Extraction accuracy >90% on key fields
- Intuitive, premium UI that feels effortless
- Fast filtering/searching
- Zero learning curve
- Secure, team-only access
- One-click Vercel deployment

## BUILD ORDER
1. Initialize Next.js project with TypeScript + Tailwind
2. Set up Shadcn UI with dark theme customization
3. Create Supabase client and types
4. Build the extraction API route with Claude integration
5. Create upload zone component
6. Build extractions table with filtering/sorting
7. Add authentication flow
8. Apply premium dark design system throughout
9. Add export functionality
10. Test with sample PDFs
