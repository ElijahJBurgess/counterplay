'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CreditScoreRange } from '@/types'
import {
  COLOR_BACKGROUND,
  COLOR_SURFACE_LIGHT,
  COLOR_BORDER,
  COLOR_ACCENT,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  COLOR_TEXT_TERTIARY,
  COLOR_WHITE_CARD_BG,
  COLOR_ERROR,
  RADIUS_SM,
  RADIUS_MD,
  RADIUS_FULL,
  FONT_SIZE_XS,
  FONT_SIZE_SM,
  FONT_SIZE_BASE,
  FONT_SIZE_LG,
  SPACING_3,
  SPACING_4,
  SPACING_5,
  SPACING_6,
} from '@/styles/tokens'

interface DebtRow {
  id: string
  type: 'credit_card' | 'personal_loan' | 'auto'
  balance: string
  apr: string
  minPayment: string
  creditLimit: string
  originalLoanAmount: string
  originalTermMonths: string
  monthsAlreadyPaid: string
}

type ActiveSheet =
  | { kind: 'debtType'; id: string }
  | { kind: 'appType' }
  | { kind: 'timeline' }
  | null

const DEBT_TYPE_OPTIONS: { value: DebtRow['type']; label: string }[] = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'auto', label: 'Auto Loan' },
  { value: 'personal_loan', label: 'Personal Loan' },
]

const APP_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'No upcoming application' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'auto_loan', label: 'Auto loan' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'balance_transfer_card', label: 'Balance transfer card' },
]

const TIMELINE_OPTIONS: { value: string; label: string }[] = [
  { value: '30_days', label: 'Within 30 days' },
  { value: '60_days', label: 'Within 60 days' },
  { value: '90_days', label: 'Within 90 days' },
  { value: '6_months', label: 'Within 6 months' },
  { value: 'not_sure', label: 'Not sure' },
]

function debtTypeLabel(type: DebtRow['type']) {
  return DEBT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}

