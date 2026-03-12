'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { simulateBalanceTransfer } from '@/modules/simulateBalanceTransfer'
import { simulateConsolidationLoan } from '@/modules/simulateConsolidationLoan'
import { simulatePaydownSequencing } from '@/modules/simulatePaydownSequencing'
import { simulateUtilizationOptimization, UtilizationInput } from '@/modules/simulateUtilizationOptimization'
import { simulateRefinanceWindow, RefinanceInput } from '@/modules/simulateRefinanceWindow'
import { buildStrategy, UserProfile } from '@/modules/buildStrategy'
import {
  COLOR_BACKGROUND,
  COLOR_ACCENT,
  COLOR_TEXT_PRIMARY,
  COLOR_TEXT_SECONDARY,
  FONT_SIZE_SM,
  FONT_SIZE_LG,
} from '@/styles/tokens'

const MESSAGES = [
  'Running your numbers.',
  'Finding what applies to you.',
  'Checking your sequencing.',
  "Calculating what you'd save.",
  'Almost there.',
]

export default function LoadingPage() {
  const router = useRouter()
  const [messageIndex, setMessageIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const modulesDone = useRef(false)
  const minTimeDone = useRef(false)

  function maybeRedirect() {
    if (modulesDone.current && minTimeDone.current) {
      router.push('/dashboard/results')
    }
  }

  useEffect(() => {
    const raw = sessionStorage.getItem('moduleInput')
    if (!raw) {
      router.push('/dashboard/input')
      return
    }

    const input = JSON.parse(raw)

    try {
      const baseInput = {
        creditScoreRange: input.creditScoreRange,
        debts: input.debts,
        monthlyFreeCashFlow: input.monthlyFreeCashFlow,
      }

      const m1 = simulateBalanceTransfer(baseInput)
      const m2 = simulateConsolidationLoan(baseInput)
      const m3 = simulatePaydownSequencing(baseInput)

      const utilizationInput: UtilizationInput = {
        creditScoreRange: input.creditScoreRange,
        debts: input.revolvingDebts ?? [],
        monthlyFreeCashFlow: input.monthlyFreeCashFlow,
        upcomingApplicationType: input.upcomingApplicationType ?? 'none',
        upcomingApplicationTimeline: input.upcomingApplicationTimeline ?? 'not_sure',
      }
      const m4 = simulateUtilizationOptimization(utilizationInput)

      const refinanceInput: RefinanceInput = {
        creditScoreRange: input.creditScoreRange,
        debts: input.refinanceableDebts ?? [],
        monthlyFreeCashFlow: input.monthlyFreeCashFlow,
        hasRecentHardInquiry: input.hasRecentHardInquiry ?? false,
        recentLatePayments: input.recentLatePayments ?? false,
      }
      const m5 = simulateRefinanceWindow(refinanceInput)

      const userProfile: UserProfile = {
        creditScoreRange: input.creditScoreRange,
        totalDebt: input.debts.reduce((sum: number, d: { balance: number }) => sum + d.balance, 0),
        monthlyFreeCashFlow: input.monthlyFreeCashFlow,
        upcomingApplicationType: input.upcomingApplicationType ?? 'none',
        upcomingApplicationTimeline: input.upcomingApplicationTimeline ?? 'not_sure',
      }

      const strategy = buildStrategy({ module1: m1, module2: m2, module3: m3, module4: m4, module5: m5, userProfile })
      sessionStorage.setItem('strategyResult', JSON.stringify(strategy))
    } catch {
      sessionStorage.setItem('strategyResult', JSON.stringify({
        move: 'None Available',
        message: 'Something went wrong running your analysis. Please try again.',
        nextSteps: [],
        returnTrigger: '',
      }))
    }

    modulesDone.current = true
    maybeRedirect()

    // Rotate messages with a fade transition every 4s
    const messageTimers: ReturnType<typeof setTimeout>[] = []
    MESSAGES.forEach((_, i) => {
      if (i === 0) return
      const fadeOut = setTimeout(() => setVisible(false), i * 4000 - 200)
      const swap = setTimeout(() => {
        setMessageIndex(i)
        setVisible(true)
      }, i * 4000)
      messageTimers.push(fadeOut, swap)
    })

    const minTimer = setTimeout(() => {
      minTimeDone.current = true
      maybeRedirect()
    }, 12000)

    return () => {
      messageTimers.forEach(clearTimeout)
      clearTimeout(minTimer)
    }
  }, [router])

  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.2; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <main
        style={{
          backgroundColor: COLOR_BACKGROUND,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '24px',
        }}
      >
        {/* Pulsing circle */}
        <div style={{ position: 'relative', width: '72px', height: '72px' }}>
          {/* Ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: COLOR_ACCENT,
              opacity: 0.2,
              animation: 'pulse-ring 1.5s ease-out infinite',
            }}
          />
          {/* Core */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: COLOR_ACCENT,
            }}
          />
        </div>

        {/* Rotating message */}
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              color: COLOR_TEXT_PRIMARY,
              fontSize: FONT_SIZE_LG,
              fontWeight: 500,
              margin: '0 0 8px',
              transition: 'opacity 0.2s ease',
              opacity: visible ? 1 : 0,
            }}
          >
            {MESSAGES[messageIndex]}
          </p>
          <p
            style={{
              color: COLOR_TEXT_SECONDARY,
              fontSize: FONT_SIZE_SM,
              margin: 0,
            }}
          >
            This usually takes a few seconds
          </p>
        </div>
      </main>
    </>
  )
}
