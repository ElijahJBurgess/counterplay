import { CreditScoreRange, Debt } from '@/types'

interface BalanceTransferInput {
  creditScoreRange: CreditScoreRange
  debts: Debt[]
  monthlyFreeCashFlow: number
}

export interface BalanceTransferResult {
  move: 'Balance Transfer'
  eligible: boolean
  borderline: boolean
  currentInterestCost: number
  transferFee: number
  netInterestSaved: number
  monthsSaved: number
  requiredMonthlyPayment: number
  clearedInPromoWindow: boolean
  conservativeScenario: {
    clearedInWindow: boolean
    requiredMonthlyToClean: number
  }
  riskFlags: string[]
  recommendedCards: string[]
  impactScore: number
  reason?: string
}

const CREDIT_LIMITS: Record<CreditScoreRange, number> = {
  '580-619': 0,
  '620-659': 2000,
  '660-699': 5000,
  '700-739': 8000,
  '740+': 15000,
}

const RECOMMENDED_CARDS: Record<CreditScoreRange, string[]> = {
  '740+': ['chase_freedom', 'citi_diamond', 'wells_fargo_reflect'],
  '700-739': ['chase_freedom', 'citi_diamond'],
  '660-699': ['citi_diamond', 'wells_fargo_reflect'],
  '620-659': ['wells_fargo_reflect'],
  '580-619': [],
}

function totalInterestAtCurrentAPR(
  balance: number,
  apr: number,
  monthlyPayment: number
): { totalPaid: number; totalInterest: number; monthsToPayoff: number } {
  const monthlyRate = apr / 100 / 12
  let remaining = balance
  let totalPaid = 0
  let totalInterest = 0
  let months = 0

  while (remaining > 0 && months < 600) {
    const interest = monthlyRate * remaining
    totalInterest += interest
    remaining = remaining + interest - monthlyPayment
    totalPaid += monthlyPayment
    months++
    if (remaining < 0) {
      totalPaid += remaining
      remaining = 0
    }
  }

  return { totalPaid, totalInterest, monthsToPayoff: months }
}

function calculateTransferCost(
  balance: number,
  transferFeePercent: number = 3
): { transferFee: number; totalAmountOwed: number } {
  const transferFee = balance * (transferFeePercent / 100)
  const totalAmountOwed = balance + transferFee
  return { transferFee, totalAmountOwed }
}

function simulatePromoPayoff(
  totalAmountOwed: number,
  promoMonths: number,
  monthlyPayment: number
): {
  clearedInWindow: boolean
  remainingBalance: number
  requiredMonthlyToClean: number
  promoMonths: number
} {
  const requiredMonthlyToClean = totalAmountOwed / promoMonths
  const remainingBalance = Math.max(0, totalAmountOwed - monthlyPayment * promoMonths)
  const clearedInWindow = remainingBalance === 0
  return { clearedInWindow, remainingBalance, requiredMonthlyToClean, promoMonths }
}

function calculateMonthsSaved(
  monthsAtCurrentAPR: number,
  promoMonths: number,
  clearedInWindow: boolean
): number {
  if (clearedInWindow) {
    return monthsAtCurrentAPR - promoMonths
  }
  return 0
}

