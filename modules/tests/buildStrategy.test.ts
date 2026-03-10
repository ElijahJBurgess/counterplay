import { buildStrategy, StrategyObject, EmergencyOutput } from '../buildStrategy'
import { BalanceTransferResult } from '../simulateBalanceTransfer'
import { PaydownSequencingResult } from '../simulatePaydownSequencing'
import { UtilizationOptimizationResult } from '../simulateUtilizationOptimization'

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

function isStrategyObject(result: unknown): result is StrategyObject {
  return typeof result === 'object' && result !== null && 'rankedMoves' in result
}

function isEmergencyOutput(result: unknown): result is EmergencyOutput {
  return typeof result === 'object' && result !== null && (result as EmergencyOutput).move === 'None Available'
}

// Shared mock builders
function makeBtEligible(impactScore: number): BalanceTransferResult {
  return {
    move: 'Balance Transfer',
    eligible: true,
    borderline: false,
    currentInterestCost: 1800,
    transferFee: 300,
    netInterestSaved: 1200,
    monthsSaved: 6,
    requiredMonthlyPayment: 250,
    clearedInPromoWindow: true,
    conservativeScenario: { clearedInWindow: true, requiredMonthlyToClean: 250 },
    riskFlags: [],
    recommendedCards: ['chase_freedom'],
    impactScore,
  }
}

function makeSeqEligible(impactScore: number): PaydownSequencingResult {
  return {
    move: 'Aggressive Paydown Sequencing',
    eligible: true,
    cashFlowNegative: false,
    singleDebt: false,
    recommendedMethod: 'avalanche',
    currentMinimumOnlyProjection: { totalInterestPaid: 8000, monthsToDebtFree: 48 },
    optimizedProjection: {
      totalInterestPaid: 5000,
      monthsToDebtFree: 40,
      interestSaved: 3000,
      monthsSaved: 8,
    },
    payoffSchedule: [],
    cashFlowUnlockTimeline: [],
    extraAllocationScenarios: [],
    riskFlags: [],
    impactScore,
  }
}

function makeUtilEligible(impactScore: number): UtilizationOptimizationResult {
  return {
    move: 'Utilization Optimization',
    eligible: true,
    backgroundOnly: false,
    currentOverallUtilization: 55,
    targetUtilization: 9,
    estimatedPointsLost: 55,
    estimatedPointsRecoverable: 45,
    currentScoreRange: '700-739',
    projectedScoreRangeAfter: '740+',
    balanceReductionNeeded: 2000,
    feasibleWithinTimeline: true,
    upcomingApplication: 'Auto loan',
    estimatedRateImprovement: 1.5,
    estimatedDollarSavingsOnLoan: 800,
    paydownPlan: [],
    recommendedActionsBy: 'Within the next 2 statement cycles',
    riskFlags: ['Statement timing critical'],
    impactScore,
  }
}

// ─── Test 1: Full strategy — 3 eligible modules ───────────────────────────────
// Module 1 (bt, impactScore 45), Module 3 (seq, impactScore 35),
// Module 4 (util, impactScore 40). Timeline = 60_days → util * 1.25 = 50.
// Expected ranking: util (50) > bt (45) > seq (35).
// Sequencing: bt + seq → parallel relationship detected.

const result1 = buildStrategy({
  module1: makeBtEligible(45),
  module2: null,
  module3: makeSeqEligible(35),
  module4: makeUtilEligible(40),
  module5: null,
  userProfile: {
    creditScoreRange: '700-739',
    totalDebt: 18000,
    monthlyFreeCashFlow: 800,
    upcomingApplicationType: 'none',
    upcomingApplicationTimeline: '60_days',
  },
})
console.log('Test 1 result:', JSON.stringify(result1, null, 2))

