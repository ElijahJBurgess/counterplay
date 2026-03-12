# Counterplay

**A financial strategy tool that finds the moves the financial system never told you existed — and hands you the playbook to run them.**

The financial system has cheat codes. Balance transfer arbitrage. Consolidation rate gaps. Credit utilization timing windows. Refinance opportunities hiding in plain sight. These moves are well known to people with financial literacy and systematically unknown to everyone else. Counterplay closes that gap.

You enter your full debt picture. The engine analyzes it across five optimization modules, ranks every move by dollar impact, and Claude explains the strategy in plain English — the way a smart friend who grew up knowing how money works would explain it. Not advice. A ranked game plan with exact numbers and a specific first action.

---

## What It Does

1. User inputs their full debt stack — balances, APRs, credit score range, monthly cash flow
2. Five financial modules run in parallel, each looking for a different category of opportunity
3. A ranking engine scores, sequences, and prioritizes every eligible move
4. Claude translates the output into a plain English strategy — 250–350 words, no jargon, no hedging
5. User sees a ranked list of moves with total savings, sequencing relationships, risk flags, and one specific first action

The product never touches money. Never facilitates transactions. It finds the moves. The user executes them.

---

## The Five Modules

| # | Module | What It Finds |
|---|--------|---------------|
| 1 | Balance Transfer Arbitrage | 0% promo card opportunities for high-APR credit card debt |
| 2 | Debt Consolidation Loan Replacement | Personal loan refinancing to replace multiple high-APR debts |
| 3 | Aggressive Paydown Sequencing | Optimal avalanche vs snowball attack sequence across the full debt stack |
| 4 | Utilization Optimization | Credit score improvement before a major application — timing and paydown targets |
| 5 | Refinance Timing Window Detection | Rate reduction opportunities on existing auto and personal loans |

All five modules are built and tested. 29 test cases passing across the full engine.

---

## Architecture

```
User inputs
    ↓
Run all 5 modules in parallel (TypeScript — deterministic math)
    ↓
Filter ineligible modules
    ↓
Apply context multipliers to impact scores
    ↓
Detect cross-module sequencing relationships
    ↓
Build final ranked strategy object
    ↓
Claude API (explanation layer only — no math)
    ↓
Render ranked output with risk flags and first action
```

**Key principle:** Math is deterministic. Claude is the explanation layer only. All financial calculations happen in structured TypeScript functions before Claude sees anything. Claude cannot hallucinate a number that affects a financial decision. Every figure it cites is verifiable from the module output.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind v4 (App Router) |
| Financial Engine | TypeScript modules — `/modules` directory |
| AI Layer | Claude API via `@anthropic-ai/sdk` — `claude-opus-4-6` |
| Auth + Database | Supabase (email/password, Postgres with RLS) |
| Hosting | Vercel (deployment pending) |

---

## Project Structure

```
counterplay/
  styles/
    tokens.ts                          ← Design system tokens
  modules/
    simulateBalanceTransfer.ts         ← Module 1
    simulateConsolidationLoan.ts       ← Module 2
    simulatePaydownSequencing.ts       ← Module 3
    simulateUtilizationOptimization.ts ← Module 4
    simulateRefinanceWindow.ts         ← Module 5
    buildStrategy.ts                   ← Ranking engine
    tests/                             ← 29 test cases, all passing
  app/
    api/explain/route.ts               ← Claude API route
    auth/page.tsx                      ← Login / signup
    dashboard/
      onboarding/page.tsx              ← Credit score + goal capture
      input/page.tsx                   ← Full debt input (all 5 modules)
      loading/page.tsx                 ← Module execution + strategy build
      results/page.tsx                 ← Ranked strategy output
  types/index.ts                       ← Shared TypeScript interfaces
```

---

## Running Locally

**Prerequisites:** Node.js 18+, a Supabase project, an Anthropic API key

```bash
git clone https://github.com/ElijahJBurgess/counterplay.git
cd counterplay
npm install
```

Create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

```bash
npm run dev
```

Open `http://localhost:3000`. Create an account, complete onboarding, enter a debt stack, and run the engine.

**To run the test suite:**

```bash
npm test
```

29 test cases across 6 modules. All passing.

---

## Build Documentation

Full documentation for each phase of the build:

| Document | Description |
|----------|-------------|
| [Phase 1 Build Log](docs/Counterplay_Phase1_Build_Log.docx) | Foundation — repo setup, auth, onboarding |
| [Phase 2 Build Log](docs/Counterplay_Phase2_Build_Log.docx) | Module 1 engine + full user flow |
| [Phase 2 PM Doc](docs/Counterplay_Phase2_PM_Doc.docx) | Product decisions, tradeoffs, architecture rationale |
| [Phase 3 Build Log](docs/Counterplay_Phase3_Build_Log.docx) | Design system + all 5 screens + full engine integration |
| [V1 PRD](docs/Counterplay_V1_PRD.docx) | Full product requirements — scope, modules, architecture, tradeoffs |
| [Design Tokens](docs/Counterplay_Design_Tokens.docx) | Visual design system — colors, typography, spacing, component patterns |

---

## Build Status

| Phase | Status |
|-------|--------|
| Phase 1 — Foundation (auth, onboarding, repo) | ✅ Complete |
| Phase 2 — Module 1 engine + user flow | ✅ Complete |
| Phase 3 Engine — Modules 2–5 + ranking engine | ✅ Complete |
| Phase 3 UI — Design system + all 5 screens | ✅ Complete |
| Pre-launch (deployment, rate limiting, brand) | 🔄 In progress |

---

## V1 Scope

V1 is narrowly focused on high-interest consumer debt optimization. One problem, done exceptionally well. Scope expands after V1 is shipped and validated.

**Out of scope for V1:** LLC structuring, HELOC strategies, business credit, debt settlement, investment optimization, tax strategy.

---

## Legal

This product is a simulation and education tool, not a registered financial advisor. All outputs are framed as "here's what happens if you do X" — not recommendations. No financial transactions are facilitated. No bank accounts are accessed. No live credit pulls are made.

*"This is a simulation based on typical issuer behavior. Actual approval and limit depend on your full credit profile."*

---

Built by [Elijah Burgess](https://github.com/ElijahJBurgess) — Product Manager, March 2026.
