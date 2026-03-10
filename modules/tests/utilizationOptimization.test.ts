import { simulateUtilizationOptimization } from '../simulateUtilizationOptimization'

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

// Test 1 — Eligible: 660-699, two revolving cards at high utilization, auto loan in 60 days
// Card 1: $4000/$5000 = 80%, Card 2: $3500/$5000 = 70%, overall: 7500/10000 = 75%
const result1 = simulateUtilizationOptimization({
  creditScoreRange: '660-699',
  debts: [
    {
      type: 'credit_card',
      balance: 4000,
      apr: 24.99,
      minPayment: 120,
      creditLimit: 5000,
      isRevolving: true,
    },
    {
      type: 'credit_card',
      balance: 3500,
      apr: 19.99,
      minPayment: 105,
      creditLimit: 5000,
      isRevolving: true,
    },
  ],
  monthlyFreeCashFlow: 800,
  upcomingApplicationType: 'auto_loan',
  upcomingApplicationTimeline: '60_days',
})
console.log('Test 1 result:', result1)

assert('Test 1: Eligible, high utilization, auto loan in 60 days', [
  { label: 'eligible', expected: true, got: result1.eligible, pass: result1.eligible === true },
  {
    label: 'backgroundOnly',
    expected: false,
    got: result1.backgroundOnly,
    pass: result1.backgroundOnly === false,
  },
  {
    label: 'currentOverallUtilization',
    expected: 75,
    got: result1.currentOverallUtilization,
    pass: Math.abs(result1.currentOverallUtilization - 75) < 0.01,
  },
  {
    label: 'paydownPlan.length > 0',
    expected: '> 0',
    got: result1.paydownPlan.length,
    pass: result1.paydownPlan.length > 0,
  },
  {
    label: 'riskFlags includes "Statement timing critical"',
    expected: true,
    got: result1.riskFlags,
    pass: result1.riskFlags.includes('Statement timing critical'),
  },
  {
    label: 'riskFlags includes "Hard inquiry will temporarily drop score"',
    expected: true,
    got: result1.riskFlags,
    pass: result1.riskFlags.includes('Hard inquiry will temporarily drop score'),
  },
])

// Test 2 — Background only: high utilization but upcomingApplicationType = 'none'
// Card: $3000/$5000 = 60% utilization
const result2 = simulateUtilizationOptimization({
  creditScoreRange: '700-739',
  debts: [
    {
      type: 'credit_card',
      balance: 3000,
      apr: 22.99,
      minPayment: 90,
      creditLimit: 5000,
      isRevolving: true,
    },
  ],
  monthlyFreeCashFlow: 500,
  upcomingApplicationType: 'none',
  upcomingApplicationTimeline: 'not_sure',
})
console.log('Test 2 result:', result2)

assert('Test 2: Background only, no upcoming application', [
  { label: 'eligible', expected: true, got: result2.eligible, pass: result2.eligible === true },
  {
    label: 'backgroundOnly',
    expected: true,
    got: result2.backgroundOnly,
    pass: result2.backgroundOnly === true,
  },
  {
    label: 'currentOverallUtilization',
    expected: 60,
    got: result2.currentOverallUtilization,
    pass: Math.abs(result2.currentOverallUtilization - 60) < 0.01,
  },
  {
    label: 'riskFlags includes "Statement timing critical"',
    expected: true,
    got: result2.riskFlags,
    pass: result2.riskFlags.includes('Statement timing critical'),
  },
  {
    label: 'riskFlags does NOT include "Hard inquiry will temporarily drop score"',
    expected: false,
    got: result2.riskFlags.includes('Hard inquiry will temporarily drop score'),
    pass: !result2.riskFlags.includes('Hard inquiry will temporarily drop score'),
  },
  {
    label: 'estimatedDollarSavingsOnLoan',
    expected: 0,
    got: result2.estimatedDollarSavingsOnLoan,
    pass: result2.estimatedDollarSavingsOnLoan === 0,
  },
])