function appTypeLabel(value: string) {
  return APP_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function timelineLabel(value: string) {
  return TIMELINE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function addCommas(raw: string): string {
  if (!raw) return ''
  const [intPart, decPart] = raw.split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decPart !== undefined ? formatted + '.' + decPart : formatted
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder = '0.00',
  prefix,
  suffix,
  currency = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  prefix?: string
  suffix?: string
  currency?: boolean
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (currency) {
      const raw = e.target.value.replace(/,/g, '')
      if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) {
        onChange(raw)
      }
    } else {
      onChange(e.target.value)
    }
  }

  const displayValue = currency ? addCommas(value) : value

  return (
    <div>
      <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_SM, marginBottom: '6px' }}>{label}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: COLOR_SURFACE_LIGHT,
          borderRadius: RADIUS_SM,
          padding: `0 ${SPACING_3}`,
          gap: '4px',
        }}
      >
        {prefix && (
          <span style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_BASE, userSelect: 'none', flexShrink: 0 }}>
            {prefix}
          </span>
        )}
        <input
          type={currency ? 'text' : 'number'}
          inputMode={currency ? 'decimal' : undefined}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          style={{
            background: 'none',
            border: 'none',
            outline: 'none',
            color: COLOR_TEXT_PRIMARY,
            fontSize: FONT_SIZE_BASE,
            padding: `${SPACING_3} 0`,
            width: '100%',
            minWidth: 0,
          }}
        />
        {suffix && (
          <span style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_BASE, userSelect: 'none', flexShrink: 0 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}

const fieldStyle = {
  background: '#F0F0F0',
  borderRadius: '8px',
  padding: '12px',
  color: '#0A0A0A',
  fontSize: '15px',
  border: 'none',
  width: '100%',
  outline: 'none',
}

export default function InputPage() {
  const [creditScoreRange, setCreditScoreRange] = useState<CreditScoreRange | null>(null)
  const [debts, setDebts] = useState<DebtRow[]>([
    { id: crypto.randomUUID(), type: 'credit_card', balance: '', apr: '', minPayment: '', creditLimit: '', originalLoanAmount: '', originalTermMonths: '', monthsAlreadyPaid: '' },
  ])
  const [monthlyFreeCashFlow, setMonthlyFreeCashFlow] = useState<string>('')
  const [upcomingApplicationType, setUpcomingApplicationType] = useState<'mortgage' | 'auto_loan' | 'personal_loan' | 'balance_transfer_card' | 'none'>('none')
  const [upcomingApplicationTimeline, setUpcomingApplicationTimeline] = useState<'30_days' | '60_days' | '90_days' | '6_months' | 'not_sure'>('not_sure')
  const [hasRecentHardInquiry, setHasRecentHardInquiry] = useState<boolean>(false)
  const [recentLatePayments, setRecentLatePayments] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_score_range')
        .eq('id', session.user.id)
        .single()
      if (profile?.credit_score_range) {
        setCreditScoreRange(profile.credit_score_range as CreditScoreRange)
      }
    }
    loadProfile()
  }, [router])

  function updateDebt(id: string, field: keyof Omit<DebtRow, 'id'>, value: string) {
    setDebts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    )
  }

  function addDebt() {
    if (debts.length >= 5) return
    setDebts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'credit_card', balance: '', apr: '', minPayment: '', creditLimit: '', originalLoanAmount: '', originalTermMonths: '', monthsAlreadyPaid: '' },
    ])
  }

  function removeDebt(id: string) {
    setDebts((prev) => prev.filter((d) => d.id !== id))
  }

  function isSubmitDisabled() {
    if (!monthlyFreeCashFlow) return true
    return debts.some((d) => !d.balance || !d.apr || !d.minPayment)
  }

  function handleSubmit() {
    setError(null)

    for (const d of debts) {
      const balance = parseFloat(d.balance)
      const apr = parseFloat(d.apr)
      const minPayment = parseFloat(d.minPayment)

      if (isNaN(balance) || balance <= 0) {
        setError('All balances must be greater than 0.')
        return
      }
      if (isNaN(apr) || apr < 0.1 || apr > 100) {
        setError('APR must be between 0.1 and 100.')
        return
      }
      if (isNaN(minPayment) || minPayment <= 0) {
        setError('All minimum payments must be greater than 0.')
        return
      }

      if (d.type === 'credit_card') {
        const creditLimit = parseFloat(d.creditLimit)
        if (isNaN(creditLimit) || creditLimit <= 0) {
          setError('Credit limit must be greater than 0.')
          return
        }
      }

      if (d.type === 'auto' || d.type === 'personal_loan') {
        const originalLoanAmount = parseFloat(d.originalLoanAmount)
        if (isNaN(originalLoanAmount) || originalLoanAmount <= 0) {
          setError('Original loan amount must be greater than 0.')
          return
        }
        const originalTermMonths = parseInt(d.originalTermMonths)
        if (isNaN(originalTermMonths) || originalTermMonths <= 0) {
          setError('Original term must be greater than 0 months.')
          return
        }
        const monthsAlreadyPaid = parseInt(d.monthsAlreadyPaid)
        if (isNaN(monthsAlreadyPaid) || monthsAlreadyPaid < 0) {
          setError('Months already paid cannot be negative.')
          return
        }
        if (monthsAlreadyPaid > originalTermMonths) {
          setError('Months already paid cannot exceed original term.')
          return
        }
      }
    }

    const cashFlow = parseFloat(monthlyFreeCashFlow)
    if (isNaN(cashFlow) || cashFlow <= 0) {
      setError('Monthly free cash flow must be greater than 0.')
      return
    }

    if (!creditScoreRange) {
      setError('Could not load your credit score range. Please try again.')
      return
    }

    setIsLoading(true)

    const moduleInput = {
      creditScoreRange,
      monthlyFreeCashFlow: cashFlow,

      debts: debts.map((d) => ({
        type: d.type,
        balance: parseFloat(d.balance),
        apr: parseFloat(d.apr),
        minPayment: parseFloat(d.minPayment),
      })),

      revolvingDebts: debts
        .filter((d) => d.type === 'credit_card')
        .map((d) => ({
          type: d.type,
          balance: parseFloat(d.balance),
          apr: parseFloat(d.apr),
          minPayment: parseFloat(d.minPayment),
          creditLimit: parseFloat(d.creditLimit),
          isRevolving: true,
        })),

      refinanceableDebts: debts
        .filter((d) => d.type === 'auto' || d.type === 'personal_loan')
        .map((d) => ({
          type: d.type,
          balance: parseFloat(d.balance),
          apr: parseFloat(d.apr),
          minPayment: parseFloat(d.minPayment),
          originalLoanAmount: parseFloat(d.originalLoanAmount),
          originalTermMonths: parseInt(d.originalTermMonths),
          monthsAlreadyPaid: parseInt(d.monthsAlreadyPaid),
          isRefinanceable: true,
        })),

      upcomingApplicationType,
      upcomingApplicationTimeline,

      hasRecentHardInquiry,
      recentLatePayments,
    }

    sessionStorage.setItem('moduleInput', JSON.stringify(moduleInput))
    router.push('/dashboard/loading')
  }

  const hasCreditCard = debts.some((d) => d.type === 'credit_card')
  const hasLoan = debts.some((d) => d.type === 'auto' || d.type === 'personal_loan')
  const disabled = isSubmitDisabled() || isLoading

  // Determine sheet options and current value for the active sheet
  let sheetOptions: { value: string; label: string }[] = []
  let sheetSelected = ''

  if (activeSheet?.kind === 'debtType') {
    sheetOptions = DEBT_TYPE_OPTIONS
    sheetSelected = debts.find((d) => d.id === activeSheet.id)?.type ?? ''
  } else if (activeSheet?.kind === 'appType') {
    sheetOptions = APP_TYPE_OPTIONS
    sheetSelected = upcomingApplicationType
  } else if (activeSheet?.kind === 'timeline') {
    sheetOptions = TIMELINE_OPTIONS
    sheetSelected = upcomingApplicationTimeline
  }

  function handleSheetSelect(value: string) {
    if (activeSheet?.kind === 'debtType') {
      updateDebt(activeSheet.id, 'type', value as DebtRow['type'])
    } else if (activeSheet?.kind === 'appType') {
      setUpcomingApplicationType(value as typeof upcomingApplicationType)
    } else if (activeSheet?.kind === 'timeline') {
      setUpcomingApplicationTimeline(value as typeof upcomingApplicationTimeline)
    }
    setActiveSheet(null)
  }

  return (
    <>
      <div
        style={{
          backgroundColor: COLOR_BACKGROUND,
          minHeight: '100dvh',
          paddingBottom: '100px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${SPACING_5} ${SPACING_6}`,
            position: 'relative',
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              position: 'absolute',
              left: SPACING_6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Go back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke={COLOR_TEXT_PRIMARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, fontWeight: 700 }}>
            Your debts
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: `0 ${SPACING_6}` }}>
          <p style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_SM, margin: `0 0 ${SPACING_6}`, lineHeight: 1.5 }}>
            We&apos;ll find the moves that save you the most money.
          </p>

          {/* Debt cards */}
          {debts.map((debt) => (
            <div
              key={debt.id}
              style={{
                backgroundColor: COLOR_WHITE_CARD_BG,
                border: `1px solid ${COLOR_BORDER}`,
                borderRadius: RADIUS_MD,
                padding: SPACING_4,
                marginBottom: SPACING_3,
              }}
            >
              {/* Debt type row */}
              <button
                onClick={() => setActiveSheet({ kind: 'debtType', id: debt.id })}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${COLOR_BORDER}`,
                  paddingBottom: SPACING_3,
                  marginBottom: SPACING_3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_XS, marginBottom: '4px' }}>Debt type</div>
                  <div style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, fontWeight: 500 }}>
                    {debtTypeLabel(debt.type)}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke={COLOR_TEXT_TERTIARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {/* Row 1: Balance + APR */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING_3, marginBottom: SPACING_3 }}>
                <FieldInput
                  label="Balance"
                  value={debt.balance}
                  onChange={(v) => updateDebt(debt.id, 'balance', v)}
                  prefix="$"
                  currency
                />
                <FieldInput
                  label="APR"
                  value={debt.apr}
                  onChange={(v) => updateDebt(debt.id, 'apr', v)}
                  suffix="%"
                />
              </div>

              {/* Row 2: Min Payment + type-specific */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING_3, marginBottom: SPACING_3 }}>
                <FieldInput
                  label="Min Payment"
                  value={debt.minPayment}
                  onChange={(v) => updateDebt(debt.id, 'minPayment', v)}
                  prefix="$"
                  currency
                />
                {debt.type === 'credit_card' && (
                  <FieldInput
                    label="Credit Limit"
                    value={debt.creditLimit}
                    onChange={(v) => updateDebt(debt.id, 'creditLimit', v)}
                    prefix="$"
                    currency
                  />
                )}
                {(debt.type === 'auto' || debt.type === 'personal_loan') && (
                  <div /> /* spacer — loan extra fields go below */
                )}
              </div>

              {/* Loan-only extra rows */}
              {(debt.type === 'auto' || debt.type === 'personal_loan') && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING_3, marginBottom: SPACING_3 }}>
                    <FieldInput
                      label="Original Amount"
                      value={debt.originalLoanAmount}
                      onChange={(v) => updateDebt(debt.id, 'originalLoanAmount', v)}
                      prefix="$"
                      currency
                    />
                    <FieldInput
                      label="Term"
                      value={debt.originalTermMonths}
                      onChange={(v) => updateDebt(debt.id, 'originalTermMonths', v)}
                      placeholder="0"
                      suffix="mo."
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACING_3, marginBottom: SPACING_3 }}>
                    <FieldInput
                      label="Months Paid"
                      value={debt.monthsAlreadyPaid}
                      onChange={(v) => updateDebt(debt.id, 'monthsAlreadyPaid', v)}
                      placeholder="0"
                    />
                    <div />
                  </div>
                </>
              )}

              {/* Remove */}
              {debts.length > 1 && (
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => removeDebt(debt.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: COLOR_ERROR,
                      fontSize: FONT_SIZE_SM,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add debt */}
          {debts.length < 5 && (
            <button
              onClick={addDebt}
              style={{
                background: 'none',
                border: 'none',
                color: COLOR_ACCENT,
                fontSize: FONT_SIZE_BASE,
                fontWeight: 600,
                cursor: 'pointer',
                padding: `${SPACING_3} 0`,
                marginBottom: SPACING_6,
              }}
            >
              + Add another debt
            </button>
          )}

          {/* Cash flow */}
          <div style={{ marginBottom: SPACING_6 }}>
            <div style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, fontWeight: 700, marginBottom: '4px' }}>
              Monthly free cash flow
            </div>
            <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_SM, marginBottom: SPACING_3 }}>
              What&apos;s left after all bills are paid
            </div>
            <FieldInput
              label=""
              value={monthlyFreeCashFlow}
              onChange={setMonthlyFreeCashFlow}
              prefix="$"
              currency
            />
          </div>

          {/* Credit card conditional: upcoming application */}
          {hasCreditCard && (
            <div style={{ marginBottom: SPACING_6 }}>
              <button
                onClick={() => setActiveSheet({ kind: 'appType' })}
                style={{
                  width: '100%',
                  backgroundColor: COLOR_WHITE_CARD_BG,
                  border: `1px solid ${COLOR_BORDER}`,
                  borderRadius: RADIUS_MD,
                  padding: SPACING_4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                  marginBottom: upcomingApplicationType !== 'none' ? SPACING_3 : 0,
                }}
              >
                <div>
                  <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_XS, marginBottom: '4px' }}>Upcoming application?</div>
                  <div style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, fontWeight: 500 }}>
                    {appTypeLabel(upcomingApplicationType)}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18l6-6-6-6" stroke={COLOR_TEXT_TERTIARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {upcomingApplicationType !== 'none' && (
                <button
                  onClick={() => setActiveSheet({ kind: 'timeline' })}
                  style={{
                    width: '100%',
                    backgroundColor: COLOR_WHITE_CARD_BG,
                    border: `1px solid ${COLOR_BORDER}`,
                    borderRadius: RADIUS_MD,
                    padding: SPACING_4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ color: COLOR_TEXT_SECONDARY, fontSize: FONT_SIZE_XS, marginBottom: '4px' }}>When?</div>
                    <div style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE, fontWeight: 500 }}>
                      {timelineLabel(upcomingApplicationTimeline)}
                    </div>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 18l6-6-6-6" stroke={COLOR_TEXT_TERTIARY} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Loan conditional: toggles */}
          {hasLoan && (
            <div style={{ marginBottom: SPACING_6, display: 'flex', flexDirection: 'column', gap: SPACING_3 }}>
              <ToggleRow
                label="Recent hard inquiry?"
                value={hasRecentHardInquiry}
                onChange={setHasRecentHardInquiry}
              />
              <ToggleRow
                label="Recent late payments?"
                value={recentLatePayments}
                onChange={setRecentLatePayments}
              />
            </div>
          )}

          {error && (
            <p style={{ color: COLOR_ERROR, fontSize: FONT_SIZE_SM, marginBottom: SPACING_4 }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: SPACING_6,
          backgroundColor: COLOR_BACKGROUND,
        }}
      >
        <button
          onClick={handleSubmit}
          disabled={disabled}
          style={{
            width: '100%',
            backgroundColor: COLOR_ACCENT,
            color: COLOR_TEXT_PRIMARY,
            fontWeight: 700,
            fontSize: FONT_SIZE_BASE,
            borderRadius: RADIUS_FULL,
            padding: SPACING_4,
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          Find my moves
        </button>
      </div>

      {/* Overlay */}
      {activeSheet && (
        <div
          onClick={() => setActiveSheet(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        />
      )}

      {/* Bottom sheet */}
      {activeSheet && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: COLOR_WHITE_CARD_BG,
            borderRadius: '16px 16px 0 0',
            padding: SPACING_6,
            zIndex: 20,
            maxHeight: '70dvh',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              backgroundColor: COLOR_BORDER,
              borderRadius: RADIUS_FULL,
              margin: `0 auto ${SPACING_5}`,
            }}
          />
          {sheetOptions.map((option) => {
            const isSelected = sheetSelected === option.value
            return (
              <button
                key={option.value}
                onClick={() => handleSheetSelect(option.value)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  borderBottom: `1px solid ${COLOR_BORDER}`,
                  padding: `${SPACING_4} 0`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_LG, fontWeight: isSelected ? 600 : 400 }}>
                  {option.label}
                </span>
                {isSelected && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke={COLOR_ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        backgroundColor: COLOR_WHITE_CARD_BG,
        border: `1px solid ${COLOR_BORDER}`,
        borderRadius: RADIUS_MD,
        padding: SPACING_4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <span style={{ color: COLOR_TEXT_PRIMARY, fontSize: FONT_SIZE_BASE }}>{label}</span>
      <div style={{ display: 'flex', gap: SPACING_3 }}>
        {(['No', 'Yes'] as const).map((opt) => {
          const isActive = opt === 'Yes' ? value : !value
          return (
            <button
              key={opt}
              onClick={() => onChange(opt === 'Yes')}
              style={{
                padding: `6px ${SPACING_3}`,
                borderRadius: RADIUS_FULL,
                border: `1px solid ${isActive ? COLOR_ACCENT : COLOR_BORDER}`,
                backgroundColor: isActive ? COLOR_ACCENT : 'transparent',
                color: isActive ? COLOR_TEXT_PRIMARY : COLOR_TEXT_SECONDARY,
                fontSize: FONT_SIZE_SM,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
