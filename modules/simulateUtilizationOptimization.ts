import { CreditScoreRange, Debt } from '@/types'

export interface RevolvingDebt extends Debt {
  creditLimit: number
  isRevolving: boolean
}

export interface UtilizationInput {
  creditScoreRange: CreditScoreRange
  debts: RevolvingDebt[]
  monthlyFreeCashFlow: number
  upcomingApplicationType:
    | 'mortgage'
    | 'auto_loan'
    | 'personal_loan'
    | 'balance_transfer_card'
    | 'none'
  upcomingApplicationTimeline:
    | '30_days'
    | '60_days'
    | '90_days'
    | '6_months'
    | 'not_sure'
}

export interface UtilizationOptimizationResult {
  move: 'Utilization Optimization'
  eligible: boolean
  backgroundOnly: boolean
  currentOverallUtilization: number
  targetUtilization: number
  estimatedPointsLost: number
  estimatedPointsRecoverable: number
  currentScoreRange: CreditScoreRange
  projectedScoreRangeAfter: CreditScoreRange
  balanceReductionNeeded: number
  feasibleWithinTimeline: boolean
  upcomingApplication: string
  estimatedRateImprovement: number
  estimatedDollarSavingsOnLoan: number
  paydownPlan: {
    cardIndex: number
    currentBalance: number
    targetBalance: number
    paydown: number
  }[]
  recommendedActionsBy: string
  riskFlags: string[]
  impactScore: number
  reason?: string
}

const SCORE_RANGES: CreditScoreRange[] = [
  '580-619',
  '620-659',
  '660-699',
  '700-739',
  '740+',
]

const LOAN_AMOUNTS: Record<string, number> = {
  mortgage: 280000,
  auto_loan: 28000,
  personal_loan: 12000,
  balance_transfer_card: 5000,
  none: 0,
}

const RATE_IMPROVEMENTS_PER_BAND: Record<string, number> = {
  mortgage: 0.5,
  auto_loan: 1.5,
  personal_loan: 2.0,
  balance_transfer_card: 1.0,
  none: 0,
}

const APPLICATION_NAMES: Record<string, string> = {
  mortgage: 'Mortgage',
  auto_loan: 'Auto loan',
  personal_loan: 'Personal loan',
  balance_transfer_card: 'Balance transfer card',
  none: 'None',
}

const TARGET_UTILIZATION = 9

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function getPointsLost(utilization: number): number {
  if (utilization <= 10) return 0
  if (utilization <= 30) return 10
  if (utilization <= 50) return 30
  if (utilization <= 70) return 55
  if (utilization <= 90) return 90
  return 125
}

function getTimelineMonths(timeline: string): number {
  switch (timeline) {
    case '30_days': return 1
    case '60_days': return 2
    case '90_days': return 3
    case '6_months': return 6
    default: return 3
  }
}

export function calculateUtilization(debts: RevolvingDebt[]): {
  overallUtilization: number
  totalRevolvingBalance: number
  totalRevolvingLimit: number
  perCardUtilization: { cardIndex: number; balance: number; limit: number; utilization: number }[]
  highUtilizationCards: { cardIndex: number; balance: number; limit: number; utilization: number }[]
} {
  const perCardUtilization = debts
    .map((d, i) => {
      if (!d.isRevolving || d.creditLimit <= 0) return null
      const balance = Math.max(0, sanitizeNumber(d.balance))
      const limit = Math.max(0, sanitizeNumber(d.creditLimit))
      const utilization = limit > 0 ? (balance / limit) * 100 : 0
      return { cardIndex: i, balance, limit, utilization }
    })
    .filter((x): x is { cardIndex: number; balance: number; limit: number; utilization: number } => x !== null)

  const totalRevolvingBalance = perCardUtilization.reduce((sum, c) => sum + c.balance, 0)
  const totalRevolvingLimit = perCardUtilization.reduce((sum, c) => sum + c.limit, 0)
  const overallUtilization =
    totalRevolvingLimit > 0
      ? sanitizeNumber((totalRevolvingBalance / totalRevolvingLimit) * 100)
      : 0
  const highUtilizationCards = perCardUtilization.filter((c) => c.utilization > 30)

  return {
    overallUtilization,
    totalRevolvingBalance,
    totalRevolvingLimit,
    perCardUtilization,
    highUtilizationCards,
  }
}

export function estimateScoreImpact(
  currentUtilization: number,
  targetUtilization: number
): { pointsLost: number; pointsRecoverable: number } {
  const pointsLost = getPointsLost(sanitizeNumber(currentUtilization))
  const pointsLostAtTarget = getPointsLost(sanitizeNumber(targetUtilization))
  const pointsRecoverable = Math.max(0, pointsLost - pointsLostAtTarget)
  return { pointsLost, pointsRecoverable }
}

export function getNextScoreRange(current: CreditScoreRange): CreditScoreRange {
  const idx = SCORE_RANGES.indexOf(current)
  return SCORE_RANGES[Math.min(idx + 1, SCORE_RANGES.length - 1)]
}

