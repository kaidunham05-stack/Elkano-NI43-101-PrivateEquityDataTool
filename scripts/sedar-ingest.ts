#!/usr/bin/env npx tsx
/**
 * Fraxia SEDAR+ NI 43-101 Ingestion CLI
 *
 * Powerful CLI tool for ingesting NI 43-101 technical reports into
 * structured benchmark datasets. Supports filters, buckets, pause mode,
 * and a --watch mode that monitors a local folder for new PDFs.
 *
 * SEDAR+ uses bot protection, so the primary input methods are:
 *   1. Manual URL array (edit MANUAL_URLS below)
 *   2. --watch mode: drop PDFs into ~/Downloads/sedar-pdfs/
 *
 * Usage:
 *   npx tsx scripts/sedar-ingest.ts --commodity silver --bucket silver --limit 5
 *   npx tsx scripts/sedar-ingest.ts --watch --bucket canada-copper --pause
 *   npx tsx scripts/sedar-ingest.ts --dry-run --commodity gold
 *   npx tsx scripts/sedar-ingest.ts --help
 *
 * Environment: ANTHROPIC_API_KEY must be set.
 * Output goes to data/benchmarks/<bucket>/
 */

import {
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  watch,
} from 'fs';
import { join, basename, extname } from 'path';
import { createInterface } from 'readline';
import { homedir } from 'os';

// ============================================================
// CLI ARGUMENT PARSING
// ============================================================