export function simulateBalanceTransfer(input: BalanceTransferInput): BalanceTransferResult {
  const { creditScoreRange, debts, monthlyFreeCashFlow } = input
  const estimatedLimit = CREDIT_LIMITS[creditScoreRange]

  const creditCardDebts = debts.filter((d) => d.type === 'credit_card')

  if (creditCardDebts.length === 0) {
    return {
      move: 'Balance Transfer',
      eligible: false,
      borderline: false,
      currentInterestCost: 0,
      transferFee: 0,
      netInterestSaved: 0,
      monthsSaved: 0,
      requiredMonthlyPayment: 0,
      clearedInPromoWindow: false,
      conservativeScenario: { clearedInWindow: false, requiredMonthlyToClean: 0 },
      riskFlags: [],
      recommendedCards: [],
      impactScore: 0,
      reason: 'No credit card debt found',
    }
  }

  // Not eligible: score too low
  if (creditScoreRange === '580-619') {
    return {
      move: 'Balance Transfer',
      eligible: false,
      borderline: false,
      currentInterestCost: 0,
      transferFee: 0,
      netInterestSaved: 0,
      monthsSaved: 0,
      requiredMonthlyPayment: 0,
      clearedInPromoWindow: false,
      conservativeScenario: { clearedInWindow: false, requiredMonthlyToClean: 0 },
      riskFlags: [],
      recommendedCards: [],
      impactScore: 0,
      reason: 'Credit score too low for balance transfer eligibility',
    }
  }

  const qualifyingDebts = creditCardDebts.filter((d) => d.apr >= 18)

  // Not eligible: no high-APR debts
  if (qualifyingDebts.length === 0) {
    return {
      move: 'Balance Transfer',
      eligible: false,
      borderline: false,
      currentInterestCost: 0,
      transferFee: 0,
      netInterestSaved: 0,
      monthsSaved: 0,
      requiredMonthlyPayment: 0,
      clearedInPromoWindow: false,
      conservativeScenario: { clearedInWindow: false, requiredMonthlyToClean: 0 },
      riskFlags: [],
      recommendedCards: [],
      impactScore: 0,
      reason: 'No debts with APR >= 18% found',
    }
  }

  const totalQualifyingBalance = qualifyingDebts.reduce((sum, d) => sum + d.balance, 0)
  const totalCurrentMinPayment = qualifyingDebts.reduce((sum, d) => sum + d.minPayment, 0)

  // Pick the highest-APR debt as the primary candidate
  const primaryDebt = qualifyingDebts.reduce((a, b) => (a.apr > b.apr ? a : b))

  const { totalPaid: _, totalInterest, monthsToPayoff } =
    totalInterestAtCurrentAPR(primaryDebt.balance, primaryDebt.apr, primaryDebt.minPayment)

  const { transferFee, totalAmountOwed } = calculateTransferCost(primaryDebt.balance)

  // Standard promo: 18 months
  const standard = simulatePromoPayoff(totalAmountOwed, 18, monthlyFreeCashFlow)
  // Conservative promo: 15 months
  const conservative = simulatePromoPayoff(totalAmountOwed, 15, monthlyFreeCashFlow)

  const minimumRequiredPayment = standard.requiredMonthlyToClean

  // Eligibility gate: balance too large for estimated limit
  if (totalQualifyingBalance > estimatedLimit && creditScoreRange !== '620-659') {
    return {
      move: 'Balance Transfer',
      eligible: false,
      borderline: false,
      currentInterestCost: totalInterest,
      transferFee,
      netInterestSaved: 0,
      monthsSaved: 0,
      requiredMonthlyPayment: minimumRequiredPayment,
      clearedInPromoWindow: false,
      conservativeScenario: {
        clearedInWindow: conservative.clearedInWindow,
        requiredMonthlyToClean: conservative.requiredMonthlyToClean,
      },
      riskFlags: [],
      recommendedCards: [],
      impactScore: 0,
      reason: 'Total qualifying balance exceeds estimated credit limit',
    }
  }

  const isBorderline = creditScoreRange === '620-659'

  const monthsSaved = calculateMonthsSaved(monthsToPayoff, 18, standard.clearedInWindow)
  const netInterestSaved = totalInterest - transferFee

  // Risk flags
  const riskFlags: string[] = []

  if (totalAmountOwed > estimatedLimit * 1.3) {
    riskFlags.push('Utilization spike')
  }
  if (standard.requiredMonthlyToClean > monthlyFreeCashFlow * 0.8) {
    riskFlags.push('Tight payoff window')
  }
  if (totalQualifyingBalance > estimatedLimit) {
    riskFlags.push('Balance too large for estimated limit')
  }
  if (monthsToPayoff - 18 <= 2 && monthsToPayoff > 0) {
    riskFlags.push('Low margin of safety')
  }

  // Impact score
  const cashFlowRelief =
    totalCurrentMinPayment > 0
      ? (totalCurrentMinPayment - standard.requiredMonthlyToClean) / totalCurrentMinPayment
      : 0

  const totalCurrentDebt = qualifyingDebts.reduce((sum, d) => sum + d.balance, 0)

  let impactScore =
    (netInterestSaved / totalCurrentDebt) * 100 * 0.5 +
    (monthsToPayoff > 0 ? (monthsSaved / monthsToPayoff) * 100 : 0) * 0.3 +
    cashFlowRelief * 10 * 0.2 -
    riskFlags.length * 10

  impactScore = Math.max(0, Math.min(100, impactScore))

  if (netInterestSaved < 500) {
    return {
      move: 'Balance Transfer',
      eligible: false,
      borderline: isBorderline,
      currentInterestCost: totalInterest,
      transferFee,
      netInterestSaved,
      monthsSaved: 0,
      requiredMonthlyPayment: minimumRequiredPayment,
      clearedInPromoWindow: standard.clearedInWindow,
      conservativeScenario: {
        clearedInWindow: conservative.clearedInWindow,
        requiredMonthlyToClean: conservative.requiredMonthlyToClean,
      },
      riskFlags,
      recommendedCards: [],
      impactScore: 0,
      reason: 'Net interest saved is below $500 threshold',
    }
  }

  return {
    move: 'Balance Transfer',
    eligible: true,
    borderline: isBorderline,
    currentInterestCost: totalInterest,
    transferFee,
    netInterestSaved,
    monthsSaved,
    requiredMonthlyPayment: minimumRequiredPayment,
    clearedInPromoWindow: standard.clearedInWindow,
    conservativeScenario: {
      clearedInWindow: conservative.clearedInWindow,
      requiredMonthlyToClean: conservative.requiredMonthlyToClean,
    },
    riskFlags,
    recommendedCards: RECOMMENDED_CARDS[creditScoreRange],
    impactScore,
  }
}