export function simulateRateUnlock(
  currentScoreRange: CreditScoreRange,
  projectedScoreRange: CreditScoreRange,
  upcomingApplicationType: string
): { estimatedRateImprovement: number; estimatedDollarSavingsOnLoan: number } {
  if (
    currentScoreRange === projectedScoreRange ||
    upcomingApplicationType === 'none'
  ) {
    return { estimatedRateImprovement: 0, estimatedDollarSavingsOnLoan: 0 }
  }

  const rateImprovement = sanitizeNumber(
    RATE_IMPROVEMENTS_PER_BAND[upcomingApplicationType] ?? 0
  )
  const loanAmount = sanitizeNumber(LOAN_AMOUNTS[upcomingApplicationType] ?? 0)
  const estimatedDollarSavingsOnLoan = loanAmount * (rateImprovement / 100) * 3

  return {
    estimatedRateImprovement: rateImprovement,
    estimatedDollarSavingsOnLoan: sanitizeNumber(estimatedDollarSavingsOnLoan),
  }
}

export function prioritizePaydown(
  debts: RevolvingDebt[],
  balanceReductionNeeded: number,
  availableCash: number
): { cardIndex: number; currentBalance: number; targetBalance: number; paydown: number }[] {
  const revolving = debts
    .map((d, i) => ({ debt: d, originalIndex: i }))
    .filter(({ debt }) => debt.isRevolving && debt.creditLimit > 0)

  const payments = new Map<number, number>()
  let budget = Math.min(
    Math.max(0, sanitizeNumber(balanceReductionNeeded)),
    Math.max(0, sanitizeNumber(availableCash))
  )

  const adjBalance = (idx: number, balance: number) =>
    Math.max(0, balance - (payments.get(idx) ?? 0))

  const byUtil = [...revolving].sort(
    (a, b) =>
      b.debt.balance / b.debt.creditLimit - a.debt.balance / a.debt.creditLimit
  )

  // Step 1: Bring cards above 90% below 90%
  for (const { debt, originalIndex } of byUtil) {
    const curr = adjBalance(originalIndex, debt.balance)
    const util = (curr / debt.creditLimit) * 100
    if (util <= 90) break
    const target = debt.creditLimit * 0.9
    const needed = Math.max(0, curr - target)
    const pay = Math.min(needed, budget)
    if (pay > 0) {
      payments.set(originalIndex, (payments.get(originalIndex) ?? 0) + pay)
      budget -= pay
    }
  }

  // Step 2: Bring cards above 50% below 50%
  for (const { debt, originalIndex } of byUtil) {
    const curr = adjBalance(originalIndex, debt.balance)
    const util = (curr / debt.creditLimit) * 100
    if (util <= 50) continue
    const target = debt.creditLimit * 0.5
    const needed = Math.max(0, curr - target)
    const pay = Math.min(needed, budget)
    if (pay > 0) {
      payments.set(originalIndex, (payments.get(originalIndex) ?? 0) + pay)
      budget -= pay
    }
  }

  // Step 3: Bring remaining cards below 30%, smallest paydown first (maximize cards cleared)
  const above30 = revolving
    .map(({ debt, originalIndex }) => {
      const curr = adjBalance(originalIndex, debt.balance)
      const target30 = debt.creditLimit * 0.3
      const needed = Math.max(0, curr - target30)
      return { originalIndex, needed }
    })
    .filter((x) => x.needed > 0)
    .sort((a, b) => a.needed - b.needed)

  for (const { originalIndex, needed } of above30) {
    const pay = Math.min(needed, budget)
    if (pay > 0) {
      payments.set(originalIndex, (payments.get(originalIndex) ?? 0) + pay)
      budget -= pay
    }
  }

  return Array.from(payments.entries())
    .filter(([, pay]) => pay > 0)
    .map(([idx, paydown]) => ({
      cardIndex: idx,
      currentBalance: debts[idx].balance,
      targetBalance: Math.max(0, debts[idx].balance - paydown),
      paydown,
    }))
    .sort((a, b) => a.cardIndex - b.cardIndex)
}

export function calculateFeasibility(
  balanceReductionNeeded: number,
  monthlyFreeCashFlow: number,
  timeline: string
): boolean {
  const needed = Math.max(0, sanitizeNumber(balanceReductionNeeded))
  const monthly = Math.max(0, sanitizeNumber(monthlyFreeCashFlow))
  switch (timeline) {
    case '30_days': return needed <= monthly
    case '60_days': return needed <= monthly * 2
    case '90_days': return needed <= monthly * 3
    case '6_months': return needed <= monthly * 6
    default: return true
  }
}

export function getRecommendedActionsBy(timeline: string): string {
  switch (timeline) {
    case '60_days': return 'Within the next 2 statement cycles'
    case '90_days': return 'Within the next 3 statement cycles'
    case '6_months': return 'Within the next 6 months'
    default: return 'Before your next statement close date'
  }
}

