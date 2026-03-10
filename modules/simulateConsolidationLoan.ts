import { CreditScoreRange, Debt } from '@/types'

interface ConsolidationLoanInput {
  creditScoreRange: CreditScoreRange
  debts: Debt[]
}

export interface ConsolidationLoanResult {
  move: 'Debt Consolidation Loan'
  eligible: boolean
  borderline: boolean
  currentWeightedAPR: number
  estimatedNewAPR: number
  currentMonthlyPayment: number
  newMonthlyPayment: number
  monthlyPaymentDelta: number
  totalInterestSaved: number
  originationFee: number
  netSavings: number
  recommendedTerm: 36 | 48 | 60
  monthsSaved: number
  breakEvenMonth: number
  riskFlags: string[]
  recommendedLenders: string[]
  impactScore: number
  reason?: string
}

interface CurrentCostSummary {
  totalMonthlyPayment: number
  totalInterestOverLife: number
  averageMonthsToPayoff: number
}

interface LoanSimulation {
  termMonths: 36 | 48 | 60
  newMonthlyPayment: number
  totalInterestUnderLoan: number
  totalPaidUnderLoan: number
}

interface ConsolidationImpact {
  monthlyPaymentDelta: number
  totalInterestSaved: number
  netSavings: number
  monthsSaved: number
  breakEvenMonth: number
}

const ESTIMATED_NEW_APR: Record<CreditScoreRange, number> = {
  '580-619': 32,
  '620-659': 25,
  '660-699': 19,
  '700-739': 13.5,
  '740+': 9.5,
}

const RECOMMENDED_LENDERS = ['sofi', 'lightstream', 'marcus']
const LOAN_TERMS: Array<36 | 48 | 60> = [36, 48, 60]

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function amortizeDebt(
  balance: number,
  apr: number,
  monthlyPayment: number
): { totalInterest: number; monthsToPayoff: number } {
  const safeBalance = Math.max(0, sanitizeNumber(balance))
  const safeAPR = Math.max(0, sanitizeNumber(apr))
  const safePayment = Math.max(0, sanitizeNumber(monthlyPayment))

  if (safeBalance === 0 || safePayment === 0) {
    return { totalInterest: 0, monthsToPayoff: 0 }
  }

  const monthlyRate = safeAPR / 100 / 12
  let remaining = safeBalance
  let totalInterest = 0
  let months = 0

  while (remaining > 0 && months < 600) {
    const interest = remaining * monthlyRate
    totalInterest += interest

    const principalReduction = safePayment - interest
    if (principalReduction <= 0) {
      return { totalInterest, monthsToPayoff: 600 }
    }

    remaining -= principalReduction
    months++
  }

  return { totalInterest, monthsToPayoff: remaining > 0 ? 600 : months }
}

export function calculateWeightedAPR(debts: Debt[]): number {
  const totalBalance = debts.reduce((sum, debt) => sum + Math.max(0, sanitizeNumber(debt.balance)), 0)
  if (totalBalance <= 0) return 0

  const weightedAPR = debts.reduce(
    (sum, debt) =>
      sum +
      Math.max(0, sanitizeNumber(debt.apr)) * Math.max(0, sanitizeNumber(debt.balance)),
    0
  ) / totalBalance

  return sanitizeNumber(weightedAPR)
}

export function calculateCurrentTotalCost(debts: Debt[]): CurrentCostSummary {
  const totalBalance = debts.reduce((sum, debt) => sum + Math.max(0, sanitizeNumber(debt.balance)), 0)
  const totalMonthlyPayment = debts.reduce(
    (sum, debt) => sum + Math.max(0, sanitizeNumber(debt.minPayment)),
    0
  )

  if (totalBalance <= 0) {
    return {
      totalMonthlyPayment,
      totalInterestOverLife: 0,
      averageMonthsToPayoff: 0,
    }
  }

  let totalInterestOverLife = 0
  let weightedMonths = 0

  for (const debt of debts) {
    const balance = Math.max(0, sanitizeNumber(debt.balance))
    const { totalInterest, monthsToPayoff } = amortizeDebt(
      balance,
      debt.apr,
      debt.minPayment
    )

    totalInterestOverLife += totalInterest
    weightedMonths += monthsToPayoff * balance
  }

  return {
    totalMonthlyPayment,
    totalInterestOverLife: sanitizeNumber(totalInterestOverLife),
    averageMonthsToPayoff: sanitizeNumber(weightedMonths / totalBalance),
  }
}

