import { create } from 'zustand'
import type { LoadedModel } from '../types/vehicle'
import type { ComplianceReport } from '../types/rules'
import type { AnalysisStage } from '../engine/pipeline/analyze'
import { archiveReport } from '../engine/archive'

export type AppPhase = 'landing' | 'analyzing' | 'report'

export type StatusFilter = 'all' | 'pass' | 'warning' | 'fail' | 'manual'

interface AppState {
  phase: AppPhase
  progressStage: AnalysisStage | null
  progressDetail: string
  error: { message: string; suggestion: string } | null

  model: LoadedModel | null
  report: ComplianceReport | null

  selectedRuleId: string | null
  statusFilter: StatusFilter

  setPhase: (phase: AppPhase) => void
  setProgress: (stage: AnalysisStage, detail: string) => void
  setError: (error: AppState['error']) => void
  setModel: (model: LoadedModel, report: ComplianceReport) => void
  selectRule: (id: string | null) => void
  setStatusFilter: (f: StatusFilter) => void
  reset: () => void
}

export const useStore = create<AppState>((set) => ({
  phase: 'landing',
  progressStage: null,
  progressDetail: '',
  error: null,
  model: null,
  report: null,
  selectedRuleId: null,
  statusFilter: 'all',

  setPhase: (phase) => set({ phase }),
  setProgress: (progressStage, progressDetail) => set({ progressStage, progressDetail }),
  setError: (error) => set(error ? { error, phase: 'landing' } : { error: null }),
  setModel: (model, report) => {
    set({ model, report, phase: 'report', selectedRuleId: null })
    // Internal archival only — best-effort, never blocks or affects the user.
    archiveReport(report, model.fileName)
  },
  selectRule: (selectedRuleId) => set({ selectedRuleId }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  reset: () =>
    set({
      phase: 'landing',
      progressStage: null,
      progressDetail: '',
      error: null,
      model: null,
      report: null,
      selectedRuleId: null,
      statusFilter: 'all',
    }),
}))
