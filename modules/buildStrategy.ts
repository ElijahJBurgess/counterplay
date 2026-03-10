import { BalanceTransferResult } from './simulateBalanceTransfer'
import { ConsolidationLoanResult } from './simulateConsolidationLoan'
import { PaydownSequencingResult } from './simulatePaydownSequencing'
import { UtilizationOptimizationResult } from './simulateUtilizationOptimization'
import { RefinanceWindowResult } from './simulateRefinanceWindow'
import { CreditScoreRange } from '@/types'

export interface UserProfile {
  creditScoreRange: CreditScoreRange
  totalDebt: number
  monthlyFreeCashFlow: number
  upcomingApplicationType: 'mortgage' | 'auto_loan' | 'personal_loan' | 'balance_transfer_card' | 'none'
  upcomingApplicationTimeline: '30_days' | '60_days' | '90_days' | '6_months' | 'not_sure'
}

export interface StrategyInput {
  module1: BalanceTransferResult | null
  module2: ConsolidationLoanResult | null
  module3: PaydownSequencingResult | null
  module4: UtilizationOptimizationResult | null
  module5: RefinanceWindowResult | null
  userProfile: UserProfile
}

export interface RankedMove {
  rank: number
  move: string
  impactScore: number
  finalScore: number
  topLineSaving: number
  keyMetric: string
  riskFlags: string[]
  sequenceNote: string | null
}

export interface SequencingRelationship {
  type: 'do_first' | 'parallel'
  primary?: string
  then?: string
  moves?: string[]
  rationale: string
  note?: string
  combinedSavings?: number
}

export interface StrategyObject {
  totalDebt: number
  totalInterestSavingsAvailable: number
  totalMonthsSavingsAvailable: number
  rankedMoves: RankedMove[]
  sequencingRelationships: SequencingRelationship[]
  recommendedFirstAction: string
  profileSummary: {
    creditScoreRange: CreditScoreRange
    totalDebt: number
    monthlyFreeCashFlow: number
    upcomingApplicationType: string
    upcomingApplicationTimeline: string
    eligibleMoveCount: number
  }
}

