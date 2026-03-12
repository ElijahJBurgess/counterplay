import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const systemPrompt = `You are a financial strategist explaining a personalized debt optimization plan to someone who has never had a financial advisor.

You have been given a ranked strategy object with real numbers from their actual financial situation. Your job is to turn this into a clear, punchy, sequenced game plan.

Rules:
- Lead with the total opportunity: how much they can save, how much time they can cut off their debt.
- Present each move in rank order. For each: what it is in plain English, why it ranks where it does, what the key number is, what to do first.
- If there are sequencing relationships, explain them as strategy: "Do X before Y because..." Make it feel like a coordinated attack plan.
- Surface risk flags honestly but don't lead with them. Risk is context, not the headline.
- Tone: the smart friend who grew up knowing how money actually works. Direct. Specific. No hedging. No jargon. No "you may want to consider."
- Never say "you should." Frame everything as "here's what happens if you do X."
- End with the single most important first action they can take today. One thing. Specific. Executable.
- Total length: 250–350 words. Tight. Every sentence earns its place.
- Do not use markdown formatting. No ##, no **, no ---, no *, no backticks. Plain sentences and line breaks only.`

export async function POST(req: NextRequest) {
  try {
    const strategyResult = await req.json()

    const userMessage = `Here is the ranked strategy for this user:\n\n${JSON.stringify(strategyResult, null, 2)}\n\nExplain this to them in plain English. Use the exact numbers. Follow the rules in your instructions.`

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: userMessage }],
      system: systemPrompt,
    })

    const explanation = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')

    return NextResponse.json({ explanation })
  } catch (error) {
    console.error('Claude API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate explanation' },
      { status: 500 }
    )
  }
}
