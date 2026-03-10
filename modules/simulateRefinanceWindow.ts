import { CreditScoreRange, Debt } from '@/types'

export interface RefinanceableDebt extends Debt {
  originalLoanAmount: number
  originalTermMonths: number
  monthsAlreadyPaid: number
  isRefinanceable: boolean
}

export interface RefinanceWindowResult {
  move: 'Refinance Timing Window'
  eligible: boolean
  borderline: boolean
  windowStatus: 'act_now' | 'timing_not_right' | 'borderline'
  targetDebt: string
  currentAPR: number
  estimatedNewAPR: number
  currentRemainingInterest: number
  refinancedTotalInterest: number
  totalInterestSaved: number
  closingCostEstimate: number
  netSavings: number
  monthlyPaymentDelta: number
  breakEvenMonth: number
  recommendedTerm: 'remaining_term' | 'extended_term' | 'shortened_term'
  waitOrActNow: 'act_now' | 'wait' | 'borderline'
  scoreBandOpportunity: boolean
  prepaymentPenaltyLikely: boolean
  riskFlags: string[]
  recommendedLenders: string[]
  impactScore: number
  reason?: string
}

export interface RefinanceInput {
  creditScoreRange: CreditScoreRange
  debts: RefinanceableDebt[]
  monthlyFreeCashFlow: number
  hasRecentHardInquiry: boolean
  recentLatePayments: boolean
}

const ESTIMATED_APR: Record<CreditScoreRange, number> = {
  '580-619': 32,
  '620-659': 25,
  '660-699': 19,
  '700-739': 13.5,
  '740+': 9.5,
}

const ESTIMATED_AUTO_APR: Record<CreditScoreRange, number> = {
  '580-619': 21,
  '620-659': 17,
  '660-699': 13,
  '700-739': 9,
  '740+': 6,
}

const SCORE_BAND_ORDER: CreditScoreRange[] = [
  '580-619',
  '620-659',
  '660-699',
  '700-739',
  '740+',
]

const LENDERS_BY_DEBT_TYPE: Record<string, string[]> = {
  auto: ['lightstream', 'penfed', 'consumers_credit_union', 'rategenius'],
  personal_loan: ['sofi', 'marcus', 'upgrade'],
  mortgage: ['sofi'],
}

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function getEstimatedAPR(scoreRange: CreditScoreRange, debtType: string): number {
  if (debtType === 'auto') return ESTIMATED_AUTO_APR[scoreRange]
  return ESTIMATED_APR[scoreRange]
}

function getNextScoreBand(scoreRange: CreditScoreRange): CreditScoreRange | null {
  const index = SCORE_BAND_ORDER.indexOf(scoreRange)
  if (index === -1 || index === SCORE_BAND_ORDER.length - 1) return null
  return SCORE_BAND_ORDER[index + 1]
}

export function calculateRemainingLoanCost(
  balance: number,
  apr: number,
  remainingMonths: number
): {
  totalRemainingInterest: number
  totalRemainingPayments: number
  monthlyPayment: number
  remainingMonths: number
} {
  const safeBalance = Math.max(0, sanitizeNumber(balance))
  const safeAPR = Math.max(0, sanitizeNumber(apr))
  const safeMonths = Math.max(1, Math.round(sanitizeNumber(remainingMonths)))

  const monthlyRate = safeAPR / 100 / 12
  const monthlyPayment =
    monthlyRate === 0
      ? safeBalance / safeMonths
      : (safeBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -safeMonths))

  const totalRemainingPayments = monthlyPayment * safeMonths
  const totalRemainingInterest = Math.max(0, totalRemainingPayments - safeBalance)

  return {
    totalRemainingInterest: sanitizeNumber(totalRemainingInterest),
    totalRemainingPayments: sanitizeNumber(totalRemainingPayments),
    monthlyPayment: sanitizeNumber(monthlyPayment),
    remainingMonths: safeMonths,
  }
}