interface CLIOptions {
  commodity: string | null;
  jurisdiction: string | null;
  stage: string | null;
  limit: number;
  pause: boolean;
  bucket: string;
  dryRun: boolean;
  watch: boolean;
  help: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const opts: CLIOptions = {
    commodity: null,
    jurisdiction: null,
    stage: null,
    limit: 10,
    pause: false,
    bucket: 'general',
    dryRun: false,
    watch: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--commodity':
        opts.commodity = args[++i]?.toLowerCase() ?? null;
        break;
      case '--jurisdiction':
        opts.jurisdiction = args[++i]?.toLowerCase() ?? null;
        break;
      case '--stage':
        opts.stage = args[++i]?.toUpperCase() ?? null;
        break;
      case '--limit':
        opts.limit = parseInt(args[++i] ?? '10', 10);
        break;
      case '--pause':
        opts.pause = true;
        break;
      case '--bucket':
        opts.bucket = args[++i] ?? 'general';
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--watch':
        opts.watch = true;
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           Fraxia SEDAR+ Ingestion CLI                    ║
╚══════════════════════════════════════════════════════════╝

USAGE:
  npx tsx scripts/sedar-ingest.ts [flags]

FLAGS:
  --commodity <name>      Filter by commodity (gold, silver, copper, lithium, nickel)
  --jurisdiction <tier>   Filter by tier1, tier2, tier3
  --stage <stage>         Filter by MRE, PEA, PFS, FS
  --limit <number>        Max reports to process (default: 10)
  --pause                 Pause after each extraction for manual review
  --bucket <name>         Save to named sub-folder (default: general)
  --dry-run               Show what would be ingested without running
  --watch                 Monitor ~/Downloads/sedar-pdfs/ for new PDFs
  --help, -h              Show this help message

EXAMPLES:
  npx tsx scripts/sedar-ingest.ts --commodity silver --bucket silver --limit 5
  npx tsx scripts/sedar-ingest.ts --jurisdiction tier1 --bucket tier1-general
  npx tsx scripts/sedar-ingest.ts --watch --bucket canada-copper --pause
  npx tsx scripts/sedar-ingest.ts --dry-run --commodity gold

WORKFLOW (recommended):
  1. Browse SEDAR+ (sedarplus.ca) and download NI 43-101 PDFs
  2. Save them to ~/Downloads/sedar-pdfs/
  3. Run: npx tsx scripts/sedar-ingest.ts --watch --bucket <name> --pause
  4. The script auto-processes new PDFs as they appear
  5. Results saved to data/benchmarks/<bucket>/
`);
}

// ============================================================
// CONSTANTS & LOGGING
// ============================================================

const BENCHMARKS_DIR = join(process.cwd(), 'data', 'benchmarks');
const WATCH_DIR = join(homedir(), 'Downloads', 'sedar-pdfs');
const DOWNLOAD_TIMEOUT_MS = 60_000;

const VALID_COMMODITIES = ['gold', 'silver', 'copper', 'lithium', 'nickel', 'zinc', 'uranium', 'cobalt', 'iron', 'rare earths'];
const VALID_STAGES = ['MRE', 'PEA', 'PFS', 'FS', 'TR'];
const VALID_JURISDICTIONS = ['tier1', 'tier2', 'tier3'];

// Jurisdiction tier mapping — countries by mining investment risk
const JURISDICTION_TIERS: Record<string, string[]> = {
  tier1: ['canada', 'australia', 'usa', 'united states', 'sweden', 'finland', 'ireland', 'chile'],
  tier2: ['mexico', 'brazil', 'peru', 'colombia', 'argentina', 'south africa', 'namibia', 'botswana', 'ghana', 'turkey', 'serbia', 'greenland', 'spain', 'portugal'],
  tier3: ['drc', 'congo', 'mali', 'burkina faso', 'guinea', 'tanzania', 'mozambique', 'ethiopia', 'eritrea', 'myanmar', 'indonesia', 'philippines', 'papua new guinea', 'russia', 'mongolia', 'kyrgyzstan', 'uzbekistan'],
};

let logFile = '';

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  if (logFile) {
    appendFileSync(logFile, line + '\n');
  }
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 80);
}

// ============================================================
// MANUAL URL REGISTRY
// ============================================================

/**
 * Primary input method: manually curated PDF URLs.
 * Add entries here after downloading from SEDAR+ in your browser,
 * or if you have direct PDF URLs from other sources.
 *
 * Fields:
 *   url       — Direct link to PDF
 *   issuer    — Company name
 *   project   — Project name
 *   date      — Filing or effective date (YYYY-MM-DD)
 *   commodity — Primary commodity (lowercase)
 *   country   — Country (lowercase)
 *   stage     — Report stage: MRE, PEA, PFS, FS
 */
interface ManualEntry {
  url: string;
  issuer: string;
  project: string;
  date: string;
  commodity: string;
  country: string;
  stage: string;
}

const MANUAL_URLS: ManualEntry[] = [
  // Example entries — replace with real SEDAR+ PDF URLs:
  // {
  //   url: 'https://example.com/report.pdf',
  //   issuer: 'Acme Mining Corp',
  //   project: 'Goldfield Project',
  //   date: '2025-06-15',
  //   commodity: 'gold',
  //   country: 'canada',
  //   stage: 'PEA',
  // },
];

// ============================================================
// FILTERS
// ============================================================

function matchesFilters(entry: { commodity: string; country: string; stage: string }, opts: CLIOptions): boolean {
  if (opts.commodity && entry.commodity.toLowerCase() !== opts.commodity) {
    return false;
  }

  if (opts.stage && entry.stage.toUpperCase() !== opts.stage) {
    return false;
  }

  if (opts.jurisdiction) {
    const tierCountries = JURISDICTION_TIERS[opts.jurisdiction];
    if (tierCountries && !tierCountries.includes(entry.country.toLowerCase())) {
      return false;
    }
  }

  return true;
}

// ============================================================
// PDF DOWNLOAD
// ============================================================

async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Fraxia-Ingest/2.0 (research)' },
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

// ============================================================
// EXTRACTION (Claude API)
// ============================================================

async function extractFromPdfBuffer(pdfBuffer: Buffer): Promise<Record<string, unknown> | null> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const { extractText } = await import('unpdf');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log('ERROR: ANTHROPIC_API_KEY not set');
    return null;
  }

  const anthropic = new Anthropic({ apiKey });

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

  const maxChars = 150000;
  const truncatedText = pdfText.length > maxChars
    ? pdfText.slice(0, maxChars) + '\n\n[Document truncated due to length...]'
    : pdfText;

  const SYSTEM = `You are an expert mining analyst specializing in NI 43-101 technical reports. Extract data conservatively — use null for uncertain fields.`;

  const PROMPT = `Extract key fields from this NI 43-101 report. Return ONLY valid JSON:
{
  "metadata": { "issuer_name": "string", "project_name": "string", "effective_date": "string", "report_stage": "MRE|PEA|PFS|FS|TR" },
  "project_basics": { "primary_commodity": "string", "secondary_commodities": ["string"], "country": "string", "province_state": "string" },
  "resource_estimate": { "total_indicated_mt": "number|null", "indicated_avg_grade": "string|null", "total_inferred_mt": "number|null", "inferred_avg_grade": "string|null", "total_measured_mt": "number|null", "measured_avg_grade": "string|null", "cutoff_grade": "string|null" },
  "economics": { "has_economic_study": "boolean", "npv_aftertax_musd": "number|null", "irr_aftertax_percent": "number|null", "capex_musd": "number|null", "opex_per_unit": "string|null", "payback_years": "number|null", "mine_life_years": "number|null" },
  "risk_assessment": { "metallurgy_risk": "low|moderate|high", "metallurgy_notes": "string|null", "permitting_risk": "low|moderate|high", "permitting_notes": "string|null", "infrastructure_risk": "low|moderate|high", "infrastructure_notes": "string|null", "geopolitical_risk": "low|moderate|high", "geopolitical_notes": "string|null" },
  "investment_analysis": { "investigation_priority": "high|medium|low|pass", "priority_rationale": "string", "next_catalyst": "string|null", "red_flags": ["string"], "positive_signals": ["string"], "magellan_score": 1-10 },
  "qualified_person": { "qp_name": "string|null", "qp_firm": "string|null", "qp_credential": "string|null" }
}

DOCUMENT TEXT:

${truncatedText}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 12000,
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

// ============================================================
// PROCESSING
// ============================================================

async function processFromUrl(
  url: string,
  issuerName: string,
  projectName: string,
  filingDate: string,
  bucketDir: string,
): Promise<Record<string, unknown> | null> {
  log(`  Downloading: ${url.slice(0, 100)}...`);
  const pdfBuffer = await downloadPdf(url);
  if (!pdfBuffer) {
    log(`  FAILED: Could not download PDF`);
    return null;
  }
  log(`  Downloaded ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  return processBuffer(pdfBuffer, issuerName, projectName, filingDate, url, bucketDir);
}

async function processFromFile(
  filePath: string,
  bucketDir: string,
): Promise<Record<string, unknown> | null> {
  const filename = basename(filePath, '.pdf');
  log(`  Reading local file: ${filePath}`);
  const pdfBuffer = readFileSync(filePath);
  log(`  Read ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  return processBuffer(pdfBuffer, filename, filename, new Date().toISOString().split('T')[0], `file://${filePath}`, bucketDir);
}

async function processBuffer(
  pdfBuffer: Buffer,
  issuerName: string,
  projectName: string,
  filingDate: string,
  sourceUrl: string,
  bucketDir: string,
): Promise<Record<string, unknown> | null> {
  log(`  Extracting with Claude...`);
  const extracted = await extractFromPdfBuffer(pdfBuffer);
  if (!extracted) {
    log(`  FAILED: Extraction returned null`);
    return null;
  }

  // Save JSON
  const dateStr = filingDate ? filingDate.split('T')[0] : new Date().toISOString().split('T')[0];
  const filename = `${sanitizeFilename(issuerName)}_${sanitizeFilename(projectName)}_${dateStr}.json`;
  const outputPath = join(bucketDir, filename);

  const output = {
    _meta: {
      source_url: sourceUrl,
      issuer_name: issuerName,
      project_name: projectName,
      filing_date: filingDate,
      extracted_at: new Date().toISOString(),
      bucket: basename(bucketDir),
    },
    ...extracted,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  log(`  SUCCESS: Saved to ${basename(bucketDir)}/${filename}`);
  return output;
}

// ============================================================
// PAUSE MODE
// ============================================================

function waitForEnter(summary: string): Promise<void> {
  return new Promise((resolve) => {
    console.log('\n' + '─'.repeat(60));
    console.log(summary);
    console.log('─'.repeat(60));

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\nPress Enter to continue (or Ctrl+C to stop)... ', () => {
      rl.close();
      resolve();
    });
  });
}

function formatExtractionSummary(data: Record<string, unknown>): string {
  const meta = data.metadata as Record<string, unknown> | undefined;
  const basics = data.project_basics as Record<string, unknown> | undefined;
  const resources = data.resource_estimate as Record<string, unknown> | undefined;
  const econ = data.economics as Record<string, unknown> | undefined;
  const analysis = data.investment_analysis as Record<string, unknown> | undefined;

  const lines = [
    `  Issuer:     ${meta?.issuer_name ?? 'Unknown'}`,
    `  Project:    ${meta?.project_name ?? 'Unknown'}`,
    `  Stage:      ${meta?.report_stage ?? '—'}`,
    `  Commodity:  ${basics?.primary_commodity ?? '—'}`,
    `  Country:    ${basics?.country ?? '—'}`,
    `  Indicated:  ${resources?.total_indicated_mt ?? '—'} Mt`,
    `  Inferred:   ${resources?.total_inferred_mt ?? '—'} Mt`,
    `  NPV:        ${econ?.npv_aftertax_musd ? `$${econ.npv_aftertax_musd}M` : '—'}`,
    `  IRR:        ${econ?.irr_aftertax_percent ? `${econ.irr_aftertax_percent}%` : '—'}`,
    `  Priority:   ${analysis?.investigation_priority ?? '—'}`,
    `  Magellan:   ${analysis?.magellan_score ?? '—'}/10`,
    `  Red Flags:  ${Array.isArray(analysis?.red_flags) ? (analysis.red_flags as string[]).join(', ') || 'None' : '—'}`,
  ];

  return lines.join('\n');
}

// ============================================================
// WATCH MODE
// ============================================================

async function runWatchMode(opts: CLIOptions, bucketDir: string) {
  // Ensure watch directory exists
  if (!existsSync(WATCH_DIR)) {
    mkdirSync(WATCH_DIR, { recursive: true });
    log(`Created watch directory: ${WATCH_DIR}`);
  }

  log(`\n👁  WATCH MODE ACTIVE`);
  log(`   Monitoring: ${WATCH_DIR}`);
  log(`   Bucket:     ${opts.bucket}`);
  log(`   Drop PDF files into the folder above and they will be auto-processed.`);
  log(`   Press Ctrl+C to stop.\n`);

  // Process any existing PDFs first
  const existing = readdirSync(WATCH_DIR).filter(f => extname(f).toLowerCase() === '.pdf');
  if (existing.length > 0) {
    log(`Found ${existing.length} existing PDF(s) in watch folder`);
    let processed = 0;
    for (const file of existing) {
      if (processed >= opts.limit) {
        log(`Reached limit of ${opts.limit}, stopping.`);
        break;
      }

      const filePath = join(WATCH_DIR, file);
      log(`\n[${processed + 1}] Processing existing: ${file}`);

      if (opts.dryRun) {
        log(`  DRY RUN: Would process ${file}`);
        processed++;
        continue;
      }

      const result = await processFromFile(filePath, bucketDir);
      if (result) {
        // Move processed file to a "done" subfolder
        const doneDir = join(WATCH_DIR, 'processed');
        if (!existsSync(doneDir)) mkdirSync(doneDir, { recursive: true });
        renameSync(filePath, join(doneDir, file));
        log(`  Moved to ${join('sedar-pdfs', 'processed', file)}`);
        processed++;

        if (opts.pause) {
          await waitForEnter(formatExtractionSummary(result));
        }
      }
    }
  }

  // Now watch for new files
  log('\nWaiting for new PDFs...');
  const processedFiles = new Set<string>();

  watch(WATCH_DIR, async (eventType, filename) => {
    if (!filename || !filename.endsWith('.pdf')) return;
    if (processedFiles.has(filename)) return;
    processedFiles.add(filename);

    // Small delay to ensure file is fully written
    await new Promise(resolve => setTimeout(resolve, 1000));

    const filePath = join(WATCH_DIR, filename);
    if (!existsSync(filePath)) return;

    log(`\n📄 New PDF detected: ${filename}`);

    if (opts.dryRun) {
      log(`  DRY RUN: Would process ${filename}`);
      return;
    }

    const result = await processFromFile(filePath, bucketDir);
    if (result) {
      const doneDir = join(WATCH_DIR, 'processed');
      if (!existsSync(doneDir)) mkdirSync(doneDir, { recursive: true });
      renameSync(filePath, join(doneDir, filename));
      log(`  Moved to processed/`);

      if (opts.pause) {
        await waitForEnter(formatExtractionSummary(result));
      }
    }
  });

  // Keep the process alive
  await new Promise(() => {});
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  // Validate flags
  if (opts.commodity && !VALID_COMMODITIES.includes(opts.commodity)) {
    console.error(`Invalid commodity: ${opts.commodity}`);
    console.error(`Valid options: ${VALID_COMMODITIES.join(', ')}`);
    process.exit(1);
  }
  if (opts.stage && !VALID_STAGES.includes(opts.stage)) {
    console.error(`Invalid stage: ${opts.stage}`);
    console.error(`Valid options: ${VALID_STAGES.join(', ')}`);
    process.exit(1);
  }
  if (opts.jurisdiction && !VALID_JURISDICTIONS.includes(opts.jurisdiction)) {
    console.error(`Invalid jurisdiction: ${opts.jurisdiction}`);
    console.error(`Valid options: ${VALID_JURISDICTIONS.join(', ')}`);
    process.exit(1);
  }

  // Setup bucket directory
  const bucketDir = join(BENCHMARKS_DIR, opts.bucket);
  if (!existsSync(bucketDir)) {
    mkdirSync(bucketDir, { recursive: true });
  }

  // Setup log file in bucket
  logFile = join(bucketDir, 'ingest-log.txt');

  // Print banner
  log('╔══════════════════════════════════════════════════════════╗');
  log('║           Fraxia SEDAR+ Ingestion CLI v2.0              ║');
  log('╚══════════════════════════════════════════════════════════╝');
  log('');
  log(`  Bucket:        ${opts.bucket} → ${bucketDir}`);
  log(`  Limit:         ${opts.limit}`);
  log(`  Commodity:     ${opts.commodity ?? 'all'}`);
  log(`  Jurisdiction:  ${opts.jurisdiction ?? 'all'}`);
  log(`  Stage:         ${opts.stage ?? 'all'}`);
  log(`  Pause:         ${opts.pause ? 'yes' : 'no'}`);
  log(`  Dry Run:       ${opts.dryRun ? 'yes' : 'no'}`);
  log(`  Watch Mode:    ${opts.watch ? 'yes' : 'no'}`);
  log('');

  // Check for API key (not needed for dry-run)
  if (!opts.dryRun && !process.env.ANTHROPIC_API_KEY) {
    log('ERROR: ANTHROPIC_API_KEY environment variable is required');
    log('Set it with: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  // Watch mode — monitor folder for new PDFs
  if (opts.watch) {
    await runWatchMode(opts, bucketDir);
    return;
  }

  // Standard mode — process manual URLs
  const filtered = MANUAL_URLS.filter(entry => matchesFilters(entry, opts));
  const toProcess = filtered.slice(0, opts.limit);

  if (toProcess.length === 0) {
    log('No entries match the current filters.');
    log('');
    if (MANUAL_URLS.length === 0) {
      log('The MANUAL_URLS array is empty. To add entries:');
      log('  1. Open scripts/sedar-ingest.ts');
      log('  2. Add entries to the MANUAL_URLS array');
      log('  3. Or use --watch mode to process local PDFs');
    } else {
      log(`${MANUAL_URLS.length} total entries, but none match:`);
      if (opts.commodity) log(`  --commodity ${opts.commodity}`);
      if (opts.jurisdiction) log(`  --jurisdiction ${opts.jurisdiction}`);
      if (opts.stage) log(`  --stage ${opts.stage}`);
    }
    log('');
    log('Tip: Use --watch to monitor ~/Downloads/sedar-pdfs/ for new PDFs');
    return;
  }

  log(`Processing ${toProcess.length} of ${filtered.length} matching entries (limit: ${opts.limit})`);
  log('');

  let successes = 0;
  let failures = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    log(`\n[${i + 1}/${toProcess.length}] ${entry.issuer} — ${entry.project}`);
    log(`  Commodity: ${entry.commodity} | Country: ${entry.country} | Stage: ${entry.stage}`);

    if (opts.dryRun) {
      log(`  DRY RUN: Would download ${entry.url.slice(0, 80)}...`);
      log(`  DRY RUN: Would save to ${opts.bucket}/${sanitizeFilename(entry.issuer)}_${sanitizeFilename(entry.project)}_${entry.date}.json`);
      successes++;
      continue;
    }

    const result = await processFromUrl(entry.url, entry.issuer, entry.project, entry.date, bucketDir);

    if (result) {
      successes++;
      if (opts.pause) {
        await waitForEnter(formatExtractionSummary(result));
      }
    } else {
      failures++;
    }

    // Rate limit between extractions
    if (i < toProcess.length - 1 && !opts.dryRun) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  log('\n' + '═'.repeat(60));
  log(`INGESTION COMPLETE`);
  log(`  Bucket:    ${opts.bucket}`);
  log(`  Successes: ${successes}`);
  log(`  Failures:  ${failures}`);
  log(`  Total:     ${toProcess.length}`);
  log('═'.repeat(60));
}

// Run
main().catch((error) => {
  log(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
