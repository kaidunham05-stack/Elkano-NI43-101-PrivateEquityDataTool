/**
 * SEDAR+ NI 43-101 Ingestion Script
 *
 * Scrapes recent NI 43-101 filings from sedarplus.ca, downloads PDFs,
 * runs them through the Claude extraction pipeline, and saves structured JSON.
 *
 * Usage: npx tsx scripts/sedar-ingest.ts
 *
 * Environment: ANTHROPIC_API_KEY must be set.
 * Does NOT touch UI or database — output goes to data/benchmarks/.
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------- Constants ----------

const SEDAR_SEARCH_URL = 'https://www.sedarplus.ca/csa-party/records/filter';
const BENCHMARKS_DIR = join(process.cwd(), 'data', 'benchmarks');
const LOG_FILE = join(BENCHMARKS_DIR, 'ingest-log.txt');
const MAX_FILINGS = 10;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const EXTRACTION_TIMEOUT_MS = 180_000;

// ---------- Helpers ----------

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  appendFileSync(LOG_FILE, line + '\n');
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80);
}

// ---------- SEDAR+ API ----------

interface SedarFiling {
  id: string;
  issuerName: string;
  projectName: string;
  filingDate: string;
  documentUrl: string;
}

/**
 * Search SEDAR+ for recent NI 43-101 filings.
 * SEDAR+ uses a JSON API behind its search form. We replicate the POST request.
 * If the API structure changes, this will need updating.
 */
async function fetchRecentFilings(): Promise<SedarFiling[]> {
  log(`Fetching up to ${MAX_FILINGS} recent NI 43-101 filings from SEDAR+...`);

  // SEDAR+ search API — filter for NI 43-101 Technical Reports
  // The category filter "Technical Report - NI 43-101" narrows to mining reports
  const searchPayload = {
    from: 0,
    size: MAX_FILINGS,
    query: 'NI 43-101',
    dateRange: {
      startDate: null,
      endDate: null,
    },
    categories: ['Technical Report'],
    sort: ['DATE_DESC'],
  };

  try {
    const response = await fetch(SEDAR_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Fraxia-Ingest/1.0 (research)',
      },
      body: JSON.stringify(searchPayload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      log(`SEDAR+ API returned ${response.status}. The API may have changed.`);
      log('Falling back to manual URLs...');
      return [];
    }

    // SEDAR+ uses bot protection (PerimeterX/StormCaster) that returns HTML
    // challenge pages instead of JSON. Detect this and fall back gracefully.
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html') || !contentType.includes('json')) {
      log('SEDAR+ returned an HTML challenge page (bot protection active).');
      log('Automated scraping requires a headless browser with challenge solving.');
      log('Falling back to manual URLs...');
      return [];
    }

    const data = await response.json() as Record<string, unknown>;

    // Parse the response — SEDAR+ returns { results: [...] } or similar
    const results = (data.results || data.hits || data.data || []) as Record<string, unknown>[];

    const filings: SedarFiling[] = [];
    for (const item of results) {
      try {
        const filing: SedarFiling = {
          id: String(item.id || item.filingId || ''),
          issuerName: String(item.issuerName || item.companyName || item.issuer || 'Unknown'),
          projectName: String(item.projectName || item.subject || item.title || 'Unknown'),
          filingDate: String(item.filingDate || item.dateFiled || item.date || ''),
          documentUrl: String(item.documentUrl || item.fileUrl || item.url || ''),
        };

        if (filing.documentUrl && filing.documentUrl.includes('.pdf')) {
          filings.push(filing);
        }
      } catch {
        // Skip malformed entries
      }
    }

    log(`Found ${filings.length} filings with PDF documents`);
    return filings.slice(0, MAX_FILINGS);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`SEDAR+ fetch failed: ${msg}`);
    log('Note: SEDAR+ may require browser-like headers or have changed their API.');
    log('You can manually add PDF URLs to this script for batch processing.');
    return [];
  }
}

// ---------- PDF Download ----------

async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Fraxia-Ingest/1.0 (research)',
      },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });

    if (!response.ok) {
      log(`  Download failed (${response.status}): ${url}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      log(`  Not a PDF (${contentType}): ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`  Download error: ${msg}`);
    return null;
  }
}

// ---------- Extraction (reuses existing pipeline) ----------

