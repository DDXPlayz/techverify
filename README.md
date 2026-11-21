# Tech Verify

Drop a CAD export of a STEM Racing car into the browser and get every technical
regulation checked against your real geometry in a fraction of a second —
locally, with nothing uploaded anywhere.

Part of the Anantam Engineering Platform, alongside
[AeroVision](https://github.com/DDXPlayz/aerovision) (aerodynamic assessment)
and [EvalScore](https://github.com/DDXPlayz/evalscore) (portfolio scoring).

**[Live → tools.anantamracing.com/techverify](https://tools.anantamracing.com/techverify)**

---

## What this is, and what it is not

**This is a deterministic geometry checker.** 38 rules from the STEM Racing
India 2026 technical regulations, each a pure function over a measured geometry
database. The same model always produces the same numbers. No model, no
heuristics, no server.

**It is not scrutineering, and it does not pretend to be.** A regulation about
mass, an internal cavity diameter, or whether two cars use identical components
is not answerable from a mesh. Those come back as *manual verification
required*, with the reason and a procedure to check them in CAD — never as a
guess with a plausible number attached.

That distinction is the whole design, and it is measurable. Run the built-in
sample car and **13 of the 38 checks decline to answer**:

```
96 COMPLIANCE     22 PASS    3 WARNING    0 FAIL    13 MANUAL
217.0 × 66.0 × 61.0 mm · 1,928 triangles · 18 components
unit mm (×1) · symmetry 98% · 24 open edges · analysed in 0.07 s
```

A tool optimising for a good-looking report would have found something to say
about all 38.

---

## Why it exists

A team finds out its car is illegal at scrutineering, after the CAD is frozen
and the part is printed. Every rule in the book is a number you could have
measured weeks earlier, and most teams measure them by hand in CAD, once,
hoping they did it right.

This measures all of them, in order, every time the model changes, in less time
than it takes to open the file.

---

## What the checks look like

| Rule | Result | Why it reads this way |
|---|---|---|
| **T3.5** Total Height | **PASS** · 61.0 mm, limit ≤ 65.0 | measured from the bounding geometry after normalisation |
| **T7.5** Wheel Diameter | **PASS** · 30.0 / 30.0 / 30.0 / 30.0 mm, limit 28.0–32.0 | each wheel measured separately and reported separately |
| **T7.2.1** Front Wheel Inner Distance | **WARNING** · 38.0 mm, limit ≥ 38.0 | exactly on the boundary — legal, and not something to discover at the track |
| **T3.6** Total Weight | **MANUAL** · limit ≥ 50.0 g | **a mesh has no mass.** Reported as unanswerable rather than estimated from volume × an assumed density |
| **T5.1** Cartridge Chamber Diameter | **MANUAL** · limit 18.0–18.5 mm | an internal cavity, not reliably recoverable from an exported surface |
| **T4.4.1** Halo Inclusion | **MANUAL** | requires knowing what a part *is*, not what shape it is |

Every automated result carries the measured value, the limit, the penalty
points, a confidence level and a 3D visual anchored to the exact geometry it
came from.

---

## How it works

```
Upload (GLB / GLTF / OBJ / STL)
   ↓  validate
normalize ──  infer units · map axes · find the nose ·
   ↓          use the wheels to define the ground, then flip "up"
weld & segment into connected components
   ↓
measure  ──  volume · surface area · edge topology · symmetry · open edges
   ↓
recognise the vehicle ── wheels, axles, reference planes A and B
   ↓
run all 38 rules (pure functions over the geometry database)
   ↓
report + 3D overlays
```

**Normalisation before anything else.** Exporters disagree about units and axes,
and a car can arrive upside down. The pipeline infers the unit scale, maps the
axes, finds the nose, and then uses the wheels to decide which way is down —
because the wheels touch the ground by definition, and that is more reliable
than trusting an export's up-vector. Every rule downstream can then assume a
canonical orientation.

**Two independent guards against inventing an answer.** A rule that cannot
measure what it needs returns `manual(...)` with a reason and a CAD procedure.
And in `runRules.ts`, a rule that *throws* on unexpected geometry is caught and
reported as manual verification too — so a crash degrades into an honest "check
this yourself" rather than a missing or wrong result.

---

## Architecture

```
src/
  regulations/        Rule pack — rules2026.ts (38 rules, 1,255 lines) + helpers
  engine/
    loaders/          File parsing & validation (GLB/GLTF/OBJ/STL)
    pipeline/         normalize (units, axes, nose, up-flip) → analyze (orchestrator)
    geometry/         Deterministic measurement (volume, area, welding,
                      connected components, edge topology, symmetry)
    vehicle/          Wheel/axle detection, reference-plane construction
    rules/            Rule runner + report scoring
    sample/           Procedural compliant sample car (also drives the hero)
  viewport/           SceneManager (camera flights), overlays (dimensions, planes,
                      highlights), CinematicScene (landing animation)
  components/         React UI (landing, scroll sections, upload, report)
  state/              Zustand store
  types/              Shared TypeScript contracts
```

30 TypeScript files. A rule is data plus a pure `evaluate(analysis)` function
that reads the geometry database and returns a result — no UI coupling, no
mutation. A 2027 pack is a new module in `src/regulations/`, not a change to the
engine.

---

## Getting started

```bash
git clone https://github.com/DDXPlayz/techverify.git
cd techverify
npm install
npm run dev
```

The dev server opens at `http://localhost:5173/techverify/` — note the path; see
below. Press **Analyse a sample car** to see a full report without supplying a
model of your own.

```bash
npm run build            # builds for /techverify/, the production path
VITE_BASE=/ npm run build   # builds for the root, e.g. to serve dist/ yourself
```

**On the base path.** Production is served from
`tools.anantamracing.com/techverify/`, so `vite.config.ts` defaults `base` to
`/techverify/`. A plain `npm run build` therefore produces a `dist/` whose
assets 404 if you serve it at `/`. Set `VITE_BASE=/` and it builds for the root.
The same applies to AeroVision and EvalScore.

No environment variables, no API keys, no server.

---

## Engineering decisions

**Never fabricate.** The decision the rest of the design follows from. Anything
geometry cannot prove is reported as unanswerable, with the reason and a way to
check it by hand. It makes the report shorter and less impressive, and it is the
only version of this tool that is worth trusting before scrutineering.

**Rules are data and pure functions.** They read a geometry database and return
a verdict. They cannot reach the UI, cannot mutate the analysis, and cannot
depend on each other's results.

**The wheels define the ground.** Deciding orientation from the geometry that
physically touches the track, rather than from an exporter's up-vector, is what
makes every clearance and height rule trustworthy on a file from any CAD
package.

**Everything local.** An unreleased car is the most sensitive file a team owns.
It is parsed in the browser and never sent anywhere — the same reasoning as
AeroVision.

**Deterministic.** No sampling, no randomness, no model. Re-running the same
file gives the same numbers, which is what makes "it passed yesterday" a
meaningful statement.

---

## Status & verification

**Status:** live and complete. No automated tests.

| Claim | How it was checked |
|---|---|
| Live at `tools.anantamracing.com/techverify` | HTTP 200, checked 2026-11-21 |
| Builds from a bare clone | `npm install && npm run build` (which runs `tsc -b` first) — **run, passes**, 165 ms |
| Builds and runs at the root with `VITE_BASE=/` | **run in a browser** — landing, upload step and full report all work |
| 38 rules in the 2026 pack | counted in `src/regulations/rules2026.ts` |
| The report is real | **run** — sample car returned 96 compliance, 22 pass / 3 warning / 0 fail / 13 manual in 0.07 s, with measured values and limits on every automated rule |
| Unanswerable rules decline | **run** — weight, cartridge chamber, halo, tether guides and 9 others returned *manual check* with a stated reason |
| A boundary case is not rounded into a pass | **run** — T7.2.1 measured 38.0 mm against a limit of ≥ 38.0 mm and reported **warning** |
| A thrown rule degrades to manual | verified by reading `runRules.ts:25` — the catch sets `status: 'manual'` with the error text |
| No secrets in the repository or its history | swept every commit — no keys, no `.env` |

**Not verified:**

- **The measurements have not been checked against a physical car** or against
  official scrutineering. The geometry is computed correctly in the sense that
  it is deterministic and self-consistent; whether a given rule's interpretation
  matches a scrutineer's is a separate question, and this tool is not an
  authority.
- Only the procedural sample (STL) was exercised in this pass. GLB, GLTF and OBJ
  loaders are present and wired but were not each driven with a file.
- Behaviour on large or badly-formed meshes. The sample is 1,928 triangles; a
  real export is orders of magnitude larger.
- The 2026 rule pack is transcribed from the published regulations
  (`Regulation_STEMRacing26.txt` is in the repository); the transcription itself
  has not been independently reviewed.

---

## Credits

Written by **Dhruva Goyal**. Team Anantam — Dhruva, Adrian, Kabir, Yuvraaj,
Riddhi and Sanvi — did the engineering work it was built to serve.

three.js is BSD-3-Clause. React, Zustand, Vite and Framer Motion are their
authors'. The STEM Racing technical regulations belong to STEM Racing.

Built and deployed as part of an npm-workspaces monorepo in
`anantamracingsite/tools`, which remains the canonical source and serves the
live site.

---

## Licence

[MIT](LICENSE).