export interface EmergencyOutput {
  move: 'None Available'
  message: string
  nextSteps: string[]
  returnTrigger: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterEligible(input: StrategyInput): any[] {
  return [
    input.module1,
    input.module2,
    input.module3,
    input.module4,
    input.module5,
  ].filter((m) => m !== null && m.eligible === true)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyContextMultipliers(module: any, userProfile: UserProfile): number {
  let score = module.impactScore

  if (
    module.move === 'Utilization Optimization' &&
    userProfile.upcomingApplicationTimeline === '30_days'
  ) {
    score *= 1.4
  }

  if (
    module.move === 'Utilization Optimization' &&
    userProfile.upcomingApplicationTimeline === '60_days'
  ) {
    score *= 1.25
  }

  if (
    module.move === 'Aggressive Paydown Sequencing' &&
    userProfile.creditScoreRange === '620-659'
  ) {
    score *= 1.2
  }

  if (
    ['Balance Transfer', 'Debt Consolidation Loan', 'Refinance Timing Window'].includes(
      module.move
    ) &&
    userProfile.creditScoreRange === '660-699' &&
    userProfile.upcomingApplicationType !== 'none'
  ) {
    score *= 0.85
  }

  const netSavings = module.netSavings ?? module.netInterestSaved ?? 0
  if (netSavings < 500) {
    score = Math.min(score, 50)
  }

  return Math.max(0, Math.min(100, score))
}

function detectSequencingRelationships(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eligibleMoves: any[],
  userProfile: UserProfile
): SequencingRelationship[] {
  const relationships: SequencingRelationship[] = []

  const util = eligibleMoves.find((m) => m.move === 'Utilization Optimization')
  const refi = eligibleMoves.find((m) => m.move === 'Refinance Timing Window')
  const bt = eligibleMoves.find((m) => m.move === 'Balance Transfer')
  const consol = eligibleMoves.find((m) => m.move === 'Debt Consolidation Loan')
  const seq = eligibleMoves.find((m) => m.move === 'Aggressive Paydown Sequencing')

  if (util && refi && refi.scoreBandOpportunity) {
    relationships.push({
      type: 'do_first',
      primary: 'Utilization Optimization',
      then: 'Refinance Timing Window',
      rationale: 'Improving utilization first unlocks a better refinance rate.',
      combinedSavings: (util.estimatedDollarSavingsOnLoan ?? 0) + (refi.netSavings ?? 0),
    })
  }

  if (util && bt && userProfile.creditScoreRange === '660-699') {
    relationships.push({
      type: 'do_first',
      primary: 'Utilization Optimization',
      then: 'Balance Transfer',
      rationale:
        'A score bump from utilization improvement increases approval odds and available credit limit for the transfer.',
      combinedSavings:
        (util.estimatedDollarSavingsOnLoan ?? 0) + (bt.netInterestSaved ?? 0),
    })
  }

  if (seq && consol) {
    relationships.push({
      type: 'parallel',
      moves: ['Debt Consolidation Loan', 'Aggressive Paydown Sequencing'],
      rationale:
        'Consolidate first to lower your rate, then attack the consolidated balance with sequencing logic.',
      note: 'These work together — consolidation sets the rate, sequencing accelerates the payoff.',
    })
  }

  if (seq && bt) {
    relationships.push({
      type: 'parallel',
      moves: ['Balance Transfer', 'Aggressive Paydown Sequencing'],
      rationale:
        'Transfer the balance to 0%, then apply sequencing logic to clear it before the promo window closes.',
      note: 'The transfer buys you time. The sequencing makes sure you use it.',
    })
  }

  return relationships
}

function buildFinalRanking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eligibleMoves: any[],
  relationships: SequencingRelationship[],
  userProfile: UserProfile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const scored = eligibleMoves.map((m) => ({
    ...m,
    finalScore: applyContextMultipliers(m, userProfile),
    sequenceNote: null as string | null,
  }))

  const ranked = scored.sort((a, b) => b.finalScore - a.finalScore)

  relationships.forEach((rel) => {
    if (rel.type === 'do_first' && rel.primary && rel.then) {
      const primaryIndex = ranked.findIndex((m) => m.move === rel.primary)
      const thenIndex = ranked.findIndex((m) => m.move === rel.then)

      if (primaryIndex !== -1 && thenIndex !== -1 && primaryIndex > thenIndex) {
        const temp = ranked[thenIndex]
        ranked[thenIndex] = { ...ranked[primaryIndex], sequenceNote: rel.rationale }
        ranked[primaryIndex] = temp
      }
    }
  })

  return ranked
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getKeyMetric(module: any): string {
  switch (module.move) {
    case 'Balance Transfer':
      return `$${Math.round(module.netInterestSaved ?? 0)} saved, ${module.monthsSaved ?? 0} months sooner`
    case 'Debt Consolidation Loan':
      return `$${Math.round(module.monthlyPaymentDelta ?? 0)}/month freed, $${Math.round(module.netSavings ?? 0)} total saved`
    case 'Aggressive Paydown Sequencing':
      return `Debt-free ${module.optimizedProjection?.monthsSaved ?? 0} months sooner`
    case 'Utilization Optimization':
      return `$${Math.round(module.estimatedDollarSavingsOnLoan ?? 0)} saved on upcoming ${module.upcomingApplication ?? 'loan'}`
    case 'Refinance Timing Window':
      return `$${Math.round(module.netSavings ?? 0)} saved, $${Math.round(module.monthlyPaymentDelta ?? 0)}/month freed`
    default:
      return ''
  }
}

function assembleStrategyObject(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rankedMoves: any[],
  relationships: SequencingRelationship[],
  userProfile: UserProfile
): StrategyObject {
  return {
    totalDebt: userProfile.totalDebt,
    totalInterestSavingsAvailable: rankedMoves.reduce(
      (sum, m) => sum + (m.netSavings ?? m.netInterestSaved ?? m.totalInterestSaved ?? 0),
      0
    ),
    totalMonthsSavingsAvailable: Math.max(
      0,
      ...rankedMoves.map((m) => m.monthsSaved ?? m.optimizedProjection?.monthsSaved ?? 0)
    ),
    rankedMoves: rankedMoves.map((m, index) => ({
      rank: index + 1,
      move: m.move,
      impactScore: m.impactScore,
      finalScore: Math.round(m.finalScore),
      topLineSaving: Math.round(
        m.netSavings ?? m.netInterestSaved ?? m.totalInterestSaved ?? 0
      ),
      keyMetric: getKeyMetric(m),
      riskFlags: m.riskFlags ?? [],
      sequenceNote: m.sequenceNote ?? null,
    })),
    sequencingRelationships: relationships,
    recommendedFirstAction: rankedMoves[0]?.move ?? '',
    profileSummary: {
      creditScoreRange: userProfile.creditScoreRange,
      totalDebt: userProfile.totalDebt,
      monthlyFreeCashFlow: userProfile.monthlyFreeCashFlow,
      upcomingApplicationType: userProfile.upcomingApplicationType,
      upcomingApplicationTimeline: userProfile.upcomingApplicationTimeline,
      eligibleMoveCount: rankedMoves.length,
    },
  }
}

function emergencyOutput(): EmergencyOutput {
  return {
    move: 'None Available',
    message:
      "Based on your current profile, none of our optimization moves apply right now. This is usually because your credit score needs to move before lenders will offer better terms, or your debt load relative to income needs to shift first.",
    nextSteps: [
      'Focus on on-time payments for 6 months',
      'Reduce utilization below 30% on all cards',
      'Return and re-run when either of those change',
    ],
    returnTrigger:
      'Come back when your score moves up one band or your utilization drops below 30%.',
  }
}

export function buildStrategy(input: StrategyInput): StrategyObject | EmergencyOutput {
  const eligibleMoves = filterEligible(input)

  if (eligibleMoves.length === 0) {
    return emergencyOutput()
  }

  const relationships = detectSequencingRelationships(eligibleMoves, input.userProfile)
  const rankedMoves = buildFinalRanking(eligibleMoves, relationships, input.userProfile)
  return assembleStrategyObject(rankedMoves, relationships, input.userProfile)
}
