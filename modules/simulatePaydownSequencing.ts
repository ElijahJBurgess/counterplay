import { Debt } from '@/types'

interface PaydownSequencingInput {
  debts: Debt[]
  monthlyFreeCashFlow: number
}

export interface PayoffDebt {
  type: string
  balance: number
  apr: number
  minPayment: number
  payoffMonth: number
  interestPaid: number
  cashUnlocked: number
}

export interface PaydownSequencingResult {
  move: 'Aggressive Paydown Sequencing'
  eligible: boolean
  cashFlowNegative: boolean
  singleDebt: boolean
  recommendedMethod: 'avalanche' | 'snowball'
  currentMinimumOnlyProjection: {
    totalInterestPaid: number
    monthsToDebtFree: number
  }
  optimizedProjection: {
    totalInterestPaid: number
    monthsToDebtFree: number
    interestSaved: number
    monthsSaved: number
  }
  payoffSchedule: PayoffDebt[]
  cashFlowUnlockTimeline: {
    month: number
    additionalFreed: number
    cumulative: number
  }[]
  extraAllocationScenarios: {
    extra: number
    monthsSaved: number
    interestSaved: number
  }[]
  riskFlags: string[]
  impactScore: number
  reason?: string
}

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function rankDebtsByAPR(debts: Debt[]): Debt[] {
  return [...debts].sort((a, b) => b.apr - a.apr)
}

export function rankDebtsByBalance(debts: Debt[]): Debt[] {
  return [...debts].sort((a, b) => a.balance - b.balance)
}

export function simulateMinimumOnly(
  debts: Debt[]
): { totalInterestPaid: number; monthsToDebtFree: number } {
  let totalInterestPaid = 0
  let maxMonths = 0

  for (const debt of debts) {
    const balance = Math.max(0, sanitizeNumber(debt.balance))
    const minPayment = Math.max(0, sanitizeNumber(debt.minPayment))
    const monthlyRate = Math.max(0, sanitizeNumber(debt.apr)) / 100 / 12

    if (balance === 0 || minPayment === 0) continue

    let remaining = balance
    let interest = 0
    let months = 0

    while (remaining > 0 && months < 600) {
      const monthInterest = remaining * monthlyRate
      interest += monthInterest
      remaining += monthInterest - minPayment
      months++
      if (remaining < 0) remaining = 0
    }

    totalInterestPaid += interest
    if (months > maxMonths) maxMonths = months
  }

  return {
    totalInterestPaid: sanitizeNumber(totalInterestPaid),
    monthsToDebtFree: maxMonths,
  }
}

export function simulateAvalanche(
  debts: Debt[],
  extraMonthlyAllocation: number
): {
  payoffSchedule: PayoffDebt[]
  totalInterestPaid: number
  monthsToDebtFree: number
} {
  const sorted = rankDebtsByAPR(debts)
  const balances = sorted.map((d) => Math.max(0, sanitizeNumber(d.balance)))
  const interestAccrued = sorted.map(() => 0)
  const payoffMonths = sorted.map(() => 0)
  let currentExtra = Math.max(0, sanitizeNumber(extraMonthlyAllocation))
  let month = 0

  while (month < 600 && balances.some((b) => b > 0)) {
    month++
    let nextMonthBonus = 0

    // Apply interest and minimum payments to all debts
    for (let i = 0; i < sorted.length; i++) {
      if (balances[i] <= 0) continue

      const monthlyRate = Math.max(0, sanitizeNumber(sorted[i].apr)) / 100 / 12
      const interest = balances[i] * monthlyRate
      interestAccrued[i] += interest
      balances[i] += interest

      const payment = Math.min(
        Math.max(0, sanitizeNumber(sorted[i].minPayment)),
        balances[i]
      )
      balances[i] -= payment

      if (balances[i] < 0.01) {
        balances[i] = 0
        if (payoffMonths[i] === 0) {
          payoffMonths[i] = month
          nextMonthBonus += Math.max(0, sanitizeNumber(sorted[i].minPayment))
        }
      }
    }

    // Apply extra allocation to highest-APR debt with remaining balance
    for (let i = 0; i < sorted.length; i++) {
      if (balances[i] > 0 && currentExtra > 0) {
        const payment = Math.min(currentExtra, balances[i])
        balances[i] -= payment

        if (balances[i] < 0.01) {
          balances[i] = 0
          if (payoffMonths[i] === 0) {
            payoffMonths[i] = month
            nextMonthBonus += Math.max(0, sanitizeNumber(sorted[i].minPayment))
          }
        }
        break
      }
    }

    currentExtra += nextMonthBonus
  }

  // Cap any unpaid debts at 600
  for (let i = 0; i < sorted.length; i++) {
    if (payoffMonths[i] === 0) payoffMonths[i] = 600
  }

  const payoffSchedule: PayoffDebt[] = sorted.map((debt, i) => ({
    type: debt.type,
    balance: debt.balance,
    apr: debt.apr,
    minPayment: debt.minPayment,
    payoffMonth: payoffMonths[i],
    interestPaid: sanitizeNumber(interestAccrued[i]),
    cashUnlocked: Math.max(0, sanitizeNumber(debt.minPayment)),
  }))

  const totalInterestPaid = sanitizeNumber(
    interestAccrued.reduce((sum, v) => sum + v, 0)
  )
  const monthsToDebtFree = Math.max(...payoffMonths)

  return { payoffSchedule, totalInterestPaid, monthsToDebtFree }
}

