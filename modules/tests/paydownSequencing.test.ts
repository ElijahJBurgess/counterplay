import { simulatePaydownSequencing } from '../simulatePaydownSequencing'

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

// Test 1 — Eligible, 3 debts, mixed APRs, avalanche recommended (interest diff > $200)
const result1 = simulatePaydownSequencing({
  debts: [
    { type: 'credit_card', balance: 6000, apr: 24.99, minPayment: 180 },
    { type: 'credit_card', balance: 3500, apr: 18.99, minPayment: 105 },
    { type: 'personal_loan', balance: 4000, apr: 12.5, minPayment: 120 },
  ],
  monthlyFreeCashFlow: 700,
})
console.log('Test 1 result:', result1)

assert('Test 1: Eligible, 3 debts, avalanche recommended', [
  { label: 'eligible', expected: true, got: result1.eligible, pass: result1.eligible === true },
  {
    label: 'recommendedMethod',
    expected: 'avalanche',
    got: result1.recommendedMethod,
    pass: result1.recommendedMethod === 'avalanche',
  },
  {
    label: 'optimizedProjection.interestSaved > 0',
    expected: '> 0',
    got: result1.optimizedProjection.interestSaved,
    pass: result1.optimizedProjection.interestSaved > 0,
  },
  {
    label: 'payoffSchedule.length',
    expected: 3,
    got: result1.payoffSchedule.length,
    pass: result1.payoffSchedule.length === 3,
  },
  {
    label: 'cashFlowUnlockTimeline.length',
    expected: result1.payoffSchedule.length,
    got: result1.cashFlowUnlockTimeline.length,
    pass: result1.cashFlowUnlockTimeline.length === result1.payoffSchedule.length,
  },
])

// Test 2 — Eligible, 2 debts, similar APRs, snowball recommended (interest diff < $200)
const result2 = simulatePaydownSequencing({
  debts: [
    { type: 'credit_card', balance: 4000, apr: 16.99, minPayment: 120 },
    { type: 'personal_loan', balance: 800, apr: 15.99, minPayment: 30 },
  ],
  monthlyFreeCashFlow: 250,
})
console.log('Test 2 result:', result2)

assert('Test 2: Eligible, 2 debts, snowball recommended', [
  { label: 'eligible', expected: true, got: result2.eligible, pass: result2.eligible === true },
  {
    label: 'recommendedMethod',
    expected: 'snowball',
    got: result2.recommendedMethod,
    pass: result2.recommendedMethod === 'snowball',
  },
  {
    label: 'optimizedProjection.interestSaved > 0',
    expected: '> 0',
    got: result2.optimizedProjection.interestSaved,
    pass: result2.optimizedProjection.interestSaved > 0,
  },
  {
    label: 'payoffSchedule.length',
    expected: 2,
    got: result2.payoffSchedule.length,
    pass: result2.payoffSchedule.length === 2,
  },
  {
    label: 'cashFlowUnlockTimeline.length',
    expected: result2.payoffSchedule.length,
    got: result2.cashFlowUnlockTimeline.length,
    pass: result2.cashFlowUnlockTimeline.length === result2.payoffSchedule.length,
  },
])

// Test 3 — Single debt, singleDebt: true, payoff acceleration runs
const result3 = simulatePaydownSequencing({
  debts: [{ type: 'credit_card', balance: 5000, apr: 22.99, minPayment: 150 }],
  monthlyFreeCashFlow: 400,
})
console.log('Test 3 result:', result3)

assert('Test 3: Single debt, acceleration math runs', [
  { label: 'eligible', expected: true, got: result3.eligible, pass: result3.eligible === true },
  {
    label: 'singleDebt',
    expected: true,
    got: result3.singleDebt,
    pass: result3.singleDebt === true,
  },
  {
    label: 'optimizedProjection.interestSaved > 0',
    expected: '> 0',
    got: result3.optimizedProjection.interestSaved,
    pass: result3.optimizedProjection.interestSaved > 0,
  },
  {
    label: 'payoffSchedule.length',
    expected: 1,
    got: result3.payoffSchedule.length,
    pass: result3.payoffSchedule.length === 1,
  },
  {
    label: 'cashFlowUnlockTimeline.length',
    expected: result3.payoffSchedule.length,
    got: result3.cashFlowUnlockTimeline.length,
    pass: result3.cashFlowUnlockTimeline.length === result3.payoffSchedule.length,
  },
])

// Test 4 — Cash flow negative, multiple debts, simulation still runs
const result4 = simulatePaydownSequencing({
  debts: [
    { type: 'credit_card', balance: 3000, apr: 22.99, minPayment: 200 },
    { type: 'personal_loan', balance: 4000, apr: 18.5, minPayment: 200 },
  ],
  monthlyFreeCashFlow: 300, // less than 200+200=400 total min payments
})
console.log('Test 4 result:', result4)

assert('Test 4: Cash flow negative, simulation still runs', [
  { label: 'eligible', expected: true, got: result4.eligible, pass: result4.eligible === true },
  {
    label: 'cashFlowNegative',
    expected: true,
    got: result4.cashFlowNegative,
    pass: result4.cashFlowNegative === true,
  },
  {
    label: 'payoffSchedule.length',
    expected: 2,
    got: result4.payoffSchedule.length,
    pass: result4.payoffSchedule.length === 2,
  },
  {
    label: 'cashFlowUnlockTimeline.length',
    expected: result4.payoffSchedule.length,
    got: result4.cashFlowUnlockTimeline.length,
    pass: result4.cashFlowUnlockTimeline.length === result4.payoffSchedule.length,
  },
  {
    label: 'riskFlags includes "Cash flow negative"',
    expected: true,
    got: result4.riskFlags,
    pass: result4.riskFlags.includes('Cash flow negative'),
  },
])

// Test 5 — Not eligible, single debt under $1,000
const result5 = simulatePaydownSequencing({
  debts: [{ type: 'credit_card', balance: 800, apr: 24.99, minPayment: 30 }],
  monthlyFreeCashFlow: 200,
})
console.log('Test 5 result:', result5)

assert('Test 5: Not eligible, total debt too low', [
  { label: 'eligible', expected: false, got: result5.eligible, pass: result5.eligible === false },
  {
    label: 'reason',
    expected: 'Total debt too low for sequencing to make a meaningful difference.',
    got: result5.reason,
    pass:
      result5.reason ===
      'Total debt too low for sequencing to make a meaningful difference.',
  },
])

console.log(`\n${passed}/${passed + failed} tests passed`)
