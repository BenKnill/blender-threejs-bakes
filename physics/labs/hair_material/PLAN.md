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
- [x] Replace the uniform polar root cap after browser screenshots exposed
      anchors on the forehead and an apparently bald crown. The
      `face_hairline_ellipsoid_v1` layout raises the central frontal boundary,
      retains side/rear coverage, and offsets anchors 45 mm outside the analytic
      head. The v2 styled field separates crown-back flow from frontal lateral
      flow; a bounded 64-guide face-volume projection clears mid-shafts from the
      cheeks. The 180-step A/B repeats at digest `bad7957fcc2e2976` and peaks at
      3.4993% stretch; the full section-pose/cut gate repeats at
      `b1e6b723267c19fc` and 3.4997%. An outward-wound, hairline-matched 62%
      undercoat fixes the renderer-side crown hole.
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
- [x] Remove the worst opaque-card artifact before encoding reels. Critical
      narrow and widescreen screenshots showed 15 child ribbons stacking at
      every shared guide root and every segment joint. The v2 renderer tapers
      one owner from the scalp, deterministically fades children over the first
      4-27% of length, narrows the 0.84 px root to a 0.07 px tip, softens fiber
      cross-sections and joint coverage, and replaces the helmet undercoat with
      a cropped 28%-opacity density fill. The reel recipes now use the existing
      21-fiber ceiling (5,376 fibers); fixed step 90 retains physics digest
      `1b50f30cdfdff721` and observes 2.8 ms geometry p99 in the narrow gate.
- [x] Make the physics-to-render hierarchy globally legible instead of tinting
      one section while finished hair remains everywhere else. The opt-in full
      groom presentation now begins with 256 section-colored mechanical guides,
      256 scalp-root points, and one translucent mean-section tube while dense
      hair and undercoat are absent; steps 45-149 hydrate all 5,376 fibers and
      release the cage. At step 90, enabled and hair-only modes share physics
      digest `1b50f30cdfdff721`; the cage costs 0.10 ms p99 versus 2.90 ms for
      dense geometry in one narrow observation. Physics, transition, and
      hydrated screenshots now read as three distinct representations.
- [x] Correct the diagnostic phase after screenshot review showed the 256-line
      cage plus volume tube still read as a bundle/hair hybrid. The current
      `uniform_rod_joint_hydration_450_v3` display deterministically samples 20
      solver guides and draws 240 cylinder links plus 260 sphere joints. All
      active rods share one 0.011 m radius and all active joints, including
      roots, share one 0.020 m radius; section identity remains color-only.
      Depth-resolved overlap removes transparent root blobs. Dense hair,
      undercoat, and the volume tube remain absent for a full 120 steps while
      the mannequin is ghosted; hydration begins only afterward. At fixed step
      60, enabled and hair-only modes share physics digest `b7a5a62747c250db`;
      one narrow sample measures 0.038 ms mean / 0.20 ms p99 skeleton update.
- [x] Scale the diagnostic hierarchy with the native Box3D scalp fixture. The
      `uniform_64guide_rod_joint_hydration_v4` playback exposes all 64 simulated
      guides as 512 uniform rods and 576 uniform joints before hydrating them
      into 5,376 section-interpolated fibers. The browser only interpolates the
      recorded 15 Hz node samples and renders them; native Box3D remains the
      physics authority.
- [x] Replace the one-dimensional browser hydration guess with a staged material
      audition. The native guide pose now holds still through rods, owner guides,
      clump locks, microfiber fill, five receipt-distinct thickness/population/
      shader recipes, and a selected-recipe settle. The completed groom then
      receives the full strong and moderate native wind orbits. A nine-frame
      Chrome Canary pass has no JavaScript exceptions and measures dense geometry
      at 8.71 ms mean / 9.50 ms p99 / 14.10 ms maximum over 600 frames.
