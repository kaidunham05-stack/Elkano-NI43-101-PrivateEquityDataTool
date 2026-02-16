import OpenAI from 'openai';
import { extractText } from 'unpdf';
import type { ClaudeExtractionResponse } from './types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const SYSTEM_PROMPT = `You are an expert mining analyst specializing in NI 43-101 technical reports. Extract key investment metrics with high accuracy. Focus on the Magellan thesis: projects where geological uncertainty is collapsing faster than market pricing.`;

const EXTRACTION_PROMPT = `Extract the following fields from this NI 43-101 technical report. Return ONLY valid JSON with no additional text.

{
  "metadata": {
    "issuer_name": "string",
    "project_name": "string",
    "effective_date": "string (YYYY-MM-DD)",
    "report_stage": "string"
  },
  "project_basics": {
    "primary_commodity": "string",
    "secondary_commodities": ["array"],
    "country": "string",
    "province_state": "string"
  },
  "resource_estimate": {
    "total_indicated_mt": "number or null",
    "indicated_avg_grade": "string or null",
    "total_inferred_mt": "number or null",
    "inferred_avg_grade": "string or null",
    "total_measured_mt": "number or null",
    "measured_avg_grade": "string or null",
    "cutoff_grade": "string or null",
    "resource_date": "string or null"
  },
  "economics": {
    "has_economic_study": "boolean",
    "npv_aftertax_musd": "number or null",
    "npv_discount_rate": "number or null",
    "irr_aftertax_percent": "number or null",
    "capex_musd": "number or null",
    "opex_per_unit": "string or null",
    "payback_years": "number or null",
    "mine_life_years": "number or null",
    "commodity_price_assumption": "string or null"
  },
  "risk_assessment": {
    "metallurgy_risk": "'low' | 'moderate' | 'high'",
    "metallurgy_notes": "string or null",
    "permitting_risk": "'low' | 'moderate' | 'high'",
    "permitting_notes": "string or null",
    "infrastructure_risk": "'low' | 'moderate' | 'high'",
    "geopolitical_risk": "'low' | 'moderate' | 'high'"
  },
  "investment_analysis": {
    "investigation_priority": "'high' | 'medium' | 'low' | 'pass'",
    "priority_rationale": "string",
    "next_catalyst": "string or null",
    "catalyst_timeline": "string or null",
    "red_flags": ["array"],
    "positive_signals": ["array"],
    "magellan_score": "number 1-10"
  },
  "derived_metrics": {
    "indicated_inferred_ratio": "number or null",
    "resource_confidence": "'high' | 'moderate' | 'low'"
  }
}

Return ONLY the JSON object.`;

export async function extractFromPdf(pdfBase64: string): Promise<ClaudeExtractionResponse> {
  try {
    // Decode base64 to Uint8Array
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfUint8 = new Uint8Array(pdfBuffer);
    
    // Extract text from PDF using unpdf
    const { text: pdfText } = await extractText(pdfUint8);
    
    // Truncate if too long (GPT-4o has 128k context)
    const maxChars = 100000;
    const truncatedText = pdfText.length > maxChars 
      ? pdfText.slice(0, maxChars) + '\n\n[Document truncated...]'
      : pdfText;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 8000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${EXTRACTION_PROMPT}\n\n---\n\nDOCUMENT:\n\n${truncatedText}` },
      ],
    });

    const textContent = response.choices[0]?.message?.content;
    if (!textContent) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let jsonText = textContent.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
    else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
    jsonText = jsonText.trim();

    return JSON.parse(jsonText) as ClaudeExtractionResponse;
  } catch (error) {
    console.error('Error extracting from PDF:', error);
    throw error;
  }
}