export function simulateRefinance(
  balance: number,
  estimatedNewAPR: number,
  newTermMonths: number,
  closingCostEstimate: number,
  currentMonthlyPayment: number,
  currentRemainingInterest: number
): {
  newMonthlyPayment: number
  totalInterestUnderRefinance: number
  totalCostUnderRefinance: number
  monthlyPaymentDelta: number
  totalInterestSaved: number
  netSavingsAfterClosingCosts: number
} {
  const safeBalance = Math.max(0, sanitizeNumber(balance))
  const safeAPR = Math.max(0, sanitizeNumber(estimatedNewAPR))
  const safeMonths = Math.max(1, Math.round(sanitizeNumber(newTermMonths)))
  const safeClosingCost = Math.max(0, sanitizeNumber(closingCostEstimate))

  const monthlyRate = safeAPR / 100 / 12
  const newMonthlyPayment =
    monthlyRate === 0
      ? safeBalance / safeMonths
      : (safeBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -safeMonths))

  const totalCostUnderRefinance = newMonthlyPayment * safeMonths
  const totalInterestUnderRefinance = Math.max(0, totalCostUnderRefinance - safeBalance)
  const monthlyPaymentDelta = sanitizeNumber(currentMonthlyPayment) - newMonthlyPayment
  const totalInterestSaved = sanitizeNumber(currentRemainingInterest) - totalInterestUnderRefinance
  const netSavingsAfterClosingCosts = totalInterestSaved - safeClosingCost

  return {
    newMonthlyPayment: sanitizeNumber(newMonthlyPayment),
    totalInterestUnderRefinance: sanitizeNumber(totalInterestUnderRefinance),
    totalCostUnderRefinance: sanitizeNumber(totalCostUnderRefinance),
    monthlyPaymentDelta: sanitizeNumber(monthlyPaymentDelta),
    totalInterestSaved: sanitizeNumber(totalInterestSaved),
    netSavingsAfterClosingCosts: sanitizeNumber(netSavingsAfterClosingCosts),
  }
}

export function calculateBreakEven(
  closingCosts: number,
  monthlyPaymentDelta: number
): { breakEvenMonth: number; worthItIf: string } {
  const safeClosingCosts = Math.max(0, sanitizeNumber(closingCosts))
  const safeDelta = sanitizeNumber(monthlyPaymentDelta)
  const breakEvenMonth =
    safeClosingCosts <= 0 ? 1 : Math.ceil(safeClosingCosts / Math.max(safeDelta, 1))

  return {
    breakEvenMonth,
    worthItIf: `Keep this loan at least ${breakEvenMonth} more months after refinancing`,
  }
}

export function calculateRateUnlockPath(
  currentScoreRange: CreditScoreRange,
  currentAPR: number,
  debtType: string,
  balance: number,
  remainingMonths: number
): {
  currentEstimatedRate: number
  nextScoreBandRate: number
  pointsNeededToNextBand: number
  estimatedAdditionalSavings: number
  waitOrActNow: 'act_now' | 'wait'
} {
  const currentEstimatedRate = getEstimatedAPR(currentScoreRange, debtType)
  const nextBand = getNextScoreBand(currentScoreRange)
  const nextScoreBandRate = nextBand
    ? getEstimatedAPR(nextBand, debtType)
    : currentEstimatedRate

  const currentBandCost = calculateRemainingLoanCost(balance, currentEstimatedRate, remainingMonths)
  const nextBandCost = calculateRemainingLoanCost(balance, nextScoreBandRate, remainingMonths)
  const estimatedAdditionalSavings = Math.max(
    0,
    sanitizeNumber(currentBandCost.totalRemainingInterest - nextBandCost.totalRemainingInterest)
  )

  const waitOrActNow: 'act_now' | 'wait' =
    estimatedAdditionalSavings > 500 ? 'wait' : 'act_now'

  return {
    currentEstimatedRate,
    nextScoreBandRate,
    pointsNeededToNextBand: 40,
    estimatedAdditionalSavings,
    waitOrActNow,
  }
}

export function checkPrepaymentRisk(
  debtType: string,
  monthsAlreadyPaid: number
): { prepaymentPenaltyLikely: boolean; warningMessage: string } {
  if (debtType === 'auto') {
    const prepaymentPenaltyLikely = monthsAlreadyPaid < 12
    return {
      prepaymentPenaltyLikely,
      warningMessage: prepaymentPenaltyLikely
        ? 'Auto loans paid for less than 12 months may carry prepayment penalties.'
        : '',
    }
  }

  if (debtType === 'personal_loan') {
    return {
      prepaymentPenaltyLikely: true,
      warningMessage:
        'Personal loans commonly carry prepayment penalties. Check your loan agreement.',
    }
  }

  if (debtType === 'mortgage') {
    const prepaymentPenaltyLikely = monthsAlreadyPaid < 60
    return {
      prepaymentPenaltyLikely,
      warningMessage: prepaymentPenaltyLikely
        ? 'Mortgages paid for less than 5 years may carry prepayment penalties.'
        : '',
    }
  }

  return { prepaymentPenaltyLikely: false, warningMessage: '' }
}

