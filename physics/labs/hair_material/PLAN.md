# Hair material lab plan

This is a living checklist, not a fixed simulation specification. Prefer one
small measurable improvement at a time; revise the next step when an experiment
teaches us something important.

## Now: make the comb a useful instrument

- [x] Deterministic 256-guide dry/wet comb pass with stable digests.
- [x] Explicit `comb_settling` and `comb_pass` measurement windows.
- [x] Reaction/work proxies, clump history, stretch gate, and assumption receipt.
- [x] Give wet hair deliberate stretch margin (target at most 4%, with runtime cost reported).
- [x] Record a bounded force-proxy versus comb-displacement trace.
- [x] Show that trace in the browser and export it in the replay receipt.
- [x] Add one loading/unloading or repeated-pass experiment for hysteresis.

Evidence gate: `just lint`, `just test`, deterministic replay, browser check,
and a warm HOL Workbench replay of any new scalar contract. Proxy units and
proof boundaries must remain explicit.

## Next: improve material behavior where the traces point

- [x] Add a continuously rotating directional wind field with a visible flow indicator and autoplay showcase.
- [x] Compare dry, wet, and product-heavy response using peaks, work, releases,
      trace shape, and runtime—not appearance alone.
- [x] Choose one operator to improve from evidence: friction, cohesion, pressure,
      comb contact, or length enforcement.
- [x] Instrument persistent contact/cohesion first: the product-heavy lane creates
      7.5x the final bonds and 3.2x the releases of dry hair while shifting 56%
      of reaction into the final travel third. Contact-age/service telemetry
      now checks the bounded exhaustive scheduler at runtime.
- [x] A/B deterministic multi-cell spatial discovery against the fixed graph
      without changing forces. It finds 35k–48k padded-AABB candidates and
      honestly saturates the provisional 20k budget in every material lane.
- [x] Rank and cap spatial candidates while keeping active persistent bonds hot.
      All persistent bonds survive and the global frontier is ordered, but the
      per-segment quota still drops AABB-overlap risk-zero pairs.
- [x] Replace AABB-gap ties with deterministic segment–segment closest-distance
      risk. The AABB ranker dropped 6/5/40 risk-zero pairs in dry/wet/product;
      closest-distance ranking drops zero while retaining every persistent bond.
- [x] Measure admitted spatial-pair churn across repeated frames and a bounded
      comb/cut transition. Adjacent-frame minimum Jaccard is 0.933/0.948/0.968
      for dry/wet/product and 0.959 through the product-heavy cut fixture;
      rerun digests and discovery-only gates all pass.
- [x] Run a controlled k=1 spatial-friction A/B inside the admitted frontier.
      The feature is off by default, excludes fixed-graph guide pairs, and
      applies no spatial pressure or cohesion. Retaining still-valid contacts
      before filling unmatched segments raises minimum active Jaccard to
      0.903/0.940/0.981 for dry/wet/product while every deterministic comb and
      stretch gate passes. The cut fixture remains a separately reported
      baseline stretch failure and is not relabeled as a pass.
- [x] Add a deterministic section lift only after the hands-off groom exposed
      convincing but transient full silhouettes. The opt-in 0.24 m pulse rises,
      holds, and releases entirely inside the measured comb cycle. Distributing
      0.18 step stiffness across six iterations cuts held-state correction
      distance from 5.088 to 2.529 solver-position units. The 256-guide replay
      repeats at digest `4c7b4af505e0e011`, completes all 256 cuts, and peaks at
      3.499% stretch. Active-phase browser cost is still higher, so this remains
      an opt-in showcase rather than a default material operator.
- [x] Add the first artist-directed section pose: one deterministic eighth-scalp
      group drives a weighted three-point mid-shaft tube with lift plus signed
      tangential sweep, while the rest of the guides and dense three-parent
      fibers remain simulation-driven. A narrow browser A/B corrected the
      authored recipe from a face-crossing front lock to an outward side volume
      (section 7, +0.34 m sweep). The 256-guide comb/cut replay selects 35
      guides, repeats at digest `e72b5a6c17a20c57`, completes all 256 cuts, and
      peaks at 3.4982% stretch; the disabled baseline stays
      `6a0294d4bf085310`. This is a Tonic-like control primitive, not production
      groom or Disney parity.
- [x] Present the section pose as an explicitly non-physical authoring volume
      that hydrates into rendered hair. A deterministic five-phase envelope
      starts with thin cyan proxy fibers and a translucent 10-sided mean-guide
      tube, restores full fiber color/width, then dissolves the tube before
      ordinary simulation. At fixed step 90, enabled and hair-only modes share
      physics digest `1b50f30cdfdff721`; the 256-guide × 15-fiber narrow gate
      observes 0.10 ms tube-geometry p99. The render receipt marks the tube as
      `none_renderer_only`, so it is an artist-facing explanation rather than
      a mechanics claim.
- [x] Replace the dense renderer's flat color with an artist-facing directional
      fiber material and restore a genuinely looping preview. The compact
      strand shader separates a neutral root-shifted reflection lobe, a
      hair-tinted tip-shifted transmission lobe, tangent diffuse, and a bounded
      multiple-scattering fill; deterministic root-to-tip color variation keeps
      it out of the uniform ribbon look. Flat and fiber modes share fixed-step
      physics digest `1b50f30cdfdff721`, position-buffer digest `8019ba02`,
      and the 120 fps browser ceiling in the isolated 560×720 gate. The
      showcase now fades, resets the same deterministic fixture at step 450,
      and repeats; fixed frames remain validation receipts rather than the
      product experience.
