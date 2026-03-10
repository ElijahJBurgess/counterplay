import { simulateBalanceTransfer } from '../simulateBalanceTransfer'

let passed = 0
let failed = 0

function assert(
  testName: string,
  conditions: Array<{ label: string; expected: unknown; got: unknown; pass: boolean }>
) {
  const failures = conditions.filter((c) => !c.pass)
  if (failures.length === 0) {
    console.log(`✅ PASS — ${testName}`)
    passed++
  } else {
    console.log(`❌ FAIL — ${testName}`)
    for (const f of failures) {
      console.log(`   Expected: ${f.label} = ${JSON.stringify(f.expected)}`)
      console.log(`   Got: ${f.label} = ${JSON.stringify(f.got)}`)
    }
    failed++
  }
}

// Test 1 — Eligible, strong candidate
const result1 = simulateBalanceTransfer({
  creditScoreRange: '700-739',
  debts: [{ type: 'credit_card', balance: 8000, apr: 24.99, minPayment: 220 }],
  monthlyFreeCashFlow: 800,
})

assert('Test 1: Eligible strong candidate', [
  { label: 'eligible', expected: true, got: result1.eligible, pass: result1.eligible === true },
  {
    label: 'netInterestSaved > 0',
    expected: '> 0',
    got: result1.netInterestSaved,
    pass: result1.netInterestSaved > 0,
  },
  {
    label: 'clearedInPromoWindow',
    expected: true,
    got: result1.clearedInPromoWindow,
    pass: result1.clearedInPromoWindow === true,
  },
  {
    label: 'impactScore > 60',
    expected: '> 60',
    got: result1.impactScore,
    pass: result1.impactScore > 60,
  },
])

// Test 2 — Not eligible, score too low
const result2 = simulateBalanceTransfer({
  creditScoreRange: '580-619',
  debts: [{ type: 'credit_card', balance: 3000, apr: 22.99, minPayment: 90 }],
  monthlyFreeCashFlow: 400,
})

assert('Test 2: Not eligible, score too low', [
  { label: 'eligible', expected: false, got: result2.eligible, pass: result2.eligible === false },
])

// Test 3 — Not eligible, APR too low
const result3 = simulateBalanceTransfer({
  creditScoreRange: '700-739',
  debts: [{ type: 'personal_loan', balance: 5000, apr: 12, minPayment: 150 }],
  monthlyFreeCashFlow: 600,
})

assert('Test 3: Not eligible, APR too low', [
  { label: 'eligible', expected: false, got: result3.eligible, pass: result3.eligible === false },
])

// Test 4 — Borderline, score 620-659
const result4 = simulateBalanceTransfer({
  creditScoreRange: '620-659',
  debts: [{ type: 'credit_card', balance: 1500, apr: 26.99, minPayment: 60 }],
  monthlyFreeCashFlow: 300,
})

assert('Test 4: Borderline, score 620-659', [
  { label: 'eligible', expected: true, got: result4.eligible, pass: result4.eligible === true },
  {
    label: 'borderline',
    expected: true,
    got: result4.borderline,
    pass: result4.borderline === true,
  },
  {
    label: 'impactScore lower than Test 1',
    expected: `< ${result1.impactScore}`,
    got: result4.impactScore,
    pass: result4.impactScore < result1.impactScore,
  },
])

// Test 5 — Tight payoff window risk flag
const result5 = simulateBalanceTransfer({
  creditScoreRange: '740+',
  debts: [{ type: 'credit_card', balance: 14000, apr: 22.99, minPayment: 350 }],
  monthlyFreeCashFlow: 400,
})

assert('Test 5: Tight payoff window risk flag', [
  { label: 'eligible', expected: true, got: result5.eligible, pass: result5.eligible === true },
  {
    label: 'riskFlags includes "Tight payoff window"',
    expected: true,
    got: result5.riskFlags,
    pass: result5.riskFlags.includes('Tight payoff window'),
  },
])

console.log(`\n${passed}/${passed + failed} tests passed`)
