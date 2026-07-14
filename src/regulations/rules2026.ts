import type { Rule, RuleResult } from '../types/rules'
import type { VehicleAnalysis } from '../types/vehicle'
import {
  judge,
  fmt,
  limitText,
  proportionalPenalty,
  manual,
  cameraFor,
  scanExtremes,
  frontAssemblyComponents,
  rearAssemblyComponents,
  wingLike,
  componentsVisual,
} from './helpers'

/**
 * STEM Racing India National Finals — Technical Regulations rule pack.
 * Data-driven: each rule is an independent module that reads only the
 * VehicleAnalysis geometry database. Rules never touch the UI or mutate geometry.
 */

const NEEDS_WHEELS =
  'This measurement is anchored to the wheel axles, and the engine could not confidently identify four wheels in this model.'
const WHEEL_REMEDY =
  'Export the car as an assembly with wheels as separate bodies (GLB or STL from the full assembly), or verify this dimension manually in CAD.'

function requireWheels(a: VehicleAnalysis, ruleId: string): RuleResult | null {
  if (a.wheels.length === 4) return null
  return manual(ruleId, NEEDS_WHEELS, WHEEL_REMEDY)
}

export const rules2026: Rule[] = [
  // ───────────────────────── Overall dimensions ─────────────────────────
  {
    id: 'T3.4',
    regRef: 'REG-T3.4',
    name: 'Total Width',
    category: 'Overall Dimensions',
    classification: 'GENERAL',
    description:
      'Assembled car width, measured normal to the vertical reference plane between the outer edges of the widest feature.',
    limit: { min: 65, max: 85, unit: 'mm' },
    penalty: '5 pts per mm (proportional)',
    requires: 'none',
    evaluate: (a) => {
      const limit = { min: 65, max: 85, unit: 'mm' as const }
      const { status, margin } = judge(a.overallWidth, limit)
      const y = a.bbox.min.y + a.overallHeight / 2
      return {
        ruleId: 'T3.4',
        status,
        measured: a.overallWidth,
        measuredLabel: `${fmt(a.overallWidth)} mm`,
        explanation:
          status === 'pass'
            ? `Overall width is ${fmt(a.overallWidth)} mm — inside the ${limitText(limit)} window with ${fmt(margin)} mm to spare.`
            : status === 'warning'
              ? `Overall width is ${fmt(a.overallWidth)} mm — only ${fmt(margin)} mm from the ${limitText(limit)} limit.`
              : `Overall width is ${fmt(a.overallWidth)} mm — outside ${limitText(limit)} by ${fmt(margin)} mm.`,
        remedy:
          status === 'fail'
            ? a.overallWidth > 85
              ? 'Narrow the widest feature (usually wing end plates or wheels) to bring the car under 85 mm.'
              : 'Widen the track or wings — the car must be at least 65 mm wide.'
            : undefined,
        confidence: 0.95,
        penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 5) : 0,
        visuals: [
          {
            kind: 'dimension',
            a: [a.centerOfGeometry.x, y, a.bbox.min.z],
            b: [a.centerOfGeometry.x, y, a.bbox.max.z],
            label: `${fmt(a.overallWidth)} mm`,
            offset: [0, 25, 0],
          },
        ],
        camera: cameraFor([0, 30, 0], 260, [1, 0.7, 0.2]),
      }
    },
  },
  {
    id: 'T3.5',
    regRef: 'REG-T3.5',
    name: 'Total Height',
    category: 'Overall Dimensions',
    classification: 'GENERAL',
    description:
      'Assembled car height from track surface to the highest feature, measured with the power unit cartridge inserted and the car resting on all four wheels.',
    limit: { max: 65, unit: 'mm' },
    penalty: '5 pts per mm (proportional)',
    requires: 'none',
    evaluate: (a) => {
      const limit = { max: 65, unit: 'mm' as const }
      const { status, margin } = judge(a.overallHeight, limit)
      return {
        ruleId: 'T3.5',
        status,
        measured: a.overallHeight,
        measuredLabel: `${fmt(a.overallHeight)} mm`,
        explanation:
          status === 'fail'
            ? `The highest feature sits ${fmt(a.overallHeight)} mm above the track — ${fmt(margin)} mm over the 65 mm maximum. Note: measured without a cartridge; the inserted cartridge cannot lower this value.`
            : `Maximum height is ${fmt(a.overallHeight)} mm against the 65 mm limit (${fmt(margin)} mm of headroom). Confirm the cartridge does not protrude above this height when inserted.`,
        remedy: status === 'fail' ? 'Lower the tallest feature — typically the rear wing or halo mount.' : undefined,
        confidence: 0.9,
        penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 5) : 0,
        visuals: [
          {
            kind: 'dimension',
            a: [a.bbox.min.x - 10, 0, 0],
            b: [a.bbox.min.x - 10, a.bbox.max.y, 0],
            label: `${fmt(a.overallHeight)} mm`,
            offset: [-14, 0, 0],
          },
          { kind: 'plane', axis: 'y', position: 65, label: '65 mm ceiling' },
        ],
        camera: cameraFor([0, 32, 0], 240, [-0.6, 0.35, 1]),
      }
    },
  },
  {
    id: 'T3.6',
    regRef: 'REG-T3.6',
    name: 'Total Weight',
    category: 'Weight',
    classification: 'GENERAL',
    description: 'Car weight excluding the power unit cartridge must be at least 50.0 g.',
    limit: { min: 50, unit: 'g' },
    penalty: '10 pts per gram (proportional)',
    requires: 'physical',
    evaluate: (a) =>
      manual(
        'T3.6',
        `Weight requires a calibrated scale — it cannot be derived from geometry alone. The model encloses ${fmt(
          a.totalVolume / 1000,
          1,
        )} cm³ of volume; with STEM Racing foam (~0.05 g/cm³) the body alone is far below 50 g, so plan ballast in the legal container under the halo.`,
        'Weigh the assembled car without the cartridge. If underweight, add ballast in the container under the halo (the only permitted location, per T1.22).',
      ),
  },
  {
    id: 'T3.7',
    regRef: 'REG-T3.7',
    name: 'Track Clearance',
    category: 'Clearance',
    classification: 'GENERAL',
    description:
      'Every component except the wheels must clear the track surface by at least 1.5 mm, with the cartridge inserted and the car on all four wheels.',
    limit: { min: 1.5, unit: 'mm' },
    penalty: '10 pts per mm (proportional)',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T3.7')
      if (gate) return gate
      if (a.bodyMinClearance === null) return manual('T3.7', NEEDS_WHEELS, WHEEL_REMEDY)
      const limit = { min: 1.5, unit: 'mm' as const, warnBand: 0.25 }
      const { status, margin } = judge(a.bodyMinClearance, limit)
      const lowest = a.components.find(
        (c) => !a.wheelComponentIds.has(c.id) && Math.abs(c.bbox.min.y - a.bodyMinClearance!) < 1e-6,
      )
      return {
        ruleId: 'T3.7',
        status,
        measured: a.bodyMinClearance,
        measuredLabel: `${fmt(a.bodyMinClearance, 2)} mm`,
        explanation:
          status === 'fail'
            ? `The lowest non-wheel geometry sits ${fmt(a.bodyMinClearance, 2)} mm above the track — below the 1.5 mm minimum.`
            : `Minimum ground clearance (excluding wheels) is ${fmt(a.bodyMinClearance, 2)} mm against the 1.5 mm minimum.`,
        remedy: status !== 'pass' ? 'Raise the lowest bodywork or wing element; check the front wing and any low splitter.' : undefined,
        confidence: 0.85,
        penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 10) : 0,
        visuals: [
          ...(lowest ? [componentsVisual([lowest.id])] : []),
          { kind: 'plane', axis: 'y', position: 1.5, label: '1.5 mm minimum clearance' },
        ],
        camera: cameraFor([lowest?.center.x ?? 0, 5, lowest?.center.z ?? 0], 160, [0.4, 0.25, 1]),
      }
    },
  },
  {
    id: 'T2.7.1',
    regRef: 'REG-T2.7',
    name: 'Main Body Length',
    category: 'Body',
    classification: 'GENERAL',
    description: 'The main car body must not exceed 205.0 mm in overall length.',
    limit: { max: 205, unit: 'mm' },
    penalty: 'Per T2.5 penalty schedule',
    requires: 'components',
    evaluate: (a) => {
      const body = a.components.filter((c) => !a.wheelComponentIds.has(c.id)).sort((x, y) => y.volume - x.volume)[0]
      if (!body || a.singleFusedMesh) {
        const limit = { max: 205, unit: 'mm' as const }
        const { status, margin } = judge(a.overallLength, limit)
        return {
          ruleId: 'T2.7.1',
          status: status === 'pass' ? 'pass' : 'manual',
          measured: a.overallLength,
          measuredLabel: `${fmt(a.overallLength)} mm (whole car)`,
          explanation:
            status === 'pass'
              ? `The entire car measures ${fmt(a.overallLength)} mm (${fmt(margin)} mm under the 205 mm body limit), so the body is compliant by inclusion.`
              : `The whole car measures ${fmt(a.overallLength)} mm. The 205 mm limit applies to the main body only, and the body could not be isolated in this model — verify the body length in CAD.`,
          confidence: status === 'pass' ? 0.9 : 0.5,
          visuals: [
            {
              kind: 'dimension',
              a: [a.bbox.min.x, -12, 0],
              b: [a.bbox.max.x, -12, 0],
              label: `${fmt(a.overallLength)} mm`,
              offset: [0, 0, 40],
            },
          ],
          camera: cameraFor([0, 25, 0], 280, [0.3, 0.7, 1]),
        }
      }
      const len = body.bbox.max.x - body.bbox.min.x
      const limit = { max: 205, unit: 'mm' as const }
      const { status, margin } = judge(len, limit)
      return {
        ruleId: 'T2.7.1',
        status,
        measured: len,
        measuredLabel: `${fmt(len)} mm`,
        explanation:
          status === 'fail'
            ? `The main body is ${fmt(len)} mm long — ${fmt(margin)} mm over the 205 mm maximum.`
            : `Main body length is ${fmt(len)} mm against the 205 mm maximum.`,
        remedy: status === 'fail' ? 'Shorten the main body; check rear bodywork behind the cartridge chamber.' : undefined,
        confidence: 0.8,
        penaltyPoints: 0,
        visuals: [
          componentsVisual([body.id]),
          {
            kind: 'dimension',
            a: [body.bbox.min.x, -12, 0],
            b: [body.bbox.max.x, -12, 0],
            label: `${fmt(len)} mm`,
            offset: [0, 0, 40],
          },
        ],
        camera: cameraFor([body.center.x, body.center.y, 0], 280, [0.3, 0.7, 1]),
      }
    },
  },

  // ───────────────────────── Wheels ─────────────────────────
  {
    id: 'T7.1',
    regRef: 'REG-T7.1',
    name: 'Number and Location of Wheels',
    category: 'Wheels',
    classification: 'GENERAL',
    description:
      'The car must run exactly four cylindrical wheels — two front, two rear — with opposing wheels sharing a common axis.',
    penalty: '25 pts',
    requires: 'wheels',
    evaluate: (a) => {
      if (a.wheels.length !== 4) {
        return manual(
          'T7.1',
          a.singleFusedMesh
            ? 'The model is a single fused mesh, so individual wheels cannot be isolated and counted.'
            : `The engine identified ${a.wheels.length} wheel-like component(s) instead of 4.`,
          WHEEL_REMEDY,
        )
      }
      const frontOk = a.frontAxle!.wheels.length === 2
      const rearOk = a.rearAxle!.wheels.length === 2
      const misalign = Math.max(
        Math.abs(a.frontAxle!.wheels[0].center.x - a.frontAxle!.wheels[1].center.x),
        Math.abs(a.rearAxle!.wheels[0].center.x - a.rearAxle!.wheels[1].center.x),
      )
      const aligned = misalign < 1.0
      const status = frontOk && rearOk && aligned ? 'pass' : 'fail'
      return {
        ruleId: 'T7.1',
        status,
        measuredLabel: '4 wheels',
        explanation: aligned
          ? `Four wheels detected — two per axle, opposing wheels aligned within ${fmt(misalign, 2)} mm.`
          : `Opposing wheels are misaligned by ${fmt(misalign, 2)} mm along the car axis — they must share a common centreline.`,
        remedy: aligned ? undefined : 'Align opposing wheel centres onto a shared axle axis in the assembly.',
        confidence: 0.9,
        penaltyPoints: status === 'fail' ? 25 : 0,
        visuals: [componentsVisual(a.wheels.map((w) => w.componentId))],
        camera: cameraFor([0, 15, 0], 260, [0.5, 0.6, 1]),
      }
    },
  },
  {
    id: 'T7.3',
    regRef: 'REG-T7.3',
    name: 'Wheelbase',
    category: 'Overall Dimensions',
    classification: 'PERFORMANCE',
    description: 'Distance between the front and rear wheel centrelines, viewed from the side.',
    limit: { min: 120, max: 140, unit: 'mm' },
    penalty: '5 pts per mm (proportional)',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T7.3')
      if (gate) return gate
      const wb = a.wheelbase!
      const limit = { min: 120, max: 140, unit: 'mm' as const }
      const { status, margin } = judge(wb, limit)
      const y = a.wheels[0].center.y
      return {
        ruleId: 'T7.3',
        status,
        measured: wb,
        measuredLabel: `${fmt(wb)} mm`,
        explanation:
          status === 'fail'
            ? `Wheelbase is ${fmt(wb)} mm — outside the ${limitText(limit)} window by ${fmt(margin)} mm.`
            : `Wheelbase is ${fmt(wb)} mm, inside the ${limitText(limit)} window.`,
        remedy: status === 'fail' ? 'Move an axle: the front and rear axle centrelines must be 120–140 mm apart.' : undefined,
        confidence: 0.9,
        penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 5) : 0,
        visuals: [
          {
            kind: 'dimension',
            a: [a.rearAxle!.x, y, a.bbox.max.z + 8],
            b: [a.frontAxle!.x, y, a.bbox.max.z + 8],
            label: `${fmt(wb)} mm`,
            offset: [0, -y + 4, 14],
          },
        ],
        camera: cameraFor([(a.frontAxle!.x + a.rearAxle!.x) / 2, 20, 0], 240, [0.15, 0.4, 1]),
      }
    },
  },
  {
    id: 'T7.5',
    regRef: 'REG-T7.5',
    name: 'Wheel Diameter',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'Each wheel diameter, measured across the rolling surface, must be between 28.0 and 32.0 mm.',
    limit: { min: 28, max: 32, unit: 'mm' },
    penalty: '2.5 pts per mm per wheel (proportional)',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T7.5')
      if (gate) return gate
      const limit = { min: 28, max: 32, unit: 'mm' as const }
      let worst = a.wheels[0]
      let worstJudge = judge(worst.diameter, limit)
      let points = 0
      const failing: number[] = []
      for (const w of a.wheels) {
        const j = judge(w.diameter, limit)
        if (j.status === 'fail') {
          failing.push(w.componentId)
          points += proportionalPenalty(j.margin, 2.5)
        }
        if (j.margin < worstJudge.margin || (j.status === 'fail' && worstJudge.status !== 'fail')) {
          worst = w
          worstJudge = j
        }
      }
      const diameters = a.wheels.map((w) => fmt(w.diameter)).join(' / ')
      return {
        ruleId: 'T7.5',
        status: worstJudge.status,
        measured: worst.diameter,
        measuredLabel: `${diameters} mm`,
        explanation:
          worstJudge.status === 'fail'
            ? `Wheel diameters are ${diameters} mm — ${failing.length} wheel(s) fall outside ${limitText(limit)}.`
            : `All four wheel diameters (${diameters} mm) are inside ${limitText(limit)}.`,
        remedy: worstJudge.status === 'fail' ? 'Resize the failing wheels to a 28–32 mm rolling diameter.' : undefined,
        confidence: 0.9,
        penaltyPoints: points,
        visuals: [componentsVisual(failing.length ? failing : a.wheels.map((w) => w.componentId))],
        camera: cameraFor([worst.center.x, worst.center.y, worst.center.z], 110, [0.5, 0.4, worst.center.z >= 0 ? 1 : -1]),
      }
    },
  },
  {
    id: 'T7.2.1',
    regRef: 'REG-T7.2.1',
    name: 'Front Wheel Inner Distance',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'Innermost distance between the two front wheels, measured parallel to the track surface.',
    limit: { min: 38, unit: 'mm' },
    penalty: '2.5 pts per mm (proportional)',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T7.2.1')
      if (gate) return gate
      const d = a.frontAxle!.innerDistance
      if (d === null) return manual('T7.2.1', NEEDS_WHEELS, WHEEL_REMEDY)
      const limit = { min: 38, unit: 'mm' as const }
      const { status, margin } = judge(d, limit)
      const y = a.frontAxle!.wheels[0].center.y
      const x = a.frontAxle!.x
      const [w1, w2] = a.frontAxle!.wheels
      return {
        ruleId: 'T7.2.1',
        status,
        measured: d,
        measuredLabel: `${fmt(d)} mm`,
        explanation:
          status === 'fail'
            ? `The front wheels are ${fmt(d)} mm apart on their inner faces — ${fmt(margin)} mm under the 38 mm minimum.`
            : `Front inner wheel distance is ${fmt(d)} mm against the 38 mm minimum.`,
        remedy: status === 'fail' ? 'Widen the front track so the inner wheel faces are at least 38 mm apart.' : undefined,
        confidence: 0.88,
        penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 2.5) : 0,
        visuals: [
          {
            kind: 'dimension',
            a: [x, y, w1.innerZ],
            b: [x, y, w2.innerZ],
            label: `${fmt(d)} mm`,
            offset: [0, 22, 0],
          },
        ],
        camera: cameraFor([x, y, 0], 150, [1, 0.5, 0.15]),
      }
    },
  },
  {
    id: 'T7.2.2',
    regRef: 'REG-T7.2.2',
    name: 'Rear Wheel Inner Distance',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'Innermost distance between the two rear wheels, measured parallel to the track surface.',
    limit: { min: 30, unit: 'mm' },
    penalty: '2.5 pts per mm (proportional)',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T7.2.2')
      if (gate) return gate
      const d = a.rearAxle!.innerDistance
      if (d === null) return manual('T7.2.2', NEEDS_WHEELS, WHEEL_REMEDY)
      const limit = { min: 30, unit: 'mm' as const }
      const { status, margin } = judge(d, limit)
      const y = a.rearAxle!.wheels[0].center.y
      const x = a.rearAxle!.x
      const [w1, w2] = a.rearAxle!.wheels
      return {
        ruleId: 'T7.2.2',
        status,
        measured: d,
        measuredLabel: `${fmt(d)} mm`,
        explanation:
          status === 'fail'
            ? `The rear wheels are ${fmt(d)} mm apart on their inner faces — ${fmt(margin)} mm under the 30 mm minimum.`
            : `Rear inner wheel distance is ${fmt(d)} mm against the 30 mm minimum.`,
        remedy: status === 'fail' ? 'Widen the rear track so the inner wheel faces are at least 30 mm apart.' : undefined,
        confidence: 0.88,
        penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 2.5) : 0,
        visuals: [
          {
            kind: 'dimension',
            a: [x, y, w1.innerZ],
            b: [x, y, w2.innerZ],
            label: `${fmt(d)} mm`,
            offset: [0, 22, 0],
          },
        ],
        camera: cameraFor([x, y, 0], 150, [-1, 0.5, 0.15]),
      }
    },
  },
  {
    id: 'T7.4.1',
    regRef: 'REG-T7.4.1',
    name: 'Front Track Contact Width',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'The surface of each front wheel in constant contact with the track must be at least 13.0 mm wide.',
    limit: { min: 13, unit: 'mm' },
    penalty: '2.5 pts per mm per wheel (proportional)',
    requires: 'wheels',
    evaluate: (a) => contactWidthRule(a, 'T7.4.1', true, 13),
  },
  {
    id: 'T7.4.2',
    regRef: 'REG-T7.4.2',
    name: 'Rear Track Contact Width',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'The surface of each rear wheel in constant contact with the track must be at least 17.0 mm wide.',
    limit: { min: 17, unit: 'mm' },
    penalty: '2.5 pts per mm per wheel (proportional)',
    requires: 'wheels',
    evaluate: (a) => contactWidthRule(a, 'T7.4.2', false, 17),
  },
  {
    id: 'T7.6',
    regRef: 'REG-T7.6',
    name: 'Race Track Contact',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'All four wheels must touch the track surface simultaneously across their full contact width.',
    penalty: '2.5 pts per wheel',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T7.6')
      if (gate) return gate
      const lifted = a.wheels.filter((w) => w.groundGap > 0.25)
      const status = lifted.length === 0 ? 'pass' : 'fail'
      return {
        ruleId: 'T7.6',
        status,
        measuredLabel: `${4 - lifted.length}/4 wheels grounded`,
        explanation:
          status === 'pass'
            ? 'All four wheels contact the track plane simultaneously (within 0.25 mm).'
            : `${lifted.length} wheel(s) sit ${lifted.map((w) => fmt(w.groundGap, 2)).join(', ')} mm above the track plane — the car does not rest on all four wheels.`,
        remedy: status === 'fail' ? 'Equalise wheel diameters and axle heights so every wheel touches the track.' : undefined,
        confidence: 0.85,
        penaltyPoints: lifted.length * 2.5,
        visuals: [componentsVisual((lifted.length ? lifted : a.wheels).map((w) => w.componentId))],
        camera: cameraFor([0, 5, 0], 220, [0.4, 0.15, 1]),
      }
    },
  },
  {
    id: 'T7.7',
    regRef: 'REG-T7.7',
    name: 'Rolling Surface Consistency',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'Wheel diameter must be consistent across the contact width — no tread-like features.',
    penalty: '2.5 pts per wheel',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T7.7')
      if (gate) return gate
      const rough = a.wheels.filter((w) => w.roundness > 0.05)
      const status = rough.length === 0 ? 'pass' : 'warning'
      return {
        ruleId: 'T7.7',
        status,
        measuredLabel: `max deviation ${fmt(Math.max(...a.wheels.map((w) => w.roundness)) * 100, 1)}%`,
        explanation:
          status === 'pass'
            ? 'All rolling surfaces are uniform cylinders — rim radius deviation is under 5%.'
            : `${rough.length} wheel(s) show radial deviation above 5% on the rim — check for tread features or faceted geometry. Judges measure the physical part; verify the machined wheel is smooth.`,
        confidence: 0.7,
        visuals: [componentsVisual((rough.length ? rough : a.wheels).map((w) => w.componentId))],
        camera: cameraFor([a.wheels[0].center.x, a.wheels[0].center.y, a.wheels[0].center.z], 100, [0.6, 0.5, 1]),
      }
    },
  },

  // ───────────────────────── Nose & front wing ─────────────────────────
  {
    id: 'T8.2',
    regRef: 'REG-T8.2',
    name: 'Nose Cone Overhang',
    category: 'Body',
    classification: 'GENERAL',
    description: 'From reference plane A (16 mm ahead of the front axle) to the extreme front of the car: maximum 40 mm.',
    limit: { max: 40, unit: 'mm' },
    penalty: '5 pts',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T8.2')
      if (gate) return gate
      const planeA = a.planes.a!
      const overhang = a.bbox.max.x - planeA
      const limit = { max: 40, unit: 'mm' as const }
      const { status, margin } = judge(overhang, limit)
      return {
        ruleId: 'T8.2',
        status,
        measured: overhang,
        measuredLabel: `${fmt(overhang)} mm`,
        explanation:
          status === 'fail'
            ? `The nose extends ${fmt(overhang)} mm beyond reference plane A — ${fmt(margin)} mm over the 40 mm maximum.`
            : `Nose overhang is ${fmt(overhang)} mm beyond reference plane A (40 mm allowed).`,
        remedy: status === 'fail' ? 'Shorten the nose cone / front wing assembly.' : undefined,
        confidence: 0.88,
        penaltyPoints: status === 'fail' ? 5 : 0,
        visuals: [
          { kind: 'plane', axis: 'x', position: planeA, label: 'Reference plane A' },
          {
            kind: 'dimension',
            a: [planeA, 30, 0],
            b: [a.bbox.max.x, 30, 0],
            label: `${fmt(overhang)} mm`,
            offset: [0, 14, 0],
          },
        ],
        camera: cameraFor([a.bbox.max.x - 20, 20, 0], 160, [0.8, 0.45, 1]),
      }
    },
  },
  {
    id: 'T8.6.1',
    regRef: 'REG-T8.6.1',
    name: 'Front Wing Span',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'Front wing span must total at least 50 mm (a split wing needs two segments of at least 25 mm each).',
    limit: { min: 50, unit: 'mm' },
    penalty: '2 pts per mm (proportional)',
    requires: 'components',
    evaluate: (a) => wingSpanRule(a, 'T8.6.1', 'front'),
  },
  {
    id: 'T8.6.2',
    regRef: 'REG-T8.6.2',
    name: 'Front Wing Chord',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'Front wing chord (leading edge to trailing edge) must be 15–25 mm across the whole span.',
    limit: { min: 15, max: 25, unit: 'mm' },
    penalty: '1 pt per mm (proportional)',
    requires: 'components',
    evaluate: (a) => wingChordRule(a, 'T8.6.2', 'front'),
  },
  {
    id: 'T8.6.3',
    regRef: 'REG-T8.6.3',
    name: 'Front Wing Thickness',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'Front wing thickness must be 2–6 mm throughout the span.',
    limit: { min: 2, max: 6, unit: 'mm' },
    penalty: '1 pt per mm (proportional)',
    requires: 'components',
    evaluate: (a) => wingThicknessRule(a, 'T8.6.3', 'front'),
  },
  {
    id: 'T8.5.1',
    regRef: 'REG-T8.5.1',
    name: 'Nose Support Height',
    category: 'Wing',
    classification: 'GENERAL',
    description:
      'The nose and front wing support structure ahead of reference plane A must stay within 25 mm of the track surface (when within ±15 mm of the centreline).',
    limit: { max: 25, unit: 'mm' },
    penalty: '10 pts',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T8.5.1')
      if (gate) return gate
      const planeA = a.planes.a!
      const ext = scanExtremes(a.weldedPositions, (x, _y, z) => x > planeA && Math.abs(z) <= 15)
      if (ext.count === 0) return manual('T8.5.1', 'No geometry found forward of reference plane A within ±15 mm of the centreline.')
      const limit = { max: 25, unit: 'mm' as const }
      const { status, margin } = judge(ext.maxY, limit)
      return {
        ruleId: 'T8.5.1',
        status,
        measured: ext.maxY,
        measuredLabel: `${fmt(ext.maxY)} mm`,
        explanation:
          status === 'fail'
            ? `Structure ahead of plane A reaches ${fmt(ext.maxY)} mm above the track within the central ±15 mm band — ${fmt(margin)} mm over the 25 mm limit.`
            : `The tallest central structure ahead of plane A is ${fmt(ext.maxY)} mm above the track (25 mm allowed).`,
        remedy: status === 'fail' ? 'Lower the nose / wing support structure ahead of reference plane A.' : undefined,
        confidence: 0.8,
        penaltyPoints: status === 'fail' ? 10 : 0,
        visuals: [
          { kind: 'plane', axis: 'x', position: planeA, label: 'Reference plane A' },
          { kind: 'plane', axis: 'y', position: 25, label: '25 mm ceiling (nose zone)' },
        ],
        camera: cameraFor([a.bbox.max.x - 15, 15, 0], 150, [0.9, 0.4, 0.8]),
      }
    },
  },

  // ───────────────────────── Rear wing ─────────────────────────
  {
    id: 'T9.4.1',
    regRef: 'REG-T9.4.1',
    name: 'Rear Wing Position',
    category: 'Wing',
    classification: 'GENERAL',
    description: 'The whole rear wing and its support structure must sit rearward of reference plane B.',
    penalty: '10 pts',
    requires: 'components',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T9.4.1')
      if (gate) return gate
      const rear = rearAssemblyComponents(a).filter(wingLike)
      if (rear.length === 0)
        return manual(
          'T9.4.1',
          'No wing-like component was found fully rearward of reference plane B.',
          'If the rear wing is merged with the body, verify its position in CAD: every wing surface must be rearward of plane B (16 mm behind the rear axle).',
        )
      return {
        ruleId: 'T9.4.1',
        status: 'pass',
        explanation: `Rear wing assembly (${rear.length} component${rear.length > 1 ? 's' : ''}) sits fully rearward of reference plane B.`,
        confidence: 0.8,
        visuals: [
          componentsVisual(rear.map((c) => c.id)),
          { kind: 'plane', axis: 'x', position: a.planes.b!, label: 'Reference plane B' },
        ],
        camera: cameraFor([a.bbox.min.x + 15, 40, 0], 170, [-0.8, 0.5, 0.9]),
      }
    },
  },
  {
    id: 'T9.4.2',
    regRef: 'REG-T9.4.2',
    name: 'Rear Overhang Length',
    category: 'Overall Dimensions',
    classification: 'GENERAL',
    description: 'From reference plane B (16 mm behind the rear axle) to the extreme rear of the car: maximum 40 mm.',
    limit: { max: 40, unit: 'mm' },
    penalty: '5 pts',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T9.4.2')
      if (gate) return gate
      const planeB = a.planes.b!
      const overhang = planeB - a.bbox.min.x
      const limit = { max: 40, unit: 'mm' as const }
      const { status, margin } = judge(overhang, limit)
      return {
        ruleId: 'T9.4.2',
        status,
        measured: overhang,
        measuredLabel: `${fmt(overhang)} mm`,
        explanation:
          status === 'fail'
            ? `The car extends ${fmt(overhang)} mm behind reference plane B — ${fmt(margin)} mm over the 40 mm maximum.`
            : `Rear overhang is ${fmt(overhang)} mm behind reference plane B (40 mm allowed).`,
        remedy: status === 'fail' ? 'Bring the rear wing / bodywork forward.' : undefined,
        confidence: 0.88,
        penaltyPoints: status === 'fail' ? 5 : 0,
        visuals: [
          { kind: 'plane', axis: 'x', position: planeB, label: 'Reference plane B' },
          {
            kind: 'dimension',
            a: [a.bbox.min.x, 35, 0],
            b: [planeB, 35, 0],
            label: `${fmt(overhang)} mm`,
            offset: [0, 14, 0],
          },
        ],
        camera: cameraFor([a.bbox.min.x + 20, 25, 0], 160, [-0.8, 0.45, 1]),
      }
    },
  },
  {
    id: 'T9.4.3',
    regRef: 'REG-T9.4.3',
    name: 'Rear Overhang Height',
    category: 'Overall Dimensions',
    classification: 'GENERAL',
    description: 'Nothing rearward of reference plane B may sit more than 65 mm above the track surface.',
    limit: { max: 65, unit: 'mm' },
    penalty: '5 pts',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T9.4.3')
      if (gate) return gate
      const planeB = a.planes.b!
      const ext = scanExtremes(a.weldedPositions, (x) => x < planeB)
      if (ext.count === 0) return manual('T9.4.3', 'No geometry found rearward of reference plane B.')
      const limit = { max: 65, unit: 'mm' as const }
      const { status, margin } = judge(ext.maxY, limit)
      return {
        ruleId: 'T9.4.3',
        status,
        measured: ext.maxY,
        measuredLabel: `${fmt(ext.maxY)} mm`,
        explanation:
          status === 'fail'
            ? `Rear structure reaches ${fmt(ext.maxY)} mm above the track — ${fmt(margin)} mm over the 65 mm maximum.`
            : `The tallest rear structure is ${fmt(ext.maxY)} mm above the track (65 mm allowed).`,
        remedy: status === 'fail' ? 'Lower the rear wing.' : undefined,
        confidence: 0.88,
        penaltyPoints: status === 'fail' ? 5 : 0,
        visuals: [
          { kind: 'plane', axis: 'x', position: planeB, label: 'Reference plane B' },
          { kind: 'plane', axis: 'y', position: 65, label: '65 mm ceiling' },
        ],
        camera: cameraFor([a.bbox.min.x + 20, 45, 0], 170, [-0.7, 0.5, 1]),
      }
    },
  },
  {
    id: 'T9.5.1',
    regRef: 'REG-T9.5.1',
    name: 'Rear Wing Span',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'The rear wing must exist as a single unbroken span of at least 50 mm.',
    limit: { min: 50, unit: 'mm' },
    penalty: '2 pts per mm (proportional)',
    requires: 'components',
    evaluate: (a) => wingSpanRule(a, 'T9.5.1', 'rear'),
  },
  {
    id: 'T9.5.2',
    regRef: 'REG-T9.5.2',
    name: 'Rear Wing Chord',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'Rear wing chord (leading edge to trailing edge) must be 15–25 mm across the whole span.',
    limit: { min: 15, max: 25, unit: 'mm' },
    penalty: '1 pt per mm (proportional)',
    requires: 'components',
    evaluate: (a) => wingChordRule(a, 'T9.5.2', 'rear'),
  },
  {
    id: 'T9.5.3',
    regRef: 'REG-T9.5.3',
    name: 'Rear Wing Thickness',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'Rear wing thickness must be 2–6 mm throughout the span.',
    limit: { min: 2, max: 6, unit: 'mm' },
    penalty: '1 pt per mm (proportional)',
    requires: 'components',
    evaluate: (a) => wingThicknessRule(a, 'T9.5.3', 'rear'),
  },

  // ───────────────────────── Manual verification ─────────────────────────
  {
    id: 'T4.2',
    regRef: 'REG-T4.2',
    name: 'Virtual Cargo',
    category: 'Body',
    classification: 'GENERAL',
    description:
      'A 10 × 10 × 5 mm virtual cargo volume must be fully enclosed by the body, between the wheel centrelines, symmetric about the vertical reference plane.',
    penalty: '25 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T4.2',
        'The virtual cargo is an invisible design volume — it exists in your CAD model and engineering drawings, not in the exported mesh, so it cannot be located automatically.',
        'In CAD, confirm a 10 × 10 × 5 mm block fits inside the body between the axle centrelines, centred on the car centreline, and dimension it in the drawings (T4.3).',
      ),
  },
  {
    id: 'T4.4.1',
    regRef: 'REG-T4.4.1',
    name: 'Halo Inclusion',
    category: 'Safety',
    classification: 'SAFETY',
    description: 'The official Halo must be included without any dimensional or surface profile changes.',
    penalty: '10 pts',
    requires: 'physical',
    evaluate: (a) => {
      const candidates = a.components.filter(
        (c) =>
          !a.wheelComponentIds.has(c.id) &&
          c.center.y > a.overallHeight * 0.5 &&
          c.triangleCount > 50 &&
          c.volume < a.totalVolume * 0.2,
      )
      return manual(
        'T4.4.1',
        candidates.length > 0
          ? `A raised component that may be the Halo was found (${candidates.length} candidate${candidates.length > 1 ? 's' : ''}), but verifying it is dimensionally identical to the official part requires comparison against the official Halo file.`
          : 'No obvious Halo component could be isolated in this model.',
        'Confirm the official downloaded Halo is present and unmodified, with its pocket cut by a 6.35 mm ball-nose tool to 3.175 mm depth (Appendix IX).',
      )
    },
  },
  {
    id: 'T4.4.4',
    regRef: 'REG-T4.4.4',
    name: 'Halo Notch Height',
    category: 'Safety',
    classification: 'SAFETY',
    description: 'The Halo circular notch centre must be 34.0 ± 1.0 mm above the track; the pocket bottom at 24.0 mm, parallel to the track.',
    limit: { min: 33, max: 35, unit: 'mm' },
    penalty: '5 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T4.4.4',
        'Locating the Halo circular notch requires identifying the official Halo part, which cannot be isolated reliably from mesh geometry alone.',
        'Measure in CAD: notch centre 34.0 ± 1.0 mm above track, pocket bottom 24.0 mm above track and parallel to it.',
      ),
  },
  {
    id: 'T5.1',
    regRef: 'REG-T5.1',
    name: 'Cartridge Chamber Diameter',
    category: 'CO2 System',
    classification: 'SAFETY',
    description: 'The power unit cartridge chamber must be 18.0–18.5 mm in diameter through its full depth.',
    limit: { min: 18, max: 18.5, unit: 'mm' },
    penalty: '5 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T5.1',
        'The chamber is an internal cavity; measuring its bore from a surface mesh requires cavity recognition that cannot be verified to regulation tolerance (±0.25 mm) on tessellated geometry.',
        'Verify the chamber bore is 18.0–18.5 mm in CAD, and keep the bore free of paint.',
      ),
  },
  {
    id: 'T5.2',
    regRef: 'REG-T5.2',
    name: 'Cartridge Height Above Track',
    category: 'CO2 System',
    classification: 'SAFETY',
    description: 'The rear centre of the cartridge must sit 30–40 mm above the track surface.',
    limit: { min: 30, max: 40, unit: 'mm' },
    penalty: '5 pts per mm (proportional)',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T5.2',
        'The chamber axis could not be measured from the exported mesh. This dimension is measured to the cartridge rear centre with the cartridge inserted.',
        'In CAD, measure from the track plane to the chamber axis at the rear face: it must be 30–40 mm.',
      ),
  },
  {
    id: 'T5.5',
    regRef: 'REG-T5.5',
    name: 'Chamber Safety Zone',
    category: 'Safety',
    classification: 'SAFETY',
    description: 'A 3.5 mm minimum wall of body material must surround the chamber for its full minimum depth; nothing may intersect it.',
    limit: { min: 3.5, unit: 'mm' },
    penalty: '10 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T5.5',
        'Wall thickness around an internal bore requires exact cavity geometry — a tessellated export cannot prove a 3.5 mm minimum wall everywhere.',
        'In CAD, run a wall-thickness check around the chamber: ≥ 3.5 mm for the full circumference and depth. Keep screws, guides and pockets clear of this zone.',
      ),
  },
  {
    id: 'T6.1',
    regRef: 'REG-T6.1',
    name: 'Tether Line Guide Location',
    category: 'Safety',
    classification: 'SAFETY',
    description:
      'Exactly two closed tether guides: one on or up to 10 mm ahead of the front axle, one on or up to 10 mm behind the rear axle.',
    penalty: '10 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T6.1',
        'Tether guides are small closed loops under the car; they are frequently modelled as separate hardware and are difficult to identify unambiguously in a mesh export.',
        'Confirm two fully closed guides on the centreline: front guide within 10 mm ahead of the front axle, rear guide within 10 mm behind the rear axle, openings 3.5–6.0 mm (T6.2).',
      ),
  },
  {
    id: 'T6.3',
    regRef: 'REG-T6.3',
    name: 'Tether Guide Integrity',
    category: 'Safety',
    classification: 'SAFETY',
    description: 'Guide holes must be completely closed and rigid — each guide is tested with a 200 g suspended weight.',
    penalty: '10 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T6.3',
        'Structural robustness under the 200 g scrutineering load is a physical test.',
        'Use continuous closed loops (no C-shapes or snap-fits) firmly bonded to the body.',
      ),
  },
  {
    id: 'T7.11',
    regRef: 'REG-T7.11',
    name: 'Front Wheel Visibility',
    category: 'Wheels',
    classification: 'PERFORMANCE',
    description: 'In front view, front wheels may only be obstructed up to 20 mm above the track surface.',
    limit: { max: 20, unit: 'mm' },
    penalty: '10 pts per mm (proportional)',
    requires: 'wheels',
    evaluate: (a) => {
      const gate = requireWheels(a, 'T7.11')
      if (gate) return gate
      // Conservative screen: any non-wheel geometry ahead of the front wheels within
      // their Z band and above 20 mm indicates possible obstruction.
      const front = a.frontAxle!
      const bands = front.wheels.map((w) => [Math.min(w.innerZ, w.outerZ), Math.max(w.innerZ, w.outerZ)] as const)
      let maxObstruction = 0
      const pos = a.weldedPositions
      // Geometry strictly ahead of the wheels' leading edge within the wheel Z-band
      // (the wheels themselves must not count as their own obstruction):
      const xLead = front.x + Math.max(...front.wheels.map((w) => w.diameter)) / 2 + 0.5
      let obstructed = false
      for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i]
        const y = pos[i + 1]
        const z = pos[i + 2]
        if (x < xLead) continue
        const inBand = bands.some(([lo, hi]) => z >= lo && z <= hi)
        if (!inBand) continue
        if (y > 20 && y > maxObstruction) {
          maxObstruction = y
          obstructed = true
        }
      }
      return {
        ruleId: 'T7.11',
        status: obstructed ? 'warning' : 'pass',
        measured: maxObstruction || undefined,
        measuredLabel: obstructed ? `${fmt(maxObstruction)} mm` : 'clear above 20 mm',
        explanation: obstructed
          ? `Geometry ahead of the front axle overlaps the front wheels' silhouette up to ${fmt(maxObstruction)} mm above the track (20 mm allowed). This is a projection estimate — confirm in a true front view.`
          : 'No geometry ahead of the front axle overlaps the front wheels above 20 mm from the track.',
        remedy: obstructed ? 'Trim bodywork or wing elements that screen the front wheels above 20 mm.' : undefined,
        confidence: 0.6,
        visuals: [{ kind: 'plane', axis: 'y', position: 20, label: '20 mm obstruction limit' }],
        camera: cameraFor([a.bbox.max.x, 20, 0], 180, [1, 0.3, 0]),
      }
    },
  },
  {
    id: 'T8.7',
    regRef: 'REG-T8.7',
    name: 'Front Wing Clear Airflow',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'The front wing needs 5 mm of clear air space normal to every wing surface (checked with a 5 mm sphere).',
    limit: { min: 5, unit: 'mm' },
    penalty: '5 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T8.7',
        'This check sweeps a 5 mm sphere over every wing surface against all other bodies — verify with an interference/clearance check in CAD.',
        'In CAD, offset the wing surfaces by 5 mm and check the offset volume intersects nothing (including the track plane).',
      ),
  },
  {
    id: 'T9.6',
    regRef: 'REG-T9.6',
    name: 'Rear Wing Clear Airflow',
    category: 'Wing',
    classification: 'PERFORMANCE',
    description: 'The rear wing needs 5 mm of clear air space normal to every wing surface (checked with a 5 mm sphere).',
    limit: { min: 5, unit: 'mm' },
    penalty: '5 pts',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T9.6',
        'This check sweeps a 5 mm sphere over every wing surface against all other bodies — verify with an interference/clearance check in CAD.',
        'In CAD, offset the wing surfaces by 5 mm and check the offset volume intersects nothing.',
      ),
  },
  {
    id: 'T2.7.2',
    regRef: 'REG-T2.7',
    name: 'Body Minimum Thickness',
    category: 'Body',
    classification: 'SAFETY',
    description: 'The main car body must be at least 3.5 mm thick at every point.',
    limit: { min: 3.5, unit: 'mm' },
    penalty: 'Per T2.5 penalty schedule',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T2.7.2',
        'Guaranteed minimum wall thickness needs an exact medial-axis / SDF analysis of the solid body — tessellated meshes cannot prove a 3.5 mm floor everywhere to scrutineering tolerance.',
        'Run your CAD package’s wall-thickness analysis on the body solid with a 3.5 mm threshold.',
      ),
  },
  {
    id: 'T3.1.4',
    regRef: 'REG-T3.1.4',
    name: 'Identical Components (Car A / Car B)',
    category: 'General',
    classification: 'GENERAL',
    description: 'Both race cars must be built from identically designed components.',
    penalty: '5 pts each',
    requires: 'physical',
    evaluate: () =>
      manual(
        'T3.1.4',
        'This compares two physical cars — analyse each car separately here and confirm both were manufactured from the same CAD data.',
      ),
  },
]