async function extractFromPdfBuffer(pdfBuffer: Buffer): Promise<Record<string, unknown> | null> {
  // Dynamic import to handle the module resolution for the extraction logic
  // We directly use the Anthropic SDK here instead of importing from src/lib
  // because the source module uses Next.js-specific imports
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const { extractText } = await import('unpdf');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log('ERROR: ANTHROPIC_API_KEY not set');
    return null;
  }

  const anthropic = new Anthropic({ apiKey });

  // Read the current extraction prompt from claude.ts by importing it at runtime
  // For standalone usage, we use the text extraction path directly
  const pdfUint8 = new Uint8Array(pdfBuffer);
  let pdfText: string;
  try {
    const result = await extractText(pdfUint8);
    pdfText = Array.isArray(result.text) ? result.text.join('\n') : String(result.text);
  } catch {
    log('  Failed to extract text from PDF');
    return null;
  }

  if (!pdfText || pdfText.trim().length < 100) {
    log('  PDF text too short, likely scanned/image PDF');
    return null;
  }

  // Truncate for context window
  const maxChars = 150000;
  const truncatedText = pdfText.length > maxChars
    ? pdfText.slice(0, maxChars) + '\n\n[Document truncated due to length...]'
    : pdfText;

  // Use a minimal version of the extraction prompt for benchmarking
  const SYSTEM = `You are an expert mining analyst specializing in NI 43-101 technical reports. Extract data conservatively — use null for uncertain fields.`;

  const PROMPT = `Extract key fields from this NI 43-101 report. Return ONLY valid JSON:
{
  "metadata": { "issuer_name": "string", "project_name": "string", "effective_date": "string", "report_stage": "string" },
  "project_basics": { "primary_commodity": "string", "country": "string", "province_state": "string" },
  "resource_estimate": { "total_indicated_mt": "number|null", "indicated_avg_grade": "string|null", "total_inferred_mt": "number|null", "inferred_avg_grade": "string|null" },
  "economics": { "has_economic_study": "boolean", "npv_aftertax_musd": "number|null", "irr_aftertax_percent": "number|null", "capex_musd": "number|null" },
  "risk_assessment": { "metallurgy_risk": "low|moderate|high", "permitting_risk": "low|moderate|high" },
  "investment_analysis": { "investigation_priority": "high|medium|low|pass", "magellan_score": "1-10" }
}

DOCUMENT TEXT:

${truncatedText}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: 'user', content: PROMPT }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return null;

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7);
    else if (jsonText.startsWith('```')) jsonText = jsonText.slice(3);
    if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3);
    jsonText = jsonText.trim();

    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log(`  Extraction error: ${msg}`);
    return null;
  }
}

// ---------- Main ----------

async function main() {
  if (!existsSync(BENCHMARKS_DIR)) {
    mkdirSync(BENCHMARKS_DIR, { recursive: true });
  }

  log('=== SEDAR+ NI 43-101 Ingestion Started ===');
  log(`Output directory: ${BENCHMARKS_DIR}`);

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    log('ERROR: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const filings = await fetchRecentFilings();

  if (filings.length === 0) {
    log('No filings found. SEDAR+ API may have changed or be rate-limited.');
    log('');
    log('To manually process PDFs, add URLs to the manualUrls array in this script.');
    log('');

    // Manual fallback — users can add PDF URLs here for batch processing
    const manualUrls: { url: string; issuer: string; project: string; date: string }[] = [
      // Example:
      // { url: 'https://example.com/report.pdf', issuer: 'Acme Mining', project: 'Goldfield', date: '2025-01-15' },
    ];

    if (manualUrls.length === 0) {
      log('No manual URLs configured. Exiting.');
      log('=== Ingestion Complete ===');
      return;
    }

    for (const entry of manualUrls) {
      await processUrl(entry.url, entry.issuer, entry.project, entry.date);
    }
  } else {
    let successes = 0;
    let failures = 0;

    for (let i = 0; i < filings.length; i++) {
      const filing = filings[i];
      log(`\n[${i + 1}/${filings.length}] Processing: ${filing.issuerName} — ${filing.projectName}`);

      const success = await processUrl(
        filing.documentUrl,
        filing.issuerName,
        filing.projectName,
        filing.filingDate
      );

      if (success) successes++;
      else failures++;

      // Rate limit: wait between extractions to avoid API throttling
      if (i < filings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    log(`\n=== Ingestion Complete ===`);
    log(`Successes: ${successes} | Failures: ${failures} | Total: ${filings.length}`);
  }
}

async function processUrl(
  url: string,
  issuerName: string,
  projectName: string,
  filingDate: string
): Promise<boolean> {
  // Download PDF
  log(`  Downloading: ${url.slice(0, 100)}...`);
  const pdfBuffer = await downloadPdf(url);
  if (!pdfBuffer) {
    log(`  FAILED: Could not download PDF`);
    return false;
  }
  log(`  Downloaded ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Extract
  log(`  Extracting with Claude...`);
  const extracted = await extractFromPdfBuffer(pdfBuffer);
  if (!extracted) {
    log(`  FAILED: Extraction returned null`);
    return false;
  }

  // Save JSON
  const dateStr = filingDate ? filingDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const filename = `${sanitizeFilename(issuerName)}_${sanitizeFilename(projectName)}_${dateStr}.json`;
  const outputPath = join(BENCHMARKS_DIR, filename);

  const output = {
    _meta: {
      source_url: url,
      issuer_name: issuerName,
      project_name: projectName,
      filing_date: filingDate,
      extracted_at: new Date().toISOString(),
    },
    ...extracted,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  log(`  SUCCESS: Saved to ${filename}`);
  return true;
}

// Run
main().catch((error) => {
  log(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
