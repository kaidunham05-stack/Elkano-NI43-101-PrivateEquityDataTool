import Anthropic from '@anthropic-ai/sdk';
import { extractText } from 'unpdf';
import type { ClaudeExtractionResponse } from './types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `You are an expert mining analyst specializing in NI 43-101 technical reports. Your task is to extract key investment metrics from these reports with high accuracy.

Focus on the Magellan thesis: identifying projects where geological uncertainty is collapsing faster than market pricing. Look for:
- High Indicated/Inferred ratios (geological confidence improving)
- Stage progression signals
- Low metallurgical/permitting risk
- Clear catalysts

Extract data conservatively - if a field is unclear or not present, use null rather than guessing.`;

const EXTRACTION_PROMPT = `Extract the following fields from this NI 43-101 technical report. Return ONLY valid JSON with no additional text.

{
  "metadata": {
    "issuer_name": "string - Company name (issuer of the report)",
    "project_name": "string - Name of the mineral project",
    "effective_date": "string - Report effective date (YYYY-MM-DD format)",
    "report_stage": "string - One of: 'Preliminary Assessment' | 'PEA' | 'Pre-Feasibility' | 'PFS' | 'Feasibility' | 'FS' | 'Resource Update' | 'Technical Report'"
  },
  
  "project_basics": {
    "primary_commodity": "string - Main commodity (e.g., 'lithium', 'copper', 'gold', 'rare earths', 'nickel', 'cobalt')",
    "secondary_commodities": ["array of strings - Other commodities if polymetallic"],
    "country": "string - Country where project is located",
    "province_state": "string - Province, state, or region"
  },
  
  "resource_estimate": {
    "total_indicated_mt": "number or null - Total Indicated resource in million tonnes",
    "indicated_avg_grade": "string or null - Average grade of Indicated resource with units (e.g., '1.2% Li2O', '0.5 g/t Au')",
    "total_inferred_mt": "number or null - Total Inferred resource in million tonnes", 
    "inferred_avg_grade": "string or null - Average grade of Inferred resource with units",
    "total_measured_mt": "number or null - Total Measured resource if available",
    "measured_avg_grade": "string or null - Average grade of Measured resource",
    "cutoff_grade": "string or null - Cutoff grade used for resource estimation",
    "resource_date": "string or null - Date of resource estimate (YYYY-MM-DD)"
  },
  
  "economics": {
    "has_economic_study": "boolean - true if report contains NPV/IRR analysis",
    "npv_aftertax_musd": "number or null - After-tax NPV in millions USD (specify discount rate in notes)",
    "npv_discount_rate": "number or null - Discount rate used for NPV (e.g., 8)",
    "irr_aftertax_percent": "number or null - After-tax IRR as percentage",
    "capex_musd": "number or null - Initial capital expenditure in millions USD",
    "opex_per_unit": "string or null - Operating cost per unit with units (e.g., '$4,500/t Li2CO3')",
    "payback_years": "number or null - Payback period in years",
    "mine_life_years": "number or null - Projected mine life in years",
    "commodity_price_assumption": "string or null - Price assumption used (e.g., '$20,000/t Li2CO3')"
  },
  
  "risk_assessment": {
    "metallurgy_risk": "string - One of: 'low' | 'moderate' | 'high' - Based on: proven flowsheet = low, piloted = moderate, conceptual = high",
    "metallurgy_notes": "string or null - Brief explanation of metallurgy status",
    "permitting_risk": "string - One of: 'low' | 'moderate' | 'high' - Based on: permitted = low, in progress = moderate, not started or contested = high",
    "permitting_notes": "string or null - Brief explanation of permitting status",
    "infrastructure_risk": "string - One of: 'low' | 'moderate' | 'high' - Based on proximity to power, water, roads",
    "geopolitical_risk": "string - One of: 'low' | 'moderate' | 'high' - Based on jurisdiction stability"
  },
  
  "investment_analysis": {
    "investigation_priority": "string - One of: 'high' | 'medium' | 'low' | 'pass'",
    "priority_rationale": "string - 2-3 sentence explanation of priority rating",
    "next_catalyst": "string or null - Expected next material event (e.g., 'PFS expected Q2 2026', 'Drill results pending')",
    "catalyst_timeline": "string or null - Expected timing of next catalyst",
    "red_flags": ["array of strings - Any concerns (e.g., 'High metallurgical complexity', 'Indigenous land claims', 'No clear path to permitting')"],
    "positive_signals": ["array of strings - Bullish indicators (e.g., 'Resource upgrade in progress', 'Strategic investor interest', 'Proven jurisdiction')"],
    "magellan_score": "number 1-10 - How well does this fit the Magellan thesis (geological uncertainty collapsing faster than market pricing)?"
  },
  
  "derived_metrics": {
    "indicated_inferred_ratio": "number or null - Calculated as total_indicated_mt / total_inferred_mt",
    "resource_confidence": "string - 'high' if ratio > 2, 'moderate' if 0.5-2, 'low' if < 0.5"
  }
}

IMPORTANT RULES:
1. Return ONLY the JSON object, no markdown formatting or explanations
2. Use null for fields that cannot be determined from the report
3. For grades, always include units
4. Convert all resource tonnages to MILLION tonnes
5. Convert all currency values to USD millions
6. For risk assessments, err on the side of caution (if unclear, rate as 'moderate')
7. The Magellan score should reflect: high Ind/Inf ratio + low risk + clear catalysts = high score`;

export async function extractFromPdf(pdfBase64: string): Promise<ClaudeExtractionResponse> {
  try {
    // Try native PDF first (works for PDFs <= 100 pages)
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    });

    return parseClaudeResponse(response);
  } catch (error) {
    // Check if it's a "too many pages" error
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('100 PDF pages') || errorMsg.includes('maximum')) {
      console.log('PDF too large, falling back to text extraction...');
      return extractFromPdfText(pdfBase64);
    }
    console.error('Error extracting from PDF:', error);
    throw error;
  }
}

// Fallback: extract text from PDF and send as text
async function extractFromPdfText(pdfBase64: string): Promise<ClaudeExtractionResponse> {
  // Decode and extract text
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const pdfUint8 = new Uint8Array(pdfBuffer);
  const { text: pdfText } = await extractText(pdfUint8);
  
  // Truncate if needed (Claude has ~200k context)
  const maxChars = 150000;
  const truncatedText = pdfText.length > maxChars 
    ? pdfText.slice(0, maxChars) + '\n\n[Document truncated due to length...]'
    : pdfText;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\n---\n\nDOCUMENT TEXT:\n\n${truncatedText}`,
      },
    ],
  });

  return parseClaudeResponse(response);
}

function parseClaudeResponse(response: Anthropic.Message): ClaudeExtractionResponse {
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let jsonText = textContent.text.trim();
  
  // Remove markdown code blocks if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  return JSON.parse(jsonText) as ClaudeExtractionResponse;
}

// Validate the extraction response has required structure
export function validateExtractionResponse(data: unknown): data is ClaudeExtractionResponse {
  if (!data || typeof data !== 'object') return false;
  
  const obj = data as Record<string, unknown>;
  
  // Check for required top-level keys
  const requiredKeys = [
    'metadata',
    'project_basics',
    'resource_estimate',
    'economics',
    'risk_assessment',
    'investment_analysis',
    'derived_metrics'
  ];
  
  for (const key of requiredKeys) {
    if (!(key in obj)) return false;
  }
  
  return true;
}
