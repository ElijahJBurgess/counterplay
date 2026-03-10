import { simulateRefinanceWindow } from '../simulateRefinanceWindow'

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

// Test 1 — Eligible act_now: 700-739 score, auto loan, 18 months paid, APR 18.9%
const result1 = simulateRefinanceWindow({
  creditScoreRange: '700-739',
  debts: [
    {
      type: 'auto',
      balance: 15000,
      apr: 18.9,
      minPayment: 400,
      originalLoanAmount: 22000,
      originalTermMonths: 60,
      monthsAlreadyPaid: 18,
      isRefinanceable: true,
    },
  ],
  monthlyFreeCashFlow: 1000,
  hasRecentHardInquiry: false,
  recentLatePayments: false,
})
console.log('Test 1 result:', result1)

assert('Test 1: Eligible act_now — 700-739, auto, 18mo paid, 18.9% APR', [
  { label: 'eligible', expected: true, got: result1.eligible, pass: result1.eligible === true },
  {
    label: 'windowStatus',
    expected: 'act_now',
    got: result1.windowStatus,
    pass: result1.windowStatus === 'act_now',
  },
  {
    label: 'netSavings > 0',
    expected: '> 0',
    got: result1.netSavings,
    pass: result1.netSavings > 0,
  },
  {
    label: 'riskFlags includes "Prepayment penalty possible"',
    expected: true,
    got: result1.riskFlags,
    pass: result1.riskFlags.includes('Prepayment penalty possible'),
  },
  {
    label: 'recommendedLenders includes "lightstream"',
    expected: true,
    got: result1.recommendedLenders,
    pass: result1.recommendedLenders.includes('lightstream'),
  },
  {
    label: 'recommendedLenders includes "rategenius"',
    expected: true,
    got: result1.recommendedLenders,
    pass: result1.recommendedLenders.includes('rategenius'),
  },
])

// Test 2 — Timing not right: 6 months paid but hasRecentHardInquiry = true
const result2 = simulateRefinanceWindow({
  creditScoreRange: '700-739',
  debts: [
    {
      type: 'auto',
      balance: 12000,
      apr: 17.5,
      minPayment: 350,
      originalLoanAmount: 18000,
      originalTermMonths: 48,
      monthsAlreadyPaid: 6,
      isRefinanceable: true,
    },
  ],
  monthlyFreeCashFlow: 800,
  hasRecentHardInquiry: true,
  recentLatePayments: false,
})
console.log('Test 2 result:', result2)

assert('Test 2: Timing not right — 6mo paid, hasRecentHardInquiry = true', [
  { label: 'eligible', expected: true, got: result2.eligible, pass: result2.eligible === true },
  {
    label: 'windowStatus',
    expected: 'timing_not_right',
    got: result2.windowStatus,
    pass: result2.windowStatus === 'timing_not_right',
  },
  {
    label: 'reason contains "hard inquiry"',
    expected: true,
    got: result2.reason,
    pass: typeof result2.reason === 'string' && result2.reason.includes('hard inquiry'),
  },
])

// Test 3 — Borderline: 620-659 score, no late payments, auto loan at high APR
const result3 = simulateRefinanceWindow({
  creditScoreRange: '620-659',
  debts: [
    {
      type: 'auto',
      balance: 10000,
      apr: 24.9,
      minPayment: 320,
      originalLoanAmount: 14000,
      originalTermMonths: 48,
      monthsAlreadyPaid: 10,
      isRefinanceable: true,
    },
  ],
  monthlyFreeCashFlow: 600,
  hasRecentHardInquiry: false,
  recentLatePayments: false,
})
console.log('Test 3 result:', result3)

assert('Test 3: Borderline — 620-659, no late payments, auto 24.9% APR', [
  { label: 'eligible', expected: true, got: result3.eligible, pass: result3.eligible === true },
  {
    label: 'borderline',
    expected: true,
    got: result3.borderline,
    pass: result3.borderline === true,
  },
  {
    label: 'windowStatus',
    expected: 'borderline',
    got: result3.windowStatus,
    pass: result3.windowStatus === 'borderline',
  },
  {
    label: 'netSavings > 0',
    expected: '> 0',
    got: result3.netSavings,
    pass: result3.netSavings > 0,
  },
  {
    label: 'recommendedLenders includes "lightstream"',
    expected: true,
    got: result3.recommendedLenders,
    pass: result3.recommendedLenders.includes('lightstream'),
  },
])

// Test 4 — Not eligible: recentLatePayments = true
const result4 = simulateRefinanceWindow({
  creditScoreRange: '700-739',
  debts: [
    {
      type: 'personal_loan',
      balance: 8000,
      apr: 22.0,
      minPayment: 280,
      originalLoanAmount: 10000,
      originalTermMonths: 36,
      monthsAlreadyPaid: 12,
      isRefinanceable: true,
    },
  ],
  monthlyFreeCashFlow: 700,
  hasRecentHardInquiry: false,
  recentLatePayments: true,
})
console.log('Test 4 result:', result4)

assert('Test 4: Not eligible — recentLatePayments = true', [
  { label: 'eligible', expected: false, got: result4.eligible, pass: result4.eligible === false },
  {
    label: 'reason contains "late payment"',
    expected: true,
    got: result4.reason,
    pass: typeof result4.reason === 'string' && result4.reason.toLowerCase().includes('late payment'),
  },
  {
    label: 'recommendedLenders is empty',
    expected: [],
    got: result4.recommendedLenders,
    pass: result4.recommendedLenders.length === 0,
  },
])

// Test 5 — Loan too seasoned: 700-739, monthsAlreadyPaid > 60% of original term
const result5 = simulateRefinanceWindow({
  creditScoreRange: '700-739',
  debts: [
    {
      type: 'auto',
      balance: 6000,
      apr: 14.9,
      minPayment: 250,
      originalLoanAmount: 22000,
      originalTermMonths: 60,
      monthsAlreadyPaid: 40, // 40 > 60 * 0.6 = 36
      isRefinanceable: true,
    },
  ],
  monthlyFreeCashFlow: 600,
  hasRecentHardInquiry: false,
  recentLatePayments: false,
})
console.log('Test 5 result:', result5)

assert('Test 5: Loan too seasoned — 700-739, 40/60mo paid', [
  { label: 'eligible', expected: true, got: result5.eligible, pass: result5.eligible === true },
  {
    label: 'riskFlags includes "Loan too seasoned"',
    expected: true,
    got: result5.riskFlags,
    pass: result5.riskFlags.includes('Loan too seasoned'),
  },
  {
    label: 'riskFlags includes "Prepayment penalty possible"',
    expected: true,
    got: result5.riskFlags,
    pass: result5.riskFlags.includes('Prepayment penalty possible'),
  },
  {
    label: 'recommendedLenders includes "penfed"',
    expected: true,
    got: result5.recommendedLenders,
    pass: result5.recommendedLenders.includes('penfed'),
  },
])

console.log(`\n${passed}/${passed + failed} tests passed`)
