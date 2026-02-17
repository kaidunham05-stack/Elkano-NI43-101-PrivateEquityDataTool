# Elkano — Vercel Deployment Guide

## Quick Deploy

### Option 1: Vercel CLI
```bash
cd webapp
npx vercel
```

### Option 2: GitHub → Vercel
1. Push to GitHub
2. Import project at vercel.com/new
3. Add environment variables (see below)
4. Deploy

## Environment Variables (Required)

Add these in Vercel Dashboard → Project Settings → Environment Variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ugsxjwmpwyxdryfbcmor.supabase.co` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Claude API key |

## Supabase Setup (Already Done)

Database schema and storage bucket are already configured:
- Table: `extractions`
- Bucket: `ni43101-pdfs`
- RLS policies enabled

## Features

- **PDF Upload** — Drag & drop NI 43-101 reports
- **AI Extraction** — Claude Sonnet 4 reads PDFs and extracts structured data
- **Large PDF Support** — Falls back to text extraction for >100 page PDFs
- **CSV Export** — Download all extractions as spreadsheet
- **Dark Mode** — Sleek UI

## Cost Estimate

- **Claude API**: ~$0.05-0.15 per extraction (Sonnet)
- **Supabase**: Free tier (500MB storage, 50K auth users)
- **Vercel**: Free tier (hobby) or Pro ($20/mo for team)

## Troubleshooting

**"Invalid API key"** — Check ANTHROPIC_API_KEY in Vercel env vars

**"Bucket not found"** — Run the Supabase schema setup (already done for this project)

**Large PDFs timing out** — Vercel has 10s timeout on hobby, 60s on Pro. Consider upgrading or using edge functions.