- [x] Widen hydration from five bundled guesses into a Disney-reference hierarchy
      and independent parameter lab. The presentation now separates rods, groom
      volume, owners, clump children, microfibers, and flyaways before touring 12
      curated states from a 1,080-composition geometry × optics × pigment × detail
      space. The optical lane includes artist-dual and R/TT/TRT-inspired real-time
      proxies; curl/frizz/flyaway detail is rest-baked and display-only. An exact-
      time 20-frame Canary pass observes every state plus both native wind orbits
      with no JavaScript exceptions or console errors. Cached detail geometry
      measures 8.04 ms mean / 14.50 ms p99 / 20.40 ms maximum over 144 updates
      while the native trajectory digest remains `5aaf6c2db5806b28`.
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
      current v2 styled target has 0.812 mean tangential magnitude and 0.465
      minimum outward dot versus 0.258 tangential magnitude for scalp-normal.
      The 330-step cut/comb replay repeats at `810dcc040586fc06`, completes all
      256 cuts, and remains inside the 3.5% stretch gate.
- [x] Replace the coarse hydrated cap and readable ribbon ladders with
      lock-aware coverage. Cartesian child-root blends had put 5,120 of 5,376
      canonical roots just inside the analytic scalp; the renderer now projects
      every child root back to the shell, evaluates two Catmull-Rom spans per
      mechanical link, and sprouts one short three-span coverage lock per
      distributed root along the styled tangent field. The uncut 256 x 21
      fixture draws 145,152 spans without adding solver particles. Projection
      error is below `4.5e-16`, every coverage control point retains at least
      11.1 mm outward clearance, and the unchanged styled replay repeats at
      `810dcc040586fc06` with 3.4995% peak stretch.
- [x] Couple the hydrated scalp-coverage locks back to live wind motion after
      the canonical groom looked static while its physics rods moved. The
      solver guide tips already move 69.0 mm RMS over replay steps 270-285, but
      the baked-only coverage endpoints moved exactly zero. The v3 hydration
      field blends 86% live particle-7 tangent with 14% authored root flow; a
      0.34 authored-direction dot prevents root-flow reversal. The 5,376
      coverage endpoints move 4.61 mm RMS / 8.86 mm p95 / 34.68 mm max over
      the same interval without writing solver state.
- [x] Replace the ambiguous 450-step wind loop with a complete two-act preview.
      The hydrated groom now receives one 360-degree strong orbit at magnitude
      0.58, then one 360-degree moderate orbit at 0.29, before the fade/reset.
      HUD phase and revolution progress make the sequence explicit. The
      256-guide fixture repeats at digest `9c5a319aa70970b5`; post-settle live
      stretch peaks at 3.4998%, and settled quarter-orbit tip motion separates
      to roughly 55-79 mm RMS strong versus 26-29 mm RMS moderate.
- [x] Calibrate that two-act preview against the hydrated silhouette after the
      initial 0.58/0.29 labels moved counters but read frozen. Production was
      advancing at roughly 30 FPS with changing physics and render digests; the
      failure was force scale. The corrected 4.0/1.5 program produces roughly
      326-402 mm RMS settled strong quarter motion versus 132-150 mm moderate,
      stays under 3.5% post-settle live stretch, and reads directionally in the
      fixed-camera Canary frames.
- [x] Build a bounded native Box3D mechanics swatch before attempting a browser
      solver rewrite. Sixteen guides × eight capsule links use 128 spherical
      target-spring joints plus anisotropic quadratic drag. One strong and one
      moderate six-second wind orbit move the mean tips 1.662 m and 1.156 m,
      visit 23/24 and 24/24 azimuth bins, keep maximum joint separation to
      2.40 mm, and replay at digest `eb3ebea59ffbb5af`. The 128-body wind lane
      runs roughly 43× real time on the first accepted Apple Silicon release
      receipt. This proves responsiveness and leaves browser/WASM integration,
      calibration, hydration, and custom stiction explicitly open.
- [x] Add bounded hair-specific stiction to that native swatch without freezing
      its wind response. A deterministic three-step contact-ID memory drives a
      coupled 2D axial/transverse stick/slip impulse at Box3D manifold points.
      The accepted A/B observed 1,793 captures, 1,482 releases, 8,225 stick and
      33,664 slip services; mean predicted contact-plane speed fell 24.0% while
      strong/moderate tip displacement retained 99.99%/100.00% of baseline.
      The table peaked at 182/1,024 entries with no drops, evictions, invalid
      solves, or energy-injection violations; cost was 1.06× baseline. Five
      narrow HOL Light contracts replay warm, explicitly as development rather
      than cold final evidence. Browser integration and a stronger visible
      collective-motion calibration remain open.
