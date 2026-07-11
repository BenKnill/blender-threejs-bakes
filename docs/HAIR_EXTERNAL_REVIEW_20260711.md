# Hair lab external review: Fable and Grok

Issue: [#92](https://github.com/BenKnill/blender-threejs-bakes/issues/92)

On 2026-07-11, Claude Code using the `fable` model and two independent
`grok-cli` prompts reviewed the current hair material bench, hero-film receipt,
and proposed many-hair operators. Fable could read the repository documents but
not the separately attached proposal; both Grok passes read the proposal. Their
agreement is more useful than any individual ranking.

## Decisions

1. Do not describe the current lab as an 80,000-hair mechanical model. It uses
   512--768 mechanical guides and render-side interpolated fibers. Increasing
   visible density and increasing mechanical density are different projects.
2. Make the next comparison falsifying: same scenario and seed, anisotropic
   operators on versus off. If the disabled side does not visibly look wrong,
   the film has not justified the operators.
3. Make capture fixed-step and replayable. A compact solver-state digest should
   be stable even when browser pixels are not. Regenerable films can be deleted
   without turning local media into an archive.
4. Build a comb-through probe before attempting a giant groom. A comb directly
   exercises axial slip, transverse drag, cohesion hysteresis, pore pressure,
   and contact release. It also creates a route to published wet/dry tress
   force measurements.
5. When fixed root-neighbor contacts become the limiting fiction, replace them
   incrementally with a spatial hash plus a small persistent contact set. Reuse
   the existing equal-and-opposite pair operators. Add cell anisotropic drag
   and transverse pressure next; defer round-robin scheduling and contact debt
   until density makes their budget necessary.

## Why the current contact graph will fail

The existing graph couples fixed root neighbors at matching particle indices.
It cannot discover mid-length crossings, non-neighbor collisions, or new
neighbors after a cut. It can also bind under-over layers that are close in root
space but separated in the groom. These are concrete failure modes for a comb
film, not reasons for an immediate solver rewrite.

## Workbench targets

The useful next HOL Light Workbench claims are coefficient-bearing system
properties rather than choreography facts:

- momentum conservation across the composed pair-operator pass;
- non-expansion of stretch residual under a bounded projection sweep;
- hysteresis excludes one-step capture/release chatter;
- cohesion plus pressure cannot cross a declared minimum pore gap;
- the sparse persistent contact set stays within its configured budget.

Warm profile results remain development feedback. Any published theorem claim
still requires the workbench cold-audit path, and none of these statements
would prove the JavaScript renderer or its pixel trajectory.

## Artifact rule

Keep manifests, compact telemetry, tests, proof sources, and one comparison
film. Retain at most one representative individual clip per experimental shelf.
Delete captured frames after successful encoding unless debugging explicitly
requires them. A shelf without a live document or issue is disposable. The
packager enforces the frame/clip rule and prints retained bytes and file count.