assert('Test 1: Full strategy — 3 eligible modules', [
  {
    label: 'is StrategyObject',
    expected: true,
    got: isStrategyObject(result1),
    pass: isStrategyObject(result1),
  },
  {
    label: 'rankedMoves.length',
    expected: 3,
    got: isStrategyObject(result1) ? result1.rankedMoves.length : 'N/A',
    pass: isStrategyObject(result1) && result1.rankedMoves.length === 3,
  },
  {
    label: 'util finalScore = 50 (40 * 1.25)',
    expected: 50,
    got: isStrategyObject(result1)
      ? result1.rankedMoves.find((m) => m.move === 'Utilization Optimization')?.finalScore
      : 'N/A',
    pass:
      isStrategyObject(result1) &&
      result1.rankedMoves.find((m) => m.move === 'Utilization Optimization')?.finalScore === 50,
  },
  {
    label: 'recommendedFirstAction',
    expected: 'Utilization Optimization',
    got: isStrategyObject(result1) ? result1.recommendedFirstAction : 'N/A',
    pass:
      isStrategyObject(result1) &&
      result1.recommendedFirstAction === 'Utilization Optimization',
  },
  {
    label: 'parallel sequencing relationship for bt + seq',
    expected: true,
    got: isStrategyObject(result1)
      ? result1.sequencingRelationships.some(
          (r) =>
            r.type === 'parallel' &&
            r.moves?.includes('Balance Transfer') &&
            r.moves?.includes('Aggressive Paydown Sequencing')
        )
      : false,
    pass:
      isStrategyObject(result1) &&
      result1.sequencingRelationships.some(
        (r) =>
          r.type === 'parallel' &&
          r.moves?.includes('Balance Transfer') &&
          r.moves?.includes('Aggressive Paydown Sequencing')
      ),
  },
  {
    label: 'rankedMoves in descending finalScore order',
    expected: true,
    got: isStrategyObject(result1)
      ? result1.rankedMoves.every(
          (m, i, arr) => i === 0 || arr[i - 1].finalScore >= m.finalScore
        )
      : false,
    pass:
      isStrategyObject(result1) &&
      result1.rankedMoves.every(
        (m, i, arr) => i === 0 || arr[i - 1].finalScore >= m.finalScore
      ),
  },
])

// ─── Test 2: Sequencing enforcement — do_first util before bt ─────────────────
// creditScoreRange = '660-699', upcomingApplicationType = 'auto_loan'.
// util impactScore=30, bt impactScore=50.
// bt finalScore = 50 * 0.85 = 42.5 → rounds to 43.
// After sorting: [bt (43), util (30)].
// do_first util→bt: primaryIndex(1) > thenIndex(0) → swap → [util, bt].
// Verify: util at rank 1 with sequenceNote set.

const result2 = buildStrategy({
  module1: makeBtEligible(50),
  module2: null,
  module3: null,
  module4: {
    ...makeUtilEligible(30),
    currentScoreRange: '660-699',
  },
  module5: null,
  userProfile: {
    creditScoreRange: '660-699',
    totalDebt: 12000,
    monthlyFreeCashFlow: 600,
    upcomingApplicationType: 'auto_loan',
    upcomingApplicationTimeline: '90_days',
  },
})
console.log('Test 2 result:', JSON.stringify(result2, null, 2))

assert('Test 2: Sequencing enforcement — util do_first before bt', [
  {
    label: 'is StrategyObject',
    expected: true,
    got: isStrategyObject(result2),
    pass: isStrategyObject(result2),
  },
  {
    label: 'rankedMoves[0].move',
    expected: 'Utilization Optimization',
    got: isStrategyObject(result2) ? result2.rankedMoves[0].move : 'N/A',
    pass:
      isStrategyObject(result2) &&
      result2.rankedMoves[0].move === 'Utilization Optimization',
  },
  {
    label: 'rankedMoves[1].move',
    expected: 'Balance Transfer',
    got: isStrategyObject(result2) ? result2.rankedMoves[1].move : 'N/A',
    pass:
      isStrategyObject(result2) && result2.rankedMoves[1].move === 'Balance Transfer',
  },
  {
    label: 'rankedMoves[0].sequenceNote is set',
    expected: true,
    got: isStrategyObject(result2) ? result2.rankedMoves[0].sequenceNote : null,
    pass:
      isStrategyObject(result2) &&
      typeof result2.rankedMoves[0].sequenceNote === 'string' &&
      result2.rankedMoves[0].sequenceNote.length > 0,
  },
  {
    label: 'do_first relationship present',
    expected: true,
    got: isStrategyObject(result2)
      ? result2.sequencingRelationships.some(
          (r) =>
            r.type === 'do_first' &&
            r.primary === 'Utilization Optimization' &&
            r.then === 'Balance Transfer'
        )
      : false,
    pass:
      isStrategyObject(result2) &&
      result2.sequencingRelationships.some(
        (r) =>
          r.type === 'do_first' &&
          r.primary === 'Utilization Optimization' &&
          r.then === 'Balance Transfer'
      ),
  },
])