- [x] Give the looping groom a reel-ready visual plate and repeatable framing.
      A tracked CC0 Blender Studio head replaces the primitive mannequin on
      demand while the analytic ellipsoid remains the sole collision proxy.
      Named `beauty`, `control`, and `cut` camera fields follow the same
      450-step loop, so a capture can be reconstructed from query parameters
      rather than hand-orbiting the viewport. Three `just hair-reel-*` recipes
      preserve the uninterrupted animation as the product experience.
- [x] Build a small explicit-guide rod/reference fixture before raising guide
      count or enabling spatial friction in the browser by default. The
      settled axial/transverse lanes reproduce exactly, remain under 1.9%
      stretch, and expose the calibration boundary without claiming a
      continuous-rod validation.

Decision: the next gain should be visible. Reuse the small guide fixture as a
debug card while making spatial friction opt-in in the browser or improving
strand rendering; do not add another many-hair operator first.

- [x] Expose k=1 spatial friction through an explicit browser query parameter
      with live contact/churn/impulse telemetry and a hands-off autoplay URL.
      Default remains off; the 256-guide preview's roughly 86 ms solver cost is
      a visible performance blocker, not a hidden success.
- [x] Remove split-heavy deterministic discovery bookkeeping. The exact
      64-step digest stream and four full treatment receipts are unchanged;
      refresh mean falls 53% and the observed maximum falls 65%. Discovery
      remains the dominant roughly 30 ms phase, so default enablement is still
      not implied.

## Later: prettier and more ambitious hair

- [x] Add an opt-in dense appearance layer that preserves measured guide motion:
      GPU-expanded tapered fat lines plus a crown undercoat. At 256 guides × 9
      fibers, the fixed-step physics digest matches the default line renderer;
      geometry update is 0.46 ms mean / 0.80 ms p99 and max in the narrow browser
      lane. The 15-fiber showcase remains an appearance experiment, not a new
      mechanics claim.
- [x] Replace fixed radial fiber offsets with an opt-in rest-baked, section-local
      two-parent groom interpolation. Bindings are immutable during a run,
      receipt-digested, and use the shorter parent after cuts.
      In the 560x720 browser gate at 256 guides x 15 fibers, the fixed-step
      physics digest matches the radial baseline, binding digest `74bfb34c`
      remains stable, and geometry update is 0.60 ms mean / 1.20 ms p99 /
      1.90 ms max over 538 measured frames.
- [x] Add opt-in convex three-parent volume filling after the two-parent sheets
      remained visible in the styled showcase. The second neighbor fades in
      only from 45% to 90% of strand length so roots keep the authored part.
      At fixed steps 150 and 330, two- and three-parent modes have identical
      physics digests (`3c45d9ec1cd8d04b` and `18079d1e106a2407`) and distinct
      render-buffer digests. The three-parent binding digest is `0be410f0` and
      geometry remains about 0.9 ms p99 before the cut. It fills the pre-cut
      silhouette, but the shortest-of-three cut rule removes 0.72% more draw
      primitives and leaves a rougher post-cut fringe, so it remains opt-in.
- [x] Make the third parent a volume-only donor after the shortest-of-three rule
      exposed that fringe regression. Owner plus primary now define display
      length, while secondary influence fades to zero over two segments before
      its own cut. The fixed step-330 gate recovers all 193 lost primitives
      (26,884, equal to two-parent) with unchanged physics digest
      `18079d1e106a2407` and binding digest `0be410f0`; the step-150 render buffer
      remains byte-identical. A 600-frame live sample observes 0.60 ms geometry
      p99 and 0.70 ms max.
- [x] Cutting plus combing in one deterministic scenario. The 330-step styled
      root-field replay combines a two-pass comb, rotating wind, and diagonal
      cut; its repeated digest is `e63a053332f3b265` and it stays inside the
      3.5% stretch gate.
- [x] Add an opt-in two-segment scalp-normal root director with receipt-backed
      alignment and stretch A/B gates; promote it only if the silhouette gain
      outweighs solver cost and does not create a rigid helmet. At 256 guides,
      min/mean root-normal alignment improves from -0.104/0.022 to 0.691/0.867,
      the fixed replay repeats exactly, and the full cut/comb showcase remains
      under 3.1% stretch. Strength 0.22 remains opt-in because it approaches a
      smooth crown cap. The scalar alignment contract is observed through the
      refreshed OrbStack/CRIU `light` shelf as warm development evidence.
- [x] Add an eight-section styled scalp root field with a side part, lateral
      sweep, and crown lift while retaining positive outward target growth.
      Free and scalp-normal modes remain available. In the 256-guide A/B, the
      styled target has 0.820 mean tangential magnitude and 0.462 minimum
      outward dot versus 0.260 tangential magnitude for scalp-normal. The
      finished 560x720 fat-line showcase reads as a swept part instead of the
      scalp-normal cap, holds 3.03% stretch, and observes 0.50 ms geometry p99.
- [ ] Better scalp/strand contact and a clearer calibration path.
- [x] Define three receipt-distinct reel shots before packaging video variants.
- [ ] Package short 16:9 and vertical reels from those named moving shots.

Generated frames, videos, and benchmark JSON stay untracked and are pruned
eagerly. Durable code, small receipts, proof sources, and conclusions stay here.
