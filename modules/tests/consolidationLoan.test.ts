import { simulateConsolidationLoan } from '../simulateConsolidationLoan'

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
const result1 = simulateConsolidationLoan({
  creditScoreRange: '700-739',
  debts: [
    { type: 'credit_card', balance: 7000, apr: 24, minPayment: 210 },
    { type: 'personal_loan', balance: 5000, apr: 19.5, minPayment: 150 },
  ],
})
console.log('Test 1 result:', result1)

assert('Test 1: Eligible strong candidate', [
  { label: 'eligible', expected: true, got: result1.eligible, pass: result1.eligible === true },
  { label: 'borderline', expected: false, got: result1.borderline, pass: result1.borderline === false },
  {
    label: 'netSavings > 0',
    expected: '> 0',
    got: result1.netSavings,
    pass: result1.netSavings > 0,
  },
  {
    label: 'riskFlags includes "Rate not guaranteed"',
    expected: true,
    got: result1.riskFlags,
    pass: result1.riskFlags.includes('Rate not guaranteed'),
  },
])

// Test 2 — Borderline, but eligible
const result2 = simulateConsolidationLoan({
  creditScoreRange: '620-659',
  debts: [
    { type: 'credit_card', balance: 9000, apr: 29.99, minPayment: 270 },
    { type: 'credit_card', balance: 3000, apr: 22.99, minPayment: 90 },
  ],
})
console.log('Test 2 result:', result2)

assert('Test 2: Borderline eligible', [
  { label: 'eligible', expected: true, got: result2.eligible, pass: result2.eligible === true },
  { label: 'borderline', expected: true, got: result2.borderline, pass: result2.borderline === true },
  {
    label: 'netSavings > 0',
    expected: '> 0',
    got: result2.netSavings,
    pass: result2.netSavings > 0,
  },
  {
    label: 'riskFlags includes "Rate not guaranteed"',
    expected: true,
    got: result2.riskFlags,
    pass: result2.riskFlags.includes('Rate not guaranteed'),
  },
])

// Test 3 — Not eligible, score too low
const result3 = simulateConsolidationLoan({
  creditScoreRange: '580-619',
  debts: [{ type: 'credit_card', balance: 6000, apr: 26.99, minPayment: 180 }],
})
console.log('Test 3 result:', result3)

assert('Test 3: Not eligible, score too low', [
  { label: 'eligible', expected: false, got: result3.eligible, pass: result3.eligible === false },
  {
    label: 'reason',
    expected: 'Credit score too low for personal loan rates that beat your current debt.',
    got: result3.reason,
    pass: result3.reason === 'Credit score too low for personal loan rates that beat your current debt.',
  },
])

// Test 4 — Not eligible, weighted APR too low
const result4 = simulateConsolidationLoan({
  creditScoreRange: '740+',
  debts: [
    { type: 'personal_loan', balance: 5000, apr: 12, minPayment: 150 },
    { type: 'auto', balance: 4000, apr: 10, minPayment: 120 },
  ],
})
console.log('Test 4 result:', result4)

assert('Test 4: Not eligible, weighted APR below threshold', [
  { label: 'eligible', expected: false, got: result4.eligible, pass: result4.eligible === false },
  {
    label: 'reason',
    expected: "Your current weighted rate is low enough that consolidation won't improve it.",
    got: result4.reason,
    pass: result4.reason === "Your current weighted rate is low enough that consolidation won't improve it.",
  },
])

// Test 5 — Not eligible, origination fee wipes out savings
const result5 = simulateConsolidationLoan({
  creditScoreRange: '660-699',
  debts: [{ type: 'credit_card', balance: 2500, apr: 20, minPayment: 600 }],
})
console.log('Test 5 result:', result5)

assert('Test 5: Not eligible, net savings negative after origination fee', [
  { label: 'eligible', expected: false, got: result5.eligible, pass: result5.eligible === false },
  {
    label: 'reason',
    expected: "After origination fees, this move doesn't save money.",
    got: result5.reason,
    pass: result5.reason === "After origination fees, this move doesn't save money.",
  },
  {
    label: 'riskFlags includes "Rate not guaranteed"',
    expected: true,
    got: result5.riskFlags,
    pass: result5.riskFlags.includes('Rate not guaranteed'),
  },
])

console.log(`\n${passed}/${passed + failed} tests passed`)