function buildIneligibleResult(
  creditScoreRange: CreditScoreRange,
  reason: string
): UtilizationOptimizationResult {
  return {
    move: 'Utilization Optimization',
    eligible: false,
    backgroundOnly: false,
    currentOverallUtilization: 0,
    targetUtilization: TARGET_UTILIZATION,
    estimatedPointsLost: 0,
    estimatedPointsRecoverable: 0,
    currentScoreRange: creditScoreRange,
    projectedScoreRangeAfter: creditScoreRange,
    balanceReductionNeeded: 0,
    feasibleWithinTimeline: false,
    upcomingApplication: '',
    estimatedRateImprovement: 0,
    estimatedDollarSavingsOnLoan: 0,
    paydownPlan: [],
    recommendedActionsBy: '',
    riskFlags: [],
    impactScore: 0,
    reason,
  }
}

export function simulateUtilizationOptimization(
  input: UtilizationInput
): UtilizationOptimizationResult {
  const {
    creditScoreRange,
    debts,
    monthlyFreeCashFlow,
    upcomingApplicationType,
    upcomingApplicationTimeline,
  } = input

  const {
    overallUtilization,
    totalRevolvingBalance,
    totalRevolvingLimit,
    perCardUtilization,
  } = calculateUtilization(debts)

  const revolvingCount = debts.filter((d) => d.isRevolving && d.creditLimit > 0).length

  if (revolvingCount === 0) {
    return buildIneligibleResult(creditScoreRange, 'No revolving credit accounts found.')
  }

  if (overallUtilization < 10) {
    return buildIneligibleResult(creditScoreRange, 'Utilization is already optimal.')
  }

  const backgroundOnly =
    overallUtilization > 30 && upcomingApplicationType === 'none'

  const { pointsLost, pointsRecoverable } = estimateScoreImpact(
    overallUtilization,
    TARGET_UTILIZATION
  )

  const balanceReductionNeeded = Math.max(
    0,
    sanitizeNumber(totalRevolvingBalance - totalRevolvingLimit * (TARGET_UTILIZATION / 100))
  )

  const projectedScoreRangeAfter =
    pointsRecoverable >= 40 && creditScoreRange !== '740+'
      ? getNextScoreRange(creditScoreRange)
      : creditScoreRange

  const { estimatedRateImprovement, estimatedDollarSavingsOnLoan } =
    simulateRateUnlock(creditScoreRange, projectedScoreRangeAfter, upcomingApplicationType)

  const timelineMonths = getTimelineMonths(upcomingApplicationTimeline)
  const availableCash = sanitizeNumber(monthlyFreeCashFlow) * timelineMonths
  const paydownPlan = prioritizePaydown(debts, balanceReductionNeeded, availableCash)
  const feasibleWithinTimeline = calculateFeasibility(
    balanceReductionNeeded,
    monthlyFreeCashFlow,
    upcomingApplicationTimeline
  )
  const recommendedActionsBy = getRecommendedActionsBy(upcomingApplicationTimeline)

  // Risk flags
  const riskFlags: string[] = ['Statement timing critical']

  if (upcomingApplicationType !== 'none') {
    riskFlags.push('Hard inquiry will temporarily drop score')
  }

  if (
    upcomingApplicationTimeline === '30_days' &&
    balanceReductionNeeded > sanitizeNumber(monthlyFreeCashFlow) * 1.5
  ) {
    riskFlags.push('Timeline too tight')
  }

  const hasPerCardConcentration =
    perCardUtilization.some((c) => c.utilization > 80) && overallUtilization < 50
  if (hasPerCardConcentration) {
    riskFlags.push('Per card concentration')
  }

  // Impact score
  let impactScore =
    (sanitizeNumber(pointsRecoverable) / 150) * 100 * 0.4 +
    (sanitizeNumber(estimatedDollarSavingsOnLoan) / 5000) * 100 * 0.4 +
    (feasibleWithinTimeline ? 20 : 0) * 0.2 -
    riskFlags.length * 5

  impactScore = Math.max(0, Math.min(100, sanitizeNumber(impactScore)))

  return {
    move: 'Utilization Optimization',
    eligible: true,
    backgroundOnly,
    currentOverallUtilization: overallUtilization,
    targetUtilization: TARGET_UTILIZATION,
    estimatedPointsLost: pointsLost,
    estimatedPointsRecoverable: pointsRecoverable,
    currentScoreRange: creditScoreRange,
    projectedScoreRangeAfter,
    balanceReductionNeeded: sanitizeNumber(balanceReductionNeeded),
    feasibleWithinTimeline,
    upcomingApplication: APPLICATION_NAMES[upcomingApplicationType] ?? upcomingApplicationType,
    estimatedRateImprovement,
    estimatedDollarSavingsOnLoan,
    paydownPlan,
    recommendedActionsBy,
    riskFlags,
    impactScore,
  }
}