// ───────────────────────── shared wing measurement logic ─────────────────────────

function pickWing(a: VehicleAnalysis, end: 'front' | 'rear') {
  const pool = end === 'front' ? frontAssemblyComponents(a) : rearAssemblyComponents(a)
  const wings = pool.filter(wingLike)
  wings.sort((x, y) => y.bbox.max.z - y.bbox.min.z - (x.bbox.max.z - x.bbox.min.z))
  return wings[0] ?? null
}

function wingManual(ruleId: string, end: 'front' | 'rear'): RuleResult {
  return manual(
    ruleId,
    `No separable ${end} wing component could be identified ${end === 'front' ? 'forward of reference plane A' : 'rearward of reference plane B'}. Wings merged into the body cannot be measured independently.`,
    'Export the wing as a separate body in the assembly, or verify span/chord/thickness in CAD.',
  )
}

function wingSpanRule(a: VehicleAnalysis, ruleId: string, end: 'front' | 'rear'): RuleResult {
  const gate = requireWheels(a, ruleId)
  if (gate) return gate
  const wing = pickWing(a, end)
  if (!wing) return wingManual(ruleId, end)
  const span = wing.bbox.max.z - wing.bbox.min.z
  const limit = { min: 50, unit: 'mm' as const }
  const { status, margin } = judge(span, limit)
  const y = wing.center.y
  return {
    ruleId,
    status,
    measured: span,
    measuredLabel: `${fmt(span)} mm`,
    explanation:
      status === 'fail'
        ? `The ${end} wing spans ${fmt(span)} mm — ${fmt(margin)} mm under the 50 mm minimum. (Span measured as the lateral extent of the wing component.)`
        : `The ${end} wing spans ${fmt(span)} mm against the 50 mm minimum.`,
    remedy: status === 'fail' ? `Widen the ${end} wing to at least 50 mm of continuous span.` : undefined,
    confidence: 0.75,
    penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 2) : 0,
    visuals: [
      componentsVisual([wing.id]),
      {
        kind: 'dimension',
        a: [wing.center.x, y, wing.bbox.min.z],
        b: [wing.center.x, y, wing.bbox.max.z],
        label: `${fmt(span)} mm`,
        offset: [0, 16, 0],
      },
    ],
    camera: cameraFor([wing.center.x, wing.center.y, 0], 150, [end === 'front' ? 0.9 : -0.9, 0.5, 0.7]),
  }
}