- [x] Scale the native operator from the 16-guide swatch to accepted styled
      scalp fixtures at 64 and 256 guides. The 256-guide target contains 2,048
      dynamic capsules and 2,048 spherical joints; it repeats at digest
      `5aaf6c2db5806b28`, retains minimum settled root target/outward alignment
      of 0.929/0.231, stays under 11.31 mm settled joint separation, and visits
      22/24 then 24/24 wind azimuth bins. The canonical browser recipe plays
      its quantized 15 Hz nodes, exposes a uniform 64-guide rod subset, and
      hydrates to 5,376 fibers without claiming live Box3D/WASM execution.
- [ ] Better scalp/strand contact and a clearer calibration path.
- [x] Add deterministic eight-section elliptical groom envelopes so hydration
      can create genuinely broad hair masses instead of merely widening ribbon
      pixels. Salon, cinematic, and storybook profiles share exact roots, an
      asymmetric side-part field, a normalized radius-1 boundary, and a 0.5x to
      2.5x breadth control. The canonical cinematic 1.25x profile reaches about
      0.96 m outward / 0.74 m lateral maximum radius while remaining explicitly
      renderer-only. A front aperture clears hydrated midshafts from the face
      and reapplies the radius-1 bound. The fixed cyan crop gains 14.0% coverage
      for cinematic and 22.2% for storybook; calm/strong/moderate physics digests
      match the envelope-off pass. Caching unique hydrated points cut Canary
      geometry cost from the first 18.93 ms mean to 9.74 ms versus 8.64 ms off,
      with zero exceptions or console errors across 20 exact-time frames; all
      20 final PNG hashes repeat exactly in a second Canary run.
- [x] Separate silhouette breadth from optical occupancy with five layered mass
      profiles. The accepted cinematic 1.25x profile combines two textured,
      live section shells with family-specific widths and bounded screen-space
      width floors; front sections 5 and 6 receive neither shell opacity nor the
      added floor. The neutral off and deep passes keep the same final physics
      digest `fa11b33849011648` and hydrated position digest `b7113a24`; shell
      geometry adds 0.171 ms mean / 0.40 ms p99 and maximum in the narrow solo
      Canary pass. Two final runs repeat all 20 PNG hashes with no browser
      exceptions or console errors. This is denser, still visibly procedural
      hydration rather than a production hair claim.
- [x] Replace the canonical control wall with exactly three authored scenes and
      one Next button. Rig Becomes Hair owns the rod-to-hydration opening;
      Copper Gale enters at the strong orbit with wide copper volume; After the
      Rain enters at the moderate orbit with compact wet locks. Each short scene
      URL reloads its full composition, receipt identity, camera, and bounded
      loop start. `?lab=1` remains the explicit full-control surface. Canary
      checks cover all three entry phases, cyclic Next ordering, a 520x760
      narrow preview, and the strong/moderate loop-wrap boundaries.
- [x] Finish issue #187's compliant root and owner-transport hydration slice.
      The accepted fixtures use 12 shorter links and a five-stage
      stiffness/cone ramp. The 64- and 256-guide stiction digests repeat as
      `6419d6ab3a45d6dd` and `eb53b6e105f6e58d`; the 256-guide lane contains
      3,072 capsules and joints, stays within its 15.5 mm settled-gap bound,
      and retains positive outward alignment. Browser children follow owner
      displacement with an 18% donor-shape correction bounded to 55 mm, while
      two short root transitions per guide retain positive outward lift. A
      169-update Canary pass reports 31.36 ms mean / 65 ms p99 / 81 ms maximum
      hydrated geometry cost with zero exceptions or console errors. The result
      remains stylized and crown-spiky, with head collision still absent.
- [x] Replace guide-copy scalp placement with an explicit sparse groom cage and
      independent display follicles. Twenty authored hero locks define the rest
      silhouette, while 5,376 deterministic follicles occupy unique analytic
      scalp roots and inherit live deformation from three nearby mechanical
      guides. The accepted Round 6 baseline has layout digest `157af12f`,
      topology digest `a3c4cee6`, zero duplicate roots, 20.47/25.05/26.96 mm
      nearest-neighbor p10/p50/p90, and 0.068/0.748 minimum/mean first-chord
      outward alignment. Physics remains `b773984593f87d43`; the display layer
      has no solver authority.
