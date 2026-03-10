export type CreditScoreRange =
  | '580-619'
  | '620-659'
  | '660-699'
  | '700-739'
  | '740+'

export type DebtType = 'credit_card' | 'personal_loan' | 'auto'

export interface Debt {
  type: DebtType
  balance: number
  apr: number
  minPayment: number
}

export interface UserProfile {
  creditScoreRange: CreditScoreRange
  debts: Debt[]
  monthlyFreeCashFlow: number
}
