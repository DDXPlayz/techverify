import type { VehicleAnalysis } from '../../types/vehicle'
import type { ComplianceReport, Rule, RuleResult } from '../../types/rules'
import { rules2026 } from '../../regulations/rules2026'

export const activeRulePack: Rule[] = rules2026

export function getRule(id: string): Rule | undefined {
  return activeRulePack.find((r) => r.id === id)
}

/**
 * Run every rule against the geometry database. Rules are independent and
 * side-effect free; a rule that throws is reported as manual-verification
 * rather than crashing the report.
 */
export function runCompliance(analysis: VehicleAnalysis): ComplianceReport {
  const t0 = performance.now()
  const results: RuleResult[] = activeRulePack.map((rule) => {
    try {
      return rule.evaluate(analysis)
    } catch (err) {
      console.error(`Rule ${rule.id} failed to evaluate`, err)
      return {
        ruleId: rule.id,
        status: 'manual' as const,
        explanation: `The automated check encountered unexpected geometry (${err instanceof Error ? err.message : 'unknown error'}). Verify this rule manually.`,
        confidence: 0,
        visuals: [],
      }
    }
  })

  const counts = { pass: 0, warning: 0, fail: 0, manual: 0 }
  for (const r of results) counts[r.status]++

  const automated = counts.pass + counts.warning + counts.fail
  // Warnings count as compliant but shave a little off the score
  const score = automated === 0 ? 0 : Math.round(((counts.pass + counts.warning * 0.7) / automated) * 100)

  const totalPenaltyPoints = results.reduce((s, r) => s + (r.penaltyPoints ?? 0), 0)

  return {
    results,
    score,
    counts,
    totalPenaltyPoints,
    generatedAt: Date.now(),
    durationMs: performance.now() - t0,
  }
}