export function simulateSnowball(
  debts: Debt[],
  extraMonthlyAllocation: number
): { totalInterestPaid: number; monthsToDebtFree: number } {
  const sorted = rankDebtsByBalance(debts)
  const balances = sorted.map((d) => Math.max(0, sanitizeNumber(d.balance)))
  const interestAccrued = sorted.map(() => 0)
  const payoffMonths = sorted.map(() => 0)
  let currentExtra = Math.max(0, sanitizeNumber(extraMonthlyAllocation))
  let month = 0

  while (month < 600 && balances.some((b) => b > 0)) {
    month++
    let nextMonthBonus = 0

    for (let i = 0; i < sorted.length; i++) {
      if (balances[i] <= 0) continue

      const monthlyRate = Math.max(0, sanitizeNumber(sorted[i].apr)) / 100 / 12
      const interest = balances[i] * monthlyRate
      interestAccrued[i] += interest
      balances[i] += interest

      const payment = Math.min(
        Math.max(0, sanitizeNumber(sorted[i].minPayment)),
        balances[i]
      )
      balances[i] -= payment

      if (balances[i] < 0.01) {
        balances[i] = 0
        if (payoffMonths[i] === 0) {
          payoffMonths[i] = month
          nextMonthBonus += Math.max(0, sanitizeNumber(sorted[i].minPayment))
        }
      }
    }

    for (let i = 0; i < sorted.length; i++) {
      if (balances[i] > 0 && currentExtra > 0) {
        const payment = Math.min(currentExtra, balances[i])
        balances[i] -= payment

        if (balances[i] < 0.01) {
          balances[i] = 0
          if (payoffMonths[i] === 0) {
            payoffMonths[i] = month
            nextMonthBonus += Math.max(0, sanitizeNumber(sorted[i].minPayment))
          }
        }
        break
      }
    }

    currentExtra += nextMonthBonus
  }

  for (let i = 0; i < sorted.length; i++) {
    if (payoffMonths[i] === 0) payoffMonths[i] = 600
  }

  return {
    totalInterestPaid: sanitizeNumber(
      interestAccrued.reduce((sum, v) => sum + v, 0)
    ),
    monthsToDebtFree: Math.max(...payoffMonths),
  }
}

export function calculateCashFlowUnlocks(
  payoffSchedule: PayoffDebt[]
): { month: number; additionalFreed: number; cumulative: number }[] {
  const sorted = [...payoffSchedule].sort((a, b) => a.payoffMonth - b.payoffMonth)
  let cumulative = 0
  return sorted.map((debt) => {
    cumulative += debt.cashUnlocked
    return {
      month: debt.payoffMonth,
      additionalFreed: debt.cashUnlocked,
      cumulative,
    }
  })
}

export function simulateExtraAllocation(
  debts: Debt[],
  baseExtra: number
): { extra: number; monthsSaved: number; interestSaved: number }[] {
  const safeBase = Math.max(0, sanitizeNumber(baseExtra))
  const increments = [0, 100, 200, 500]
  const runs = increments.map((inc) => simulateAvalanche(debts, safeBase + inc))
  const baseline = runs[0]

  return runs.map((run, i) => ({
    extra: safeBase + increments[i],
    monthsSaved: Math.max(0, baseline.monthsToDebtFree - run.monthsToDebtFree),
    interestSaved: Math.max(0, baseline.totalInterestPaid - run.totalInterestPaid),
  }))
}

