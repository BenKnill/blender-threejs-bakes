# Documentation Map

Use this index to enter the repository through the owner that matches the work.
The newest experiment receipt is not automatically the current product
contract, and sibling physics labs should not be treated as one solver.

## Current Product

- [Interactive Hair Material Bench](HAIR_MATERIAL_BENCH.md) — current browser
  experience, mechanics, curated scenes, measured receipts, and claim boundary.
- [Haircut simulator direction](HAIRCUT_SIMULATOR_DIRECTION.md) — longer-term
  product and physics direction; not a statement that every milestone exists.
- [Mannequin haircut](MANNEQUIN_HAIRCUT.md) — the rendered precursor and its
  deliberately primitive cut model.

The public app is the Hair Material Bench. It remains a reduced-order research
and authoring workbench, not calibrated hair prediction or a finished
professional haircut-construction simulator.

## Hair Research Record

- [Box3D hair swatch](HAIR_BOX3D_SWATCH.md) — reduced native guide-chain
  experiment and its limits.
- [Deterministic operator replay](HAIR_OPERATOR_AB_REPLAY.md) — fixed replay
  comparison and Workbench notes.
- [Phase-space videos](HAIR_PHASE_SPACE_VIDEOS.md) — anisotropic material
  scenario set and evidence boundary.
- [Hero cut videos](HAIR_HERO_CUT_VIDEOS.md) — moving haircut film
  choreography.
- [External hair-lab review](HAIR_EXTERNAL_REVIEW_20260711.md) — archived
  critique and decisions, not runtime authority.

Tracked measurements and negative-result records live under
[`docs/receipts/`](receipts/). Preserve their identity and non-claims when
refactoring current code; do not rewrite old evidence merely to match the
latest presentation.

## Supported Foundations

- [Layout and bake design](../DESIGN.md) — GLB proxy, layout contract, and
  Blender bake foundation.
- [Integration handoff](INTEGRATION_HANDOFF.md) — stable
  scene/compiler/Box3D/motion-clip/Blender boundary.
- [Scene state contract](SCENE_STATE.md) — authored scene quantities and
  entity model.
- [Box3D animation proof](BOX3D_ANIMATION.md) — generic recorded-motion path
  and deliberate limits.
- [Box3D native conventions](BOX3D_NATIVE_CONVENTIONS.md) — units,
  initialization, and replay conventions.
- [Bake telemetry](BAKE_TELEMETRY.md) — process-tree cost and artifact
  receipt wrapper.

These are supported integration surfaces. Specialized tree and hair compilers
may build on them without widening the generic compiler contract.

## Separate Physics Studies

- [Contact-shell oracle](BOX3D_CONTACT_SHELL.md)
- [Globally aware tether-chain lab](JGS2_COMPLIANCE_LAB.md)
- [Reduced-coordinate tree](REDUCED_TREE_ELASTODYNAMICS.md)
- [SeedThree tree assembly](SEEDTHREE_TREE_ASSEMBLY.md)
- [SeedThree wind canopy](SEEDTHREE_WIND_CANOPY.md)
- [Realtime soft ribbon](SOFT_RIBBON.md)
- [Native wind garden](WIND_GARDEN.md)

These lanes intentionally retain separate equations, integrators, proofs,
receipts, and claim boundaries. Consolidate shared infrastructure only when it
does not blur those distinctions.

## Repository-Wide Guides

- [README](../README.md) — product map and runnable quickstarts.
- [Agent operating guide](../AGENTS.md) — stable commands and automation
  contracts.
- [Conventions](../CONVENTIONS.md) — cross-cutting architecture and review
  rules.
