import { useMemo } from 'react'
import { useStore, type StatusFilter } from '../state/store'
import { activeRulePack } from '../engine/rules/runRules'
import { ScoreRing } from './ScoreRing'
import { RuleCard } from './RuleCard'
import type { RuleCategory } from '../types/rules'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fail', label: 'Failures' },
  { key: 'warning', label: 'Warnings' },
  { key: 'pass', label: 'Passes' },
  { key: 'manual', label: 'Manual' },
]

const CATEGORY_ORDER: RuleCategory[] = [
  'Overall Dimensions',
  'Clearance',
  'Body',
  'Wheels',
  'Wing',
  'CO2 System',
  'Safety',
  'Weight',
  'General',
]

export function ReportPanel() {
  const model = useStore((s) => s.model)
  const report = useStore((s) => s.report)
  const selectedRuleId = useStore((s) => s.selectedRuleId)
  const selectRule = useStore((s) => s.selectRule)
  const statusFilter = useStore((s) => s.statusFilter)
  const setStatusFilter = useStore((s) => s.setStatusFilter)

  const grouped = useMemo(() => {
    if (!report) return []
    const resultMap = new Map(report.results.map((r) => [r.ruleId, r]))
    return CATEGORY_ORDER.map((category) => ({
      category,
      rules: activeRulePack
        .filter((rule) => rule.category === category)
        .map((rule) => ({ rule, result: resultMap.get(rule.id)! }))
        .filter(({ result }) => result && (statusFilter === 'all' || result.status === statusFilter)),
    })).filter((g) => g.rules.length > 0)
  }, [report, statusFilter])

  if (!model || !report) return null
  const a = model.analysis
  const n = a.normalization

  return (
    <aside className="report-panel">
      <div className="report-summary">
        <ScoreRing score={report.score} hasFail={report.counts.fail > 0} />
        <div className="summary-counts">
          {(
            [
              ['pass', report.counts.pass, 'Pass'],
              ['warning', report.counts.warning, 'Warning'],
              ['fail', report.counts.fail, 'Fail'],
              ['manual', report.counts.manual, 'Manual'],
            ] as const
          ).map(([key, count, label]) => (
            <button
              key={key}
              className={`count-pill status-${key} ${statusFilter === key ? 'active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            >
              <span className="count-value mono">{count}</span>
              <span className="count-label">{label}</span>
            </button>
          ))}
        </div>
        {report.totalPenaltyPoints > 0 && (
          <p className="penalty-total mono">projected penalties: −{report.totalPenaltyPoints} pts</p>
        )}
      </div>

      <div className="model-facts mono">
        <span>{a.overallLength.toFixed(1)} × {a.overallWidth.toFixed(1)} × {a.overallHeight.toFixed(1)} mm</span>
        <span>{a.meshQuality.triangleCount.toLocaleString()} triangles · {a.components.length || 1} component{(a.components.length || 1) !== 1 ? 's' : ''}</span>
        <span>
          unit {n.detectedUnit} (×{n.appliedScale}) · symmetry {(a.symmetryScore * 100).toFixed(0)}% ·{' '}
          {a.meshQuality.watertight ? 'watertight' : `${a.meshQuality.openEdges} open edges`}
        </span>
        <span>analysed in {(a.analysisTimeMs / 1000).toFixed(2)} s</span>
      </div>

      <div className="report-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={statusFilter === f.key}
            className={`filter-tab ${statusFilter === f.key ? 'active' : ''}`}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rule-groups">
        {grouped.map(({ category, rules }) => (
          <section key={category} className="rule-group">
            <h3 className="rule-group-title">{category}</h3>
            {rules.map(({ rule, result }, i) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                result={result}
                index={i}
                selected={selectedRuleId === rule.id}
                onSelect={() => selectRule(selectedRuleId === rule.id ? null : rule.id)}
              />
            ))}
          </section>
        ))}
        {grouped.length === 0 && <p className="empty-filter">No rules match this filter.</p>}
      </div>
    </aside>
  )
}