function wingChordRule(a: VehicleAnalysis, ruleId: string, end: 'front' | 'rear'): RuleResult {
  const gate = requireWheels(a, ruleId)
  if (gate) return gate
  const wing = pickWing(a, end)
  if (!wing) return wingManual(ruleId, end)
  const chord = wing.bbox.max.x - wing.bbox.min.x
  const limit = { min: 15, max: 25, unit: 'mm' as const }
  const { status, margin } = judge(chord, limit)
  return {
    ruleId,
    status,
    measured: chord,
    measuredLabel: `${fmt(chord)} mm`,
    explanation:
      status === 'fail'
        ? `The ${end} wing chord measures ${fmt(chord)} mm — outside ${limitText(limit)} by ${fmt(margin)} mm. (Chord approximated as the longitudinal extent of the wing component; an angled aerofoil may measure slightly differently.)`
        : `The ${end} wing chord is ${fmt(chord)} mm, inside ${limitText(limit)}. (Approximated from the wing component's longitudinal extent.)`,
    remedy:
      status === 'fail'
        ? chord > 25
          ? `Reduce the ${end} wing chord below 25 mm.`
          : `Deepen the ${end} wing chord to at least 15 mm.`
        : undefined,
    confidence: 0.7,
    penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 1) : 0,
    visuals: [
      componentsVisual([wing.id]),
      {
        kind: 'dimension',
        a: [wing.bbox.min.x, wing.center.y, wing.bbox.max.z + 6],
        b: [wing.bbox.max.x, wing.center.y, wing.bbox.max.z + 6],
        label: `${fmt(chord)} mm`,
        offset: [0, 10, 6],
      },
    ],
    camera: cameraFor([wing.center.x, wing.center.y, wing.bbox.max.z], 110, [0.4, 0.55, 1]),
  }
}