// ─── Test 3: Emergency output — all modules null or ineligible ────────────────

const result3 = buildStrategy({
  module1: null,
  module2: null,
  module3: null,
  module4: null,
  module5: null,
  userProfile: {
    creditScoreRange: '580-619',
    totalDebt: 5000,
    monthlyFreeCashFlow: 200,
    upcomingApplicationType: 'none',
    upcomingApplicationTimeline: 'not_sure',
  },
})
console.log('Test 3 result:', JSON.stringify(result3, null, 2))

assert('Test 3: Emergency output — all modules null', [
  {
    label: 'is EmergencyOutput',
    expected: true,
    got: isEmergencyOutput(result3),
    pass: isEmergencyOutput(result3),
  },
  {
    label: 'move',
    expected: 'None Available',
    got: isEmergencyOutput(result3) ? result3.move : 'N/A',
    pass: isEmergencyOutput(result3) && result3.move === 'None Available',
  },
  {
    label: 'nextSteps.length > 0',
    expected: true,
    got: isEmergencyOutput(result3) ? result3.nextSteps.length : 0,
    pass: isEmergencyOutput(result3) && result3.nextSteps.length > 0,
  },
  {
    label: 'returnTrigger is set',
    expected: true,
    got: isEmergencyOutput(result3) ? result3.returnTrigger.length > 0 : false,
    pass: isEmergencyOutput(result3) && result3.returnTrigger.length > 0,
  },
])

// ─── Test 4: Single module eligible — only Module 3 (sequencing) ──────────────

const result4 = buildStrategy({
  module1: null,
  module2: null,
  module3: makeSeqEligible(60),
  module4: null,
  module5: null,
  userProfile: {
    creditScoreRange: '700-739',
    totalDebt: 20000,
    monthlyFreeCashFlow: 1000,
    upcomingApplicationType: 'none',
    upcomingApplicationTimeline: 'not_sure',
  },
})
console.log('Test 4 result:', JSON.stringify(result4, null, 2))

assert('Test 4: Single module — only sequencing eligible', [
  {
    label: 'is StrategyObject',
    expected: true,
    got: isStrategyObject(result4),
    pass: isStrategyObject(result4),
  },
  {
    label: 'rankedMoves.length',
    expected: 1,
    got: isStrategyObject(result4) ? result4.rankedMoves.length : 'N/A',
    pass: isStrategyObject(result4) && result4.rankedMoves.length === 1,
  },
  {
    label: 'recommendedFirstAction',
    expected: 'Aggressive Paydown Sequencing',
    got: isStrategyObject(result4) ? result4.recommendedFirstAction : 'N/A',
    pass:
      isStrategyObject(result4) &&
      result4.recommendedFirstAction === 'Aggressive Paydown Sequencing',
  },
  {
    label: 'sequencingRelationships.length',
    expected: 0,
    got: isStrategyObject(result4) ? result4.sequencingRelationships.length : 'N/A',
    pass: isStrategyObject(result4) && result4.sequencingRelationships.length === 0,
  },
  {
    label: 'profileSummary.eligibleMoveCount',
    expected: 1,
    got: isStrategyObject(result4) ? result4.profileSummary.eligibleMoveCount : 'N/A',
    pass: isStrategyObject(result4) && result4.profileSummary.eligibleMoveCount === 1,
  },
])

console.log(`\n${passed}/${passed + failed} tests passed`)
