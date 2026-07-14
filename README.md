# Tech Verify

Tech Verify — part of the Anantam Engineering Platform. Browser-based STEM Racing regulation verification. Upload a CAD export (GLB / GLTF / OBJ / STL) and get a full compliance report against the STEM Racing India technical regulations in milliseconds — entirely locally, no server, no uploads.

## Run

```bash
npm install
npm run dev
```

## Architecture

```
src/
  regulations/        Rule pack (data-driven, one module per regulation) + shared helpers
  engine/
    loaders/          File parsing & validation (GLB/GLTF/OBJ/STL)
    pipeline/         normalize (units, axes, nose, up-flip) → analyze (orchestrator)
    geometry/         Deterministic measurement utilities (volume, area, welding,
                      connected components, edge topology, symmetry)
    vehicle/          Wheel/axle detection, reference-plane construction
    rules/            Rule runner + report scoring
    sample/           Procedural compliant sample car (also drives the hero)
  viewport/           SceneManager (camera flights), overlays (dimensions, planes,
                      highlights), HeroScene (landing animation)
  components/         React UI (landing, scroll sections, upload, report)
  state/              Zustand store
  types/              Shared TypeScript contracts
```

### Pipeline

Upload → validate → normalize (unit detection, axis mapping, nose direction,
wheels-define-the-ground up-flip) → weld & segment into components → measure →
recognise vehicle structure (wheels, axles, reference planes A/B) → run every
rule → visualise.

### Principles

- **Deterministic** — the same model always produces the same numbers.
- **Never fabricate** — anything geometry cannot prove is reported as
  *Manual verification required*, with the reason and a CAD procedure.
- **Rules are data + pure functions** — they read the geometry database only;
  no UI coupling, no mutation. New rule packs (2027, custom) drop into
  `src/regulations/`.
- **Traceable** — every result carries the measured value, the limit, the
  penalty math, a confidence level, and a 3D visual anchored to the exact
  geometry.
