import type { VehicleAnalysis } from './vehicle'

export type RuleStatus = 'pass' | 'warning' | 'fail' | 'manual'

export type RuleClassification = 'GENERAL' | 'SAFETY' | 'PERFORMANCE'

export type RuleCategory =
  | 'Overall Dimensions'
  | 'Body'
  | 'Wheels'
  | 'Wing'
  | 'CO2 System'
  | 'Safety'
  | 'Clearance'
  | 'Weight'
  | 'General'

export interface RuleLimit {
  min?: number
  max?: number
  unit: 'mm' | 'g' | 'deg' | ''
  /** Fraction of the allowed band treated as the warning zone (default 0.1) */
  warnBand?: number
}

/** Visual overlay attached to a rule result, rendered in the 3D viewport */
export type RuleVisual =
  | {
      kind: 'dimension'
      a: [number, number, number]
      b: [number, number, number]
      label: string
      /** Direction to offset the dimension line for readability */
      offset?: [number, number, number]
    }
  | {
      kind: 'plane'
      axis: 'x' | 'y' | 'z'
      position: number
      label: string
    }
  | { kind: 'box'; min: [number, number, number]; max: [number, number, number]; label: string }
  | { kind: 'components'; ids: number[] }

export interface CameraTarget {
  position: [number, number, number]
  lookAt: [number, number, number]
}

export interface RuleResult {
  ruleId: string
  status: RuleStatus
  /** Measured value, when computable */
  measured?: number
  measuredLabel?: string
  explanation: string
  /** How to fix, when failing */
  remedy?: string
  /** 0..1 confidence in the automated result */
  confidence: number
  penaltyPoints?: number
  visuals: RuleVisual[]
  camera?: CameraTarget
}

export interface Rule {
  id: string
  regRef: string
  name: string
  category: RuleCategory
  classification: RuleClassification
  description: string
  limit?: RuleLimit
  penalty: string
  /** What the engine needs to evaluate this rule automatically */
  requires: 'none' | 'wheels' | 'components' | 'physical'
  evaluate: (a: VehicleAnalysis) => RuleResult
}

export interface ComplianceReport {
  results: RuleResult[]
  /** 0..100 — weighted share of automatable rules that pass */
  score: number
  counts: { pass: number; warning: number; fail: number; manual: number }
  totalPenaltyPoints: number
  generatedAt: number
  durationMs: number
}