- [x] Run a ten-round adversarial hydration game against matched Canary plates.
      Round 6's independent-root placement remains the selected baseline at
      21.75/35, up from 8.5/35 in Round 1. Correlated rest residuals (Round 7),
      separated occupancy cores (Round 8), a 1.65x mean core-weighted width
      field (Round 9), and an authored layered length field (Round 10) remain
      opt-in studies. They respectively exposed diagnostic-only hierarchy,
      rope-like gaps, slab-like width merging, and the limits of changing a
      synchronized hem without changing the larger lock silhouette. Round 10
      scored 22.5/35, keeps every strand above 70% retained length, and stays
      within +11.9% geometry p99, but is not promoted over Round 6.
- [x] Test overlapping fiber-populated lock surfaces without replacing the
      public baseline. The accepted opt-in E12 assigns each hero's 5,376 total
      display follicles to three spatially contiguous laminae at 40% rest
      length. All 60 hero/lamina supports are single intervals; Euclidean
      scalp-root nearest-16 same-lamina agreement is 0.375/0.8125/1.0
      p10/p50/p90. Adjacent surface
      supports overlap 28.9% at 40% length and 40.7% at 70%, with zero root-zone
      displacement, zero role-boundary gap, unchanged physics digest
      `b773984593f87d43`, and no per-frame neighbor search. It scored 24.5/35,
      +2.75 over Round 6 but below the +3 promotion gate: diagnostic geometry is
      coherent while calm beauty still reads too much like a dark curtain.
      Keep `lockSurface=laminae` opt-in and pursue a new optical representation
      rather than another geometry parameter correction.
- [x] Revert the E13 fiber-cut coverage-veil representation after two bounded
      localhost trials. A single ruled span preserved physics digest
      `b773984593f87d43`, E12 fatline position digest `0740e679`, one draw call,
      and a 1.0 ms surface-update p99, but missed its surface-fit gate by 3-6x
      and read as striped cards. The prescribed seven-rail correction raised
      the bound to 8,640 triangles but still produced 230 rail-order inversions,
      118/179 mm RMS p90 fit error at 40%/70%, 7.2 ms surface p99, 31 ms total
      geometry p99, and visible moire across the forehead and wind silhouette.
      The final adversarial score was 12.75/35. The failed source was pruned;
      receipts remain under the gitignored
      `attachments/20260719-lock-surface-round13/`. Do not fit another 2D sheet
      through this non-manifold root population.
- [x] Reject the E14 packet optical-depth representation before building its
      framebuffer path. The initial deterministic 447-packet partition assigned
      all 5,376 fibers once in 8/12/13/13 min/p50/p90/max groups and aggregated
      in 1.4 ms p99, but reached 99/202 mm and 152/336 mm p90/max radii at
      40%/70% length. A capacity-constrained 13-station curve-medoid correction
      improved curve-distance p90 from 123 mm to 72 mm while preserving physics
      digest `b773984593f87d43` and E12 position digest `0740e679`; it still
      reached 66/169 mm and 120/288 mm p90/max radii against the unchanged
      45/90 mm gate. No aesthetic score was assigned because no renderer was
      built. Prune packet membership and aggregate the actual fine fibers
      optically instead.
- [x] Revert the E15 direct-fiber additive optical-depth pass after its matched
      localhost plate. The half-resolution RGBA16F experiment consumed all
      64,512 actual E12 segments with no packet or temporal surrogate, retained
      physics digest `b773984593f87d43` and position digest `0740e679`, and
      added three draws. CPU endpoint preparation reached 0.5 ms p99; matched
      geometry mean rose only 3.3% from 13.980 to 14.437 ms. That performance
      success did not survive visual review: the blonde plate became an opaque
      orange-brown mass, calm hair read as airbrushed paint, and wind smeared a
      broad low-frequency sheet across the face. The final adversarial score
      was 17.5/35. The failed source was pruned; receipts remain under the
      gitignored `attachments/20260719-lock-surface-round15/`. Do not aggregate
      actual strands into a low-frequency additive blur again.
- [x] Define three receipt-distinct reel shots before packaging video variants.
- [ ] Package short 16:9 and vertical reels from those named moving shots.

Generated frames, videos, and benchmark JSON stay untracked and are pruned
eagerly. Durable code, small receipts, proof sources, and conclusions stay here.
