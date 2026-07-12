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
- [ ] Add a repeated pass, section lift, or simple grab only when it answers a
      concrete material question.
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
      receipt-digested, and use the shorter parent after cuts; three-parent
      volume filling remains a visual follow-up if pairwise sheets dominate.
      In the 560x720 browser gate at 256 guides x 15 fibers, the fixed-step
      physics digest matches the radial baseline, binding digest `74bfb34c`
      remains stable, and geometry update is 0.60 ms mean / 1.20 ms p99 /
      1.90 ms max over 538 measured frames.
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
- [ ] Video variants only after the underlying receipt distinguishes them.

Generated frames, videos, and benchmark JSON stay untracked and are pruned
eagerly. Durable code, small receipts, proof sources, and conclusions stay here.
