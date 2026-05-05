BSOM Intake Portal — v3

The BSOM Intake Portal is a centralized intake operations platform designed to support referral tracking, intake coordination, initial assessments, and operational visibility across multiple clinic locations.

Originally introduced to evolve beyond spreadsheet-based workflows adopted in August 2024, the portal transitions intake management from manual tracking to a structured, stage-based system.

This system enables:

Clear visibility into referral and assessment pipelines
Consistent intake workflows across staff and clinics
Real-time tracking of client progression
Improved operational reporting and performance insight

Before: Spreadsheet-based tracking
After: Structured intake operations system

Developed independently by Zanteria Wells as an internal operations solution.

Core Modules

Dashboard
High-level visibility into active referrals, pending actions, and recent operational activity.

Intake
Manage referrals, intake coordination, pending documents, and insurance workflows in one place.

Initial Assessments
Track the full assessment workflow, including parent interviews, Vineland, SRS-2, VB-MAPP, Socially Savvy, BCBA assignment, and authorization readiness.

Operational Insights
Monitor referral aging, clinic volume, conversion trends, and intake performance across locations.

Developer Setup (Internal Use)
1. Clone and install
git clone https://github.com/YOUR_USERNAME/bsom-intake-portal.git
cd bsom-intake-portal
npm install
2. Configure environment

Copy .env.example to .env and add credentials:

cp .env.example .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

⚠️ Never commit .env

3. Run locally
npm run dev

Open: http://localhost:5173

4. Build for production
npm run build
```

Output goes to `/dist`. Deploy to Vercel or Netlify.

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import Project → select your repo
3. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click Deploy — auto-deploys on every push to `main`

## Notes

- Assessment and Operations pages are scaffolded with stubs and ready for the next build phase
- The original `index.html` single-file version is preserved separately for reference
- All Supabase queries use the official `@supabase/supabase-js` v2 client