function wingThicknessRule(a: VehicleAnalysis, ruleId: string, end: 'front' | 'rear'): RuleResult {
  const gate = requireWheels(a, ruleId)
  if (gate) return gate
  const wing = pickWing(a, end)
  if (!wing) return wingManual(ruleId, end)
  const thickness = wing.bbox.max.y - wing.bbox.min.y
  const limit = { min: 2, max: 6, unit: 'mm' as const }
  const { status, margin } = judge(thickness, limit)
  return {
    ruleId,
    status,
    measured: thickness,
    measuredLabel: `${fmt(thickness)} mm`,
    explanation:
      status === 'fail'
        ? `The ${end} wing is ${fmt(thickness)} mm thick — outside ${limitText(limit)} by ${fmt(margin)} mm. (Thickness approximated as the vertical extent of the wing component; a cambered aerofoil may measure differently normal to its surface.)`
        : `The ${end} wing thickness is ${fmt(thickness)} mm, inside ${limitText(limit)}. (Approximated from the wing component's vertical extent.)`,
    remedy:
      status === 'fail'
        ? thickness > 6
          ? `Thin the ${end} wing below 6 mm.`
          : `Thicken the ${end} wing to at least 2 mm for rigidity and legality.`
        : undefined,
    confidence: 0.7,
    penaltyPoints: status === 'fail' ? proportionalPenalty(margin, 1) : 0,
    visuals: [
      componentsVisual([wing.id]),
      {
        kind: 'dimension',
        a: [wing.center.x, wing.bbox.min.y, wing.bbox.max.z + 6],
        b: [wing.center.x, wing.bbox.max.y, wing.bbox.max.z + 6],
        label: `${fmt(thickness)} mm`,
        offset: [0, 0, 10],
      },
    ],
    camera: cameraFor([wing.center.x, wing.center.y, wing.bbox.max.z], 90, [0.3, 0.35, 1]),
  }
}

