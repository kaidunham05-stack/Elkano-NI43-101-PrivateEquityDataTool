# Elkano NI 43-101 Intelligence Platform

Premium web application for processing NI 43-101 technical mining reports. Upload PDFs and get instant AI-powered extraction of key investment metrics.

![Elkano Screenshot](./public/screenshot.png)

## Features

- 🔍 **AI-Powered Extraction** - Claude analyzes full NI 43-101 reports in seconds
- 📊 **Magellan Thesis Scoring** - Identifies projects where geological uncertainty is collapsing faster than market pricing
- 🎯 **Priority Classification** - Auto-categorizes as INVESTIGATE, WATCH, or PASS
- 📈 **Resource Analysis** - Extracts Indicated/Inferred ratios, grades, and tonnages
- 💰 **Economic Metrics** - NPV, IRR, CapEx, OpEx extraction
- ⚠️ **Risk Assessment** - Metallurgical, permitting, infrastructure, geopolitical risks
- 🔐 **Secure & Private** - Per-user data isolation with Row Level Security
- 🌙 **Premium Dark UI** - Apple-inspired design with glass morphism effects

## Tech Stack

- **Frontend:** Next.js 14+ (App Router) with TypeScript
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Claude claude-opus-4-5-20251101 via Anthropic API
- **Styling:** Tailwind CSS with custom dark theme
- **Animations:** Framer Motion
- **Deployment:** Vercel

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd elkano-ni43101/webapp
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)

2. Run the database schema:
   - Go to SQL Editor in Supabase Dashboard
   - Copy contents of `supabase/schema.sql`
   - Run the SQL

3. Create storage bucket:
   - Go to Storage in Supabase Dashboard
   - Click "New bucket"
   - Name: `ni43101-pdfs`
   - Public: **OFF** (keep private)
   - Click Create

4. Configure storage policies:
   - Select the `ni43101-pdfs` bucket
   - Go to Policies tab
   - Add these policies (or uncomment and run from schema.sql):

   ```sql
   -- Allow users to upload to their own folder
   CREATE POLICY "Users can upload PDFs to own folder"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'ni43101-pdfs' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );

   -- Allow users to view their own PDFs
   CREATE POLICY "Users can view own PDFs"
   ON storage.objects FOR SELECT
   USING (
     bucket_id = 'ni43101-pdfs' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );

   -- Allow users to delete their own PDFs
   CREATE POLICY "Users can delete own PDFs"
   ON storage.objects FOR DELETE
   USING (
     bucket_id = 'ni43101-pdfs' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

### 3. Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Get from Supabase Dashboard > Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Get from https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-api03-your-key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create an Account

1. Go to the login page
2. Click "Sign up" and create an account
3. Check your email for confirmation link (check spam)
4. Start uploading NI 43-101 reports!

## Deploying to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=YOUR_REPO_URL)

### Manual Deploy

1. Push your code to GitHub

2. Go to [vercel.com](https://vercel.com) and import your repository

3. Add environment variables in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`

4. Deploy!

### Important Vercel Settings

- **Function Duration:** The `/api/extract` route may take up to 2 minutes for large PDFs. Ensure your Vercel plan supports this, or the function may timeout.
- **Region:** Deploy close to your Supabase region for best performance.

## Project Structure

```
webapp/
├── src/
│   ├── app/
│   │   ├── api/extract/      # PDF extraction API route
│   │   ├── login/            # Auth pages
│   │   ├── page.tsx          # Main dashboard
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Theme & styles
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── Header.tsx        # Navigation header
│   │   ├── UploadZone.tsx    # Drag & drop upload
│   │   ├── ExtractionsTable.tsx  # Data table
│   │   └── StatusBadge.tsx   # Status indicators
│   └── lib/
│       ├── supabase.ts       # Database client
│       ├── claude.ts         # AI extraction
│       ├── types.ts          # TypeScript types
│       └── utils.ts          # Utilities
├── supabase/
│   └── schema.sql            # Database schema
└── public/
```

## Usage Tips

### Best Results from Claude Extraction

- Upload official NI 43-101 compliant PDFs
- Reports with clear resource tables work best
- Economic studies (PEA/PFS/FS) provide more data points
- Recent reports (< 2 years old) are most relevant

### Understanding the Status

| Status | Meaning |
|--------|---------|
| 🔍 INVESTIGATE | High priority - warrants deeper analysis |
| 👀 WATCH | Interesting but needs more data/catalysts |
| ❌ PASS | Red flags or low priority |

### Magellan Score (1-10)

Measures how well a project fits the "Magellan thesis" - identifying opportunities where geological uncertainty is collapsing faster than market pricing:

- **8-10:** Excellent fit - high Ind/Inf ratio, low risk, clear catalysts
- **6-7:** Good potential with some uncertainties
- **4-5:** Average - needs more de-risking
- **1-3:** Poor fit - high risk or limited upside

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint
npm run lint
```

## License

Private - All rights reserved.

---

Built with ♥ by the Elkano team