// Test 3 — Not eligible: no revolving debts
const result3 = simulateUtilizationOptimization({
  creditScoreRange: '660-699',
  debts: [
    {
      type: 'personal_loan',
      balance: 8000,
      apr: 12.5,
      minPayment: 240,
      creditLimit: 0,
      isRevolving: false,
    },
    {
      type: 'auto',
      balance: 12000,
      apr: 6.9,
      minPayment: 320,
      creditLimit: 0,
      isRevolving: false,
    },
  ],
  monthlyFreeCashFlow: 600,
  upcomingApplicationType: 'personal_loan',
  upcomingApplicationTimeline: '90_days',
})
console.log('Test 3 result:', result3)

assert('Test 3: Not eligible, no revolving debts', [
  { label: 'eligible', expected: false, got: result3.eligible, pass: result3.eligible === false },
  {
    label: 'backgroundOnly',
    expected: false,
    got: result3.backgroundOnly,
    pass: result3.backgroundOnly === false,
  },
  {
    label: 'reason',
    expected: 'No revolving credit accounts found.',
    got: result3.reason,
    pass: result3.reason === 'No revolving credit accounts found.',
  },
])

// Test 4 — Not eligible: utilization below 10%
// Card: $200/$8000 = 2.5% utilization
const result4 = simulateUtilizationOptimization({
  creditScoreRange: '740+',
  debts: [
    {
      type: 'credit_card',
      balance: 200,
      apr: 18.99,
      minPayment: 25,
      creditLimit: 8000,
      isRevolving: true,
    },
  ],
  monthlyFreeCashFlow: 1000,
  upcomingApplicationType: 'mortgage',
  upcomingApplicationTimeline: '90_days',
})
console.log('Test 4 result:', result4)

assert('Test 4: Not eligible, utilization below 10%', [
  { label: 'eligible', expected: false, got: result4.eligible, pass: result4.eligible === false },
  {
    label: 'reason',
    expected: 'Utilization is already optimal.',
    got: result4.reason,
    pass: result4.reason === 'Utilization is already optimal.',
  },
  {
    label: 'currentOverallUtilization < 10',
    expected: '< 10',
    got: result4.currentOverallUtilization,
    pass: result4.currentOverallUtilization < 10,
  },
])

// Test 5 — Eligible: 700-739, mortgage in 90 days, one card above 90% + low overall (<50%)
// Card 1: $9500/$10000 = 95%, Card 2: $500/$15000 = 3.3%, overall: 10000/25000 = 40%
// "Per card concentration" triggers: card1 > 80% AND overall < 50%
const result5 = simulateUtilizationOptimization({
  creditScoreRange: '700-739',
  debts: [
    {
      type: 'credit_card',
      balance: 9500,
      apr: 24.99,
      minPayment: 285,
      creditLimit: 10000,
      isRevolving: true,
    },
    {
      type: 'credit_card',
      balance: 500,
      apr: 18.99,
      minPayment: 25,
      creditLimit: 15000,
      isRevolving: true,
    },
  ],
  monthlyFreeCashFlow: 1500,
  upcomingApplicationType: 'mortgage',
  upcomingApplicationTimeline: '90_days',
})
console.log('Test 5 result:', result5)

assert('Test 5: Eligible, 700-739, mortgage, one card above 90%', [
  { label: 'eligible', expected: true, got: result5.eligible, pass: result5.eligible === true },
  {
    label: 'backgroundOnly',
    expected: false,
    got: result5.backgroundOnly,
    pass: result5.backgroundOnly === false,
  },
  {
    label: 'currentOverallUtilization is 40',
    expected: 40,
    got: result5.currentOverallUtilization,
    pass: Math.abs(result5.currentOverallUtilization - 40) < 0.01,
  },
  {
    label: 'paydownPlan.length > 0',
    expected: '> 0',
    got: result5.paydownPlan.length,
    pass: result5.paydownPlan.length > 0,
  },
  {
    label: 'paydownPlan targets card at index 0 (the 95% card)',
    expected: 0,
    got: result5.paydownPlan[0]?.cardIndex,
    pass: result5.paydownPlan[0]?.cardIndex === 0,
  },
  {
    label: 'riskFlags includes "Statement timing critical"',
    expected: true,
    got: result5.riskFlags,
    pass: result5.riskFlags.includes('Statement timing critical'),
  },
  {
    label: 'riskFlags includes "Per card concentration"',
    expected: true,
    got: result5.riskFlags,
    pass: result5.riskFlags.includes('Per card concentration'),
  },
])

console.log(`\n${passed}/${passed + failed} tests passed`)
