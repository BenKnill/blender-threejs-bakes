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
- [ ] Prototype a fair sparse discovery schedule while keeping active bonds hot:
      all lanes currently service 763,950 candidates per measured pass, while
      mean final bond age ranges from 84 dry to 174 product-heavy steps.
- [ ] Add a repeated pass, section lift, or simple grab only when it answers a
      concrete material question.
- [ ] Keep a small explicit-guide reference scene before raising guide count.

Decision point: after two useful instruments, decide whether the best next gain
is a better solver operator, a prettier haircut interaction, or a low-count rod
reference comparison.

## Later: prettier and more ambitious hair

- [ ] Groom interpolation and rendering that preserve the measured guide motion.
- [ ] Cutting plus combing in one deterministic scenario.
- [ ] Better scalp/strand contact and a clearer calibration path.
- [ ] Video variants only after the underlying receipt distinguishes them.

Generated frames, videos, and benchmark JSON stay untracked and are pruned
eagerly. Durable code, small receipts, proof sources, and conclusions stay here.