function buildIneligibleResult(reason: string): PaydownSequencingResult {
  return {
    move: 'Aggressive Paydown Sequencing',
    eligible: false,
    cashFlowNegative: false,
    singleDebt: false,
    recommendedMethod: 'avalanche',
    currentMinimumOnlyProjection: { totalInterestPaid: 0, monthsToDebtFree: 0 },
    optimizedProjection: {
      totalInterestPaid: 0,
      monthsToDebtFree: 0,
      interestSaved: 0,
      monthsSaved: 0,
    },
    payoffSchedule: [],
    cashFlowUnlockTimeline: [],
    extraAllocationScenarios: [],
    riskFlags: [],
    impactScore: 0,
    reason,
  }
}

export function simulatePaydownSequencing(
  input: PaydownSequencingInput
): PaydownSequencingResult {
  const { debts, monthlyFreeCashFlow } = input
  const totalDebt = debts.reduce(
    (sum, d) => sum + Math.max(0, sanitizeNumber(d.balance)),
    0
  )
  const totalMinPayments = debts.reduce(
    (sum, d) => sum + Math.max(0, sanitizeNumber(d.minPayment)),
    0
  )
  const isSingleDebt = debts.length === 1
  const cashFlowNegative = monthlyFreeCashFlow < totalMinPayments

  if (totalDebt <= 1000) {
    return buildIneligibleResult(
      'Total debt too low for sequencing to make a meaningful difference.'
    )
  }

  if (isSingleDebt && cashFlowNegative) {
    return buildIneligibleResult("Cash flow doesn't cover minimum payments.")
  }

  const extraAllocation = Math.max(
    0,
    sanitizeNumber(monthlyFreeCashFlow) - totalMinPayments
  )

  const minimumOnly = simulateMinimumOnly(debts)
  const avalanche = simulateAvalanche(debts, extraAllocation)
  const snowball = simulateSnowball(debts, extraAllocation)

  const interestDifference = snowball.totalInterestPaid - avalanche.totalInterestPaid
  const recommendedMethod: 'avalanche' | 'snowball' =
    interestDifference >= 200 ? 'avalanche' : 'snowball'

  const optimizedTotals =
    recommendedMethod === 'avalanche' ? avalanche : snowball

  const optimizedProjection = {
    totalInterestPaid: optimizedTotals.totalInterestPaid,
    monthsToDebtFree: optimizedTotals.monthsToDebtFree,
    interestSaved: Math.max(
      0,
      minimumOnly.totalInterestPaid - optimizedTotals.totalInterestPaid
    ),
    monthsSaved: Math.max(
      0,
      minimumOnly.monthsToDebtFree - optimizedTotals.monthsToDebtFree
    ),
  }

  const cashFlowUnlockTimeline = calculateCashFlowUnlocks(avalanche.payoffSchedule)
  const extraAllocationScenarios = simulateExtraAllocation(debts, extraAllocation)

  // Risk flags
  const riskFlags: string[] = []

  if (cashFlowNegative) {
    riskFlags.push('Cash flow negative')
  }
  if (minimumOnly.monthsToDebtFree > 120) {
    riskFlags.push('Minimum only death spiral')
  }
  if (debts.length > 1) {
    const sortedByAPR = rankDebtsByAPR(debts)
    const highest = sortedByAPR[0].apr
    const secondHighest = sortedByAPR[1].apr
    if (highest - secondHighest >= 8) {
      riskFlags.push('High APR anchor')
    }
  }
  if (extraAllocationScenarios.length > 1 && extraAllocationScenarios[1].monthsSaved > 12) {
    riskFlags.push('$100/month leverage')
  }

  // Impact score
  let impactScore =
    (sanitizeNumber(optimizedProjection.interestSaved) / (totalDebt > 0 ? totalDebt : 1)) * 100 * 0.5 +
    (minimumOnly.monthsToDebtFree > 0
      ? (sanitizeNumber(optimizedProjection.monthsSaved) / minimumOnly.monthsToDebtFree) * 100
      : 0) * 0.3 +
    Math.min(extraAllocation / 100, 10) * 0.2 -
    riskFlags.length * 8

  impactScore = Math.max(0, Math.min(100, sanitizeNumber(impactScore)))

  return {
    move: 'Aggressive Paydown Sequencing',
    eligible: true,
    cashFlowNegative,
    singleDebt: isSingleDebt,
    recommendedMethod,
    currentMinimumOnlyProjection: minimumOnly,
    optimizedProjection,
    payoffSchedule: avalanche.payoffSchedule,
    cashFlowUnlockTimeline,
    extraAllocationScenarios,
    riskFlags,
    impactScore,
  }
}