function contactWidthRule(a: VehicleAnalysis, ruleId: string, front: boolean, min: number): RuleResult {
  const gate = requireWheels(a, ruleId)
  if (gate) return gate
  const axle = front ? a.frontAxle! : a.rearAxle!
  const limit = { min, unit: 'mm' as const }
  let points = 0
  const failing: number[] = []
  let worst = axle.wheels[0]
  let worstJudge = judge(worst.contactWidth, limit)
  for (const w of axle.wheels) {
    const j = judge(w.contactWidth, limit)
    if (j.status === 'fail') {
      failing.push(w.componentId)
      points += proportionalPenalty(j.margin, 2.5)
    }
    if (j.margin < worstJudge.margin) {
      worst = w
      worstJudge = j
    }
  }
  const widths = axle.wheels.map((w) => fmt(w.contactWidth)).join(' / ')
  return {
    ruleId,
    status: worstJudge.status,
    measured: worst.contactWidth,
    measuredLabel: `${widths} mm`,
    explanation:
      worstJudge.status === 'fail'
        ? `${front ? 'Front' : 'Rear'} wheel contact widths are ${widths} mm — the minimum is ${fmt(min)} mm. (Measured as the wheel's lateral extent; fillets and chamfers at the edges reduce the true contact width further.)`
        : `${front ? 'Front' : 'Rear'} wheel contact widths (${widths} mm) meet the ${fmt(min)} mm minimum. Note: chamfers or fillets on the rolling edge reduce the countable width — confirm the flat contact band.`,
    remedy: worstJudge.status === 'fail' ? `Widen the ${front ? 'front' : 'rear'} wheels' flat rolling band to ≥ ${fmt(min)} mm.` : undefined,
    confidence: 0.75,
    penaltyPoints: points,
    visuals: [componentsVisual((failing.length ? failing : axle.wheels.map((w) => w.componentId)))],
    camera: cameraFor([axle.x, worst.center.y, worst.center.z], 100, [front ? 0.7 : -0.7, 0.5, worst.center.z >= 0 ? 1 : -1]),
  }
}
