# Product & Architecture Decisions

This document records the significant calls made during the V1 build of Full Disclosure — what was decided, what was rejected, and why. These aren't retrospective justifications. They're the actual reasoning that shaped the product.

---

## 1. V1 scope is one problem, done exceptionally well

**Decision:** V1 covers high-interest consumer debt optimization only. Five modules. One user problem. No investment optimization, tax strategy, HELOC, business credit, or debt settlement.

**What was rejected:** A broader "full financial picture" product that surfaces moves across debt, savings, investing, and tax simultaneously.

**Why:** A broad product at V1 is a mediocre product. The user with $15,000 in high-APR credit card debt doesn't need a net worth dashboard — they need someone to show them the three moves they didn't know existed for their specific situation. Doing one problem exceptionally builds the trust and the signal that a broader product requires. Scope expands only after V1 is shipped and validated.

---

## 2. Math is deterministic. Claude is the explanation layer only.

**Decision:** All financial calculations happen in typed TypeScript modules before Claude sees anything. Claude receives a structured result object with pre-computed numbers and returns a plain English explanation. Claude performs no math.

**What was rejected:** Passing raw user inputs to Claude and letting it calculate and explain simultaneously.

**Why:** If Claude calculates, Claude can hallucinate. A user who acts on a wrong number suffers a real financial consequence. By separating the math layer from the explanation layer, every figure Claude cites is traceable back to a deterministic function output. The output is auditable. The trust is earned structurally, not assumed.

This also makes the engine independently testable. All 29 test cases run against the TypeScript modules with no AI involvement. The math passes or fails on its own terms.

---

## 3. Cash flow is a risk flag, not an eligibility gate

**Decision:** A user whose monthly free cash flow barely covers the required payment on a balance transfer still sees the move — with a "Tight payoff window" risk flag explaining the constraint.

**What was rejected:** Blocking the result entirely if cash flow falls below the required payment threshold.

**Why:** Hiding a move from someone because their situation is tight is paternalistic. They came to the product to understand what's possible for their specific situation — including the hard version of it. Showing the move with a clear flag respects their ability to make their own decision. Blocking it assumes they can't handle complexity. That's exactly the dynamic this product exists to reverse.

---

## 4. Risk flag expansion map dropped

**Decision:** Financial modules output short descriptive flag strings. Claude receives them as-is within the full strategy object. No expansion map translating flag codes to full messages.

**What was rejected:** A 15+ entry map in the API route that expanded each flag name to a verbose explanation before passing to Claude.

**Why:** The expansion map was brittle. Every new flag required a new map entry. Every module change risked a mismatch. The master strategy prompt gives Claude full context — it can handle a descriptive flag string without a pre-written expansion. Removing the map reduced surface area for bugs with no loss in output quality.

---

## 5. Module 1 scoped to credit cards only

**Decision:** The balance transfer module only runs on credit card debt. Auto loan and personal loan balance transfers are deferred to V2.

**What was rejected:** Running balance transfer eligibility checks across all debt types in V1.

**Why:** Balance transfer arbitrage is a credit card mechanism. The mechanics, card recommendations, eligibility thresholds, and risk profile differ materially for other debt types. Scoping to credit cards lets V1 do the most common version of the move correctly. Adding other debt types requires separate eligibility logic, separate affiliate partnerships, and separate risk flag sets — all of which belong in a V2 iteration after the core flow is validated.

---

## 6. Conditional input fields over flat form

**Decision:** The input screen uses conditional fields. Modules 4 and 5 surface additional inputs (upcoming application type, loan origination details) only when relevant. `isRevolving` and `isRefinanceable` are auto-derived from debt type and never exposed to the user.

**What was rejected:** A flat form that collects all possible fields upfront and ignores the ones that don't apply.

**Why:** A flat form that asks everyone about their upcoming mortgage application or original loan term is confusing for users who have neither. Conditional fields reduce cognitive load and signal that the product understands their situation. The tradeoff is more complex state management — but retrofitting the data shape downstream after validating the flat approach would have been higher risk than doing it correctly once.

---

## 7. Light background, not dark

**Decision:** The app uses a light background (`#F9F9F9`) throughout. Dark cards (`#141414`) sit on top of it.

**What was rejected:** A full dark theme. It was built, evaluated, and rejected.

**Why:** The target user is a first-generation wealth builder who may be skeptical of financial products. Dark themes read as aggressive and technical — closer to a trading app than a trusted advisor. Light reads as credible and approachable. The dark cards on a light background give the product a premium, distinct feel without the trust barrier a full dark theme creates. Design decisions are user decisions.

---

## 8. sessionStorage for cross-screen state

**Decision:** Module results are stored in `sessionStorage` and read by the results screen on mount. If the session is cleared, the user is redirected to the input screen.

**What was rejected:** URL parameter serialization; immediate Supabase persistence.

**Why:** The result object is large and complex — encoding it in a URL is brittle and exposes internals. Supabase persistence adds a write operation on every run before the result has been reviewed, which is premature for V1. sessionStorage is appropriate for single-session state that doesn't need to survive tab close. Result history persistence is a V2 item once the output format is stable.

---

## 9. Rate limiting logic written but not enforced at launch

**Decision:** The rate limiting mechanism (10 simulations/day per user, checked against a `simulation_logs` table) is fully written and present in the API route but commented out for V1.

**What was rejected:** Enforcing rate limits from the first line of production code.

**Why:** The app launched with one user. Rate limiting adds operational overhead — log writes, count queries, error states — with zero current benefit. The mechanism is ready to activate with a single uncommented block. Building the mechanism and delaying enforcement is the correct call. Building it at scale and discovering the logic is wrong is not.

---

## 10. Per-move Claude explanations deferred to V2

**Decision:** Claude produces one explanation block for the full ranked strategy. Individual moves do not have their own Claude-generated explanations.

**What was rejected:** A per-move explanation triggered when the user expands each accordion card.

**Why:** Per-move explanations multiply API calls, add latency to the UI interaction, and require prompt engineering for five distinct contexts. The full strategy explanation already references each move in sequence. The added clarity of per-move explanations doesn't justify the implementation cost at V1 — especially before knowing which moves users expand most often. Usage data comes first. Targeted explanation investment follows.