function buildIneligibleResult(
  overrides: Partial<RefinanceWindowResult> & { reason: string }
): RefinanceWindowResult {
  return {
    move: 'Refinance Timing Window',
    eligible: false,
    borderline: false,
    windowStatus: 'timing_not_right',
    targetDebt: '',
    currentAPR: 0,
    estimatedNewAPR: 0,
    currentRemainingInterest: 0,
    refinancedTotalInterest: 0,
    totalInterestSaved: 0,
    closingCostEstimate: 0,
    netSavings: 0,
    monthlyPaymentDelta: 0,
    breakEvenMonth: 0,
    recommendedTerm: 'remaining_term',
    waitOrActNow: 'act_now',
    scoreBandOpportunity: false,
    prepaymentPenaltyLikely: false,
    riskFlags: [],
    recommendedLenders: [],
    impactScore: 0,
    ...overrides,
  }
}

export function simulateRefinanceWindow(input: RefinanceInput): RefinanceWindowResult {
  const { creditScoreRange, debts, hasRecentHardInquiry, recentLatePayments } = input

  if (creditScoreRange === '580-619') {
    return buildIneligibleResult({
      eligible: false,
      reason: 'Credit score too low to qualify for rates that beat your current loan.',
    })
  }

  if (recentLatePayments) {
    return buildIneligibleResult({
      eligible: false,
      reason: 'Recent late payments will significantly hurt your refinance rate. Wait 12 months from the last late payment.',
    })
  }

  const refinanceableDebts = debts.filter((d) => d.isRefinanceable)
  if (refinanceableDebts.length === 0) {
    return buildIneligibleResult({
      eligible: false,
      reason: 'No refinanceable debts found.',
    })
  }

  const targetDebt = refinanceableDebts.reduce((a, b) => (a.apr > b.apr ? a : b))

  if (targetDebt.monthsAlreadyPaid < 3) {
    return buildIneligibleResult({
      eligible: false,
      reason: 'Loan too new — lenders require at least 3 months of payment history.',
    })
  }

  const remainingMonths = Math.max(1, targetDebt.originalTermMonths - targetDebt.monthsAlreadyPaid)
  const estimatedNewAPR = getEstimatedAPR(creditScoreRange, targetDebt.type)
  const currentCost = calculateRemainingLoanCost(targetDebt.balance, targetDebt.apr, remainingMonths)

  if (targetDebt.monthsAlreadyPaid < 6) {
    return buildIneligibleResult({
      eligible: true,
      windowStatus: 'timing_not_right',
      targetDebt: targetDebt.type,
      currentAPR: targetDebt.apr,
      estimatedNewAPR,
      currentRemainingInterest: currentCost.totalRemainingInterest,
      reason: 'Lenders typically require 6 months of payment history before refinancing.',
    })
  }

  if (hasRecentHardInquiry) {
    return buildIneligibleResult({
      eligible: true,
      windowStatus: 'timing_not_right',
      targetDebt: targetDebt.type,
      currentAPR: targetDebt.apr,
      estimatedNewAPR,
      currentRemainingInterest: currentCost.totalRemainingInterest,
      reason: 'A recent hard inquiry may affect your refinance rate. Wait 6 months for it to fade.',
    })
  }

  if (targetDebt.apr < estimatedNewAPR + 1.5) {
    return buildIneligibleResult({
      eligible: true,
      windowStatus: 'timing_not_right',
      targetDebt: targetDebt.type,
      currentAPR: targetDebt.apr,
      estimatedNewAPR,
      currentRemainingInterest: currentCost.totalRemainingInterest,
      reason: 'Rate improvement is too small to justify refinancing costs and credit impact.',
    })
  }

  const isBorderline = creditScoreRange === '620-659' && !recentLatePayments

  const debtTypeStr: string = targetDebt.type
  const closingCostEstimate =
    debtTypeStr === 'personal_loan' || debtTypeStr === 'mortgage'
      ? targetDebt.balance * 0.03
      : 0

  const termScenarios: Array<{
    label: 'remaining_term' | 'extended_term' | 'shortened_term'
    months: number
  }> = [
    { label: 'remaining_term', months: remainingMonths },
    { label: 'extended_term', months: remainingMonths + 12 },
    { label: 'shortened_term', months: Math.max(12, remainingMonths - 12) },
  ]

  const scenarios = termScenarios.map(({ label, months }) => ({
    label,
    result: simulateRefinance(
      targetDebt.balance,
      estimatedNewAPR,
      months,
      closingCostEstimate,
      currentCost.monthlyPayment,
      currentCost.totalRemainingInterest
    ),
  }))

  const qualifyingScenarios = scenarios.filter(
    (s) => s.result.newMonthlyPayment <= currentCost.monthlyPayment
  )

  const bestScenario =
    qualifyingScenarios.length > 0
      ? qualifyingScenarios.reduce((best, current) =>
          current.result.netSavingsAfterClosingCosts > best.result.netSavingsAfterClosingCosts
            ? current
            : best
        )
      : scenarios.find((s) => s.label === 'remaining_term')!

  const bestResult = bestScenario.result

  const { breakEvenMonth } = calculateBreakEven(
    closingCostEstimate,
    bestResult.monthlyPaymentDelta
  )

  const rateUnlock = calculateRateUnlockPath(
    creditScoreRange,
    targetDebt.apr,
    targetDebt.type,
    targetDebt.balance,
    remainingMonths
  )

  const scoreBandOpportunity = rateUnlock.waitOrActNow === 'wait'

  const { prepaymentPenaltyLikely } = checkPrepaymentRisk(
    targetDebt.type,
    targetDebt.monthsAlreadyPaid
  )

  const riskFlags: string[] = []

  if (breakEvenMonth > remainingMonths) {
    riskFlags.push('Break-even beyond loan end')
  }
  if (targetDebt.type === 'auto' || targetDebt.type === 'personal_loan') {
    riskFlags.push('Prepayment penalty possible')
  }
  if (targetDebt.apr - estimatedNewAPR < 1.5) {
    riskFlags.push('Rate improvement marginal')
  }
  if (scoreBandOpportunity) {
    riskFlags.push('Score band opportunity')
  }
  if (targetDebt.monthsAlreadyPaid > targetDebt.originalTermMonths * 0.6) {
    riskFlags.push('Loan too seasoned')
  }

  const netSavings = bestResult.netSavingsAfterClosingCosts
  const totalInterestSaved = bestResult.totalInterestSaved
  const currentRemainingInterest = currentCost.totalRemainingInterest
  const monthlyPaymentDelta = bestResult.monthlyPaymentDelta
  const balance = targetDebt.balance

  let impactScore =
    (balance > 0 ? (netSavings / balance) * 100 : 0) * 0.5 +
    (currentRemainingInterest > 0
      ? (totalInterestSaved / currentRemainingInterest) * 100
      : 0) *
      0.3 +
    (monthlyPaymentDelta > 0 ? Math.min(monthlyPaymentDelta / 50, 10) : 0) * 0.2 -
    riskFlags.length * 8

  impactScore = Math.max(0, Math.min(100, sanitizeNumber(impactScore)))

  const recommendedLenders = LENDERS_BY_DEBT_TYPE[targetDebt.type] ?? []

  return {
    move: 'Refinance Timing Window',
    eligible: true,
    borderline: isBorderline,
    windowStatus: isBorderline ? 'borderline' : 'act_now',
    targetDebt: targetDebt.type,
    currentAPR: targetDebt.apr,
    estimatedNewAPR,
    currentRemainingInterest,
    refinancedTotalInterest: bestResult.totalInterestUnderRefinance,
    totalInterestSaved,
    closingCostEstimate,
    netSavings,
    monthlyPaymentDelta,
    breakEvenMonth,
    recommendedTerm: bestScenario.label,
    waitOrActNow: rateUnlock.waitOrActNow,
    scoreBandOpportunity,
    prepaymentPenaltyLikely,
    riskFlags,
    recommendedLenders,
    impactScore,
  }
}