export function simulateConsolidationLoanTerm(
  totalBalance: number,
  estimatedNewAPR: number,
  termMonths: 36 | 48 | 60
): LoanSimulation {
  const safeBalance = Math.max(0, sanitizeNumber(totalBalance))
  const safeAPR = Math.max(0, sanitizeNumber(estimatedNewAPR))

  if (safeBalance === 0) {
    return {
      termMonths,
      newMonthlyPayment: 0,
      totalInterestUnderLoan: 0,
      totalPaidUnderLoan: 0,
    }
  }

  const monthlyRate = safeAPR / 100 / 12
  const newMonthlyPayment =
    monthlyRate === 0
      ? safeBalance / termMonths
      : (safeBalance * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths))

  const totalPaidUnderLoan = newMonthlyPayment * termMonths
  const totalInterestUnderLoan = totalPaidUnderLoan - safeBalance

  return {
    termMonths,
    newMonthlyPayment: sanitizeNumber(newMonthlyPayment),
    totalInterestUnderLoan: Math.max(0, sanitizeNumber(totalInterestUnderLoan)),
    totalPaidUnderLoan: sanitizeNumber(totalPaidUnderLoan),
  }
}

export function calculateConsolidationImpact(
  currentCost: CurrentCostSummary,
  loanSimulation: LoanSimulation,
  originationFee: number
): ConsolidationImpact {
  const monthlyPaymentDelta =
    sanitizeNumber(currentCost.totalMonthlyPayment) - sanitizeNumber(loanSimulation.newMonthlyPayment)
  const totalInterestSaved =
    sanitizeNumber(currentCost.totalInterestOverLife) -
    sanitizeNumber(loanSimulation.totalInterestUnderLoan)
  const netSavings = totalInterestSaved - sanitizeNumber(originationFee)
  const monthsSaved = Math.max(
    0,
    sanitizeNumber(currentCost.averageMonthsToPayoff) - loanSimulation.termMonths
  )
  const breakEvenMonth = Math.ceil(
    sanitizeNumber(originationFee) / (monthlyPaymentDelta > 0 ? monthlyPaymentDelta : 1)
  )

  return {
    monthlyPaymentDelta: sanitizeNumber(monthlyPaymentDelta),
    totalInterestSaved: sanitizeNumber(totalInterestSaved),
    netSavings: sanitizeNumber(netSavings),
    monthsSaved: sanitizeNumber(monthsSaved),
    breakEvenMonth: Math.max(0, sanitizeNumber(breakEvenMonth)),
  }
}

function buildIneligibleResult(
  estimatedNewAPR: number,
  currentWeightedAPR: number,
  currentMonthlyPayment: number,
  originationFee: number,
  reason: string,
  recommendedTerm: 36 | 48 | 60 = 36
): ConsolidationLoanResult {
  return {
    move: 'Debt Consolidation Loan',
    eligible: false,
    borderline: false,
    currentWeightedAPR,
    estimatedNewAPR,
    currentMonthlyPayment,
    newMonthlyPayment: 0,
    monthlyPaymentDelta: 0,
    totalInterestSaved: 0,
    originationFee,
    netSavings: 0,
    recommendedTerm,
    monthsSaved: 0,
    breakEvenMonth: 0,
    riskFlags: [],
    recommendedLenders: [],
    impactScore: 0,
    reason,
  }
}

export function simulateConsolidationLoan(
  input: ConsolidationLoanInput
): ConsolidationLoanResult {
  const { creditScoreRange, debts } = input
  const estimatedNewAPR = ESTIMATED_NEW_APR[creditScoreRange]
  const totalDebt = debts.reduce((sum, debt) => sum + Math.max(0, sanitizeNumber(debt.balance)), 0)
  const currentWeightedAPR = calculateWeightedAPR(debts)
  const currentCost = calculateCurrentTotalCost(debts)
  const originationFee = totalDebt * 0.05

  if (creditScoreRange === '580-619') {
    return buildIneligibleResult(
      estimatedNewAPR,
      currentWeightedAPR,
      currentCost.totalMonthlyPayment,
      originationFee,
      'Credit score too low for personal loan rates that beat your current debt.'
    )
  }

  if (totalDebt < 2000) {
    return buildIneligibleResult(
      estimatedNewAPR,
      currentWeightedAPR,
      currentCost.totalMonthlyPayment,
      originationFee,
      'Total balance too low — consolidation fees outweigh the benefit.'
    )
  }

  if (totalDebt > 50000) {
    return buildIneligibleResult(
      estimatedNewAPR,
      currentWeightedAPR,
      currentCost.totalMonthlyPayment,
      originationFee,
      'Total balance exceeds personal loan limits for V1.'
    )
  }

  if (currentWeightedAPR < 15) {
    return buildIneligibleResult(
      estimatedNewAPR,
      currentWeightedAPR,
      currentCost.totalMonthlyPayment,
      originationFee,
      "Your current weighted rate is low enough that consolidation won't improve it."
    )
  }

  if (estimatedNewAPR >= currentWeightedAPR) {
    return buildIneligibleResult(
      estimatedNewAPR,
      currentWeightedAPR,
      currentCost.totalMonthlyPayment,
      originationFee,
      "Estimated new rate doesn't beat your current weighted rate."
    )
  }

  const termSimulations = LOAN_TERMS.map((term) =>
    simulateConsolidationLoanTerm(totalDebt, estimatedNewAPR, term)
  )

  const affordableTerms = termSimulations.filter(
    (simulation) => simulation.newMonthlyPayment <= currentCost.totalMonthlyPayment
  )

  const recommendedSimulation =
    affordableTerms.length > 0
      ? affordableTerms.reduce((best, current) =>
          current.totalInterestUnderLoan < best.totalInterestUnderLoan ? current : best
        )
      : termSimulations.reduce((best, current) =>
          current.newMonthlyPayment < best.newMonthlyPayment ? current : best
        )

  const impact = calculateConsolidationImpact(currentCost, recommendedSimulation, originationFee)
  const isBorderline = creditScoreRange === '620-659'

  const riskFlags: string[] = ['Rate not guaranteed']

  if (originationFee > impact.totalInterestSaved * 0.3) {
    riskFlags.push('Origination fee erodes savings')
  }
  if (recommendedSimulation.termMonths > currentCost.averageMonthsToPayoff) {
    riskFlags.push('Term extension risk')
  }
  if (recommendedSimulation.newMonthlyPayment > currentCost.totalMonthlyPayment) {
    riskFlags.push('Monthly payment increase')
  }

  let impactScore =
    (impact.netSavings / (totalDebt > 0 ? totalDebt : 1)) * 100 * 0.5 +
    (currentCost.averageMonthsToPayoff > 0
      ? (impact.monthsSaved / currentCost.averageMonthsToPayoff) * 100
      : 0) * 0.3 +
    (impact.monthlyPaymentDelta > 0 ? Math.min(impact.monthlyPaymentDelta / currentCost.totalMonthlyPayment, 1) * 10 : 0) * 0.2 -
    riskFlags.length * 8

  impactScore = Math.max(0, Math.min(100, sanitizeNumber(impactScore)))

  if (impact.netSavings <= 0) {
    return {
      move: 'Debt Consolidation Loan',
      eligible: false,
      borderline: false,
      currentWeightedAPR,
      estimatedNewAPR,
      currentMonthlyPayment: currentCost.totalMonthlyPayment,
      newMonthlyPayment: recommendedSimulation.newMonthlyPayment,
      monthlyPaymentDelta: impact.monthlyPaymentDelta,
      totalInterestSaved: impact.totalInterestSaved,
      originationFee,
      netSavings: impact.netSavings,
      recommendedTerm: recommendedSimulation.termMonths,
      monthsSaved: impact.monthsSaved,
      breakEvenMonth: impact.breakEvenMonth,
      riskFlags,
      recommendedLenders: [],
      impactScore: 0,
      reason: "After origination fees, this move doesn't save money.",
    }
  }

  return {
    move: 'Debt Consolidation Loan',
    eligible: true,
    borderline: isBorderline,
    currentWeightedAPR,
    estimatedNewAPR,
    currentMonthlyPayment: currentCost.totalMonthlyPayment,
    newMonthlyPayment: recommendedSimulation.newMonthlyPayment,
    monthlyPaymentDelta: impact.monthlyPaymentDelta,
    totalInterestSaved: impact.totalInterestSaved,
    originationFee,
    netSavings: impact.netSavings,
    recommendedTerm: recommendedSimulation.termMonths,
    monthsSaved: impact.monthsSaved,
    breakEvenMonth: impact.breakEvenMonth,
    riskFlags,
    recommendedLenders: RECOMMENDED_LENDERS,
    impactScore,
  }
}
