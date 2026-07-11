# Haircut simulator: product and physics direction

Issue: [#79](https://github.com/BenKnill/blender-threejs-bakes/issues/79)

## Conclusion

There is a credible path from the mannequin demo to a unusually good haircut
simulator. The important product is not a salon-management game and not a
catalogue of hairstyle meshes. It is an interactive **haircut construction
laboratory**: section real strands, elevate and over-direct them, establish a
guide, cut them, release them, and see how their material properties determine
the final fall.

The first real implementation should use hundreds of independently simulated
3D guide strands with dense render interpolation. It should not extend the
current seven-guide Box3D animation. Box3D remains useful elsewhere in this
repository, but a planar rigid-body engine is the wrong substrate for bending,
twisting, contact-rich 3D fibers.

## What exists

The current field is split into three products that do not quite meet:

1. **Salon games.** [Hairdresser Simulator](https://store.steampowered.com/app/1330560/Hairdresser_Simulator/)
   offers cutting, washing, dyeing, curling, straightening, drying, portrait
   upload, and salon management. Its breadth demonstrates that haircut actions
   are a substantial interactive program, but its public materials do not make
   a physically calibrated strand model a product claim.
2. **Professional instruction.** Paul Mitchell's
   [Cutting System](https://play.google.com/store/apps/details?id=edu.paulmitchell.cuttingsystem)
   teaches nine foundation cuts using sectioning, elevation, over-direction,
   finger angle, cutting angle, scissor-over-comb, and clipper-over-comb. Its
   3D diagrams explain the construction language we should expose, but it is an
   instructional viewer rather than a material simulator.
3. **Hair research and DCC technology.** The 2010
   [Hair Cut Simulator](https://www.jst.go.jp/erato/igarashi/en/projects/HairCut/)
   already identified combing, scissor cutting, and wax as the natural user
   interface. NVIDIA HairWorks established the guide-hair/growth-mesh pattern
   and material maps for stiffness, density, length, width, clumping, and
   waviness. AMD's MIT-licensed
   [TressFX](https://gpuopen.com/tressfx/) adds GPU constraints, SDF body
   collision, shock propagation, interpolation, and strand rendering, but its
   maintained integrations target DirectX/Vulkan/Unreal rather than this Mac-
   first, browser-visible workbench.

The closest direct reference is the MIT-licensed
[Digital Salon](https://digital-salon.github.io/), presented at SIGGRAPH Asia
2024 and documented in a fuller 2025 paper. It combines generation, dense
simulation, trimming, and rendering for 10,000--80,000 strands. Its Augmented
Mass-Spring model adds bending and torsional behavior plus biphasic one-way
springs for hair interactions. Trimming removes particles and their incident
springs, allowing the new topology to respond immediately. This validates the
basic direction.

Digital Salon is a reference and possible source donor, not a drop-in Mac
backend. Its [installation](https://github.com/digital-salon/Digital-Salon/blob/main/INSTALL.md)
requires CUDA 11.6 or later, its reported demos used RTX hardware, and its
sanity-check example sends roughly 200,000 particles to CUDA. We should study
and selectively port its solver ideas while preserving a native M5 path.

## What “hair as a material” means

A haircut changes length and topology. Whether that cut becomes a bob, a
triangle, a mushroom, a cloud, or a limp curtain depends on state that the
current geometry-only demo does not represent.

### Per-strand state

- root position, direction, and scalp coordinates;
- rest length and segment lengths;
- rest curvature and rest twist, including directionality for an elliptical
  cross-section;
- diameter/ellipticity and linear density;
- bending and torsional stiffness;
- stretch compliance, numerical damping, and physical drag;
- cut state and provenance: section, guide, tool, time, and cut angle.

Human-hair “handle” research identifies diameter, bending stiffness, and fiber
friction as central collective properties. A useful simulator therefore should
not expose a single vague `softness` slider. It should offer an approachable
preset layer while retaining those independent underlying quantities.

### Collective state

- strand--scalp and strand--tool friction;
- strand--strand friction/contact or a documented aggregate approximation;
- local density and excluded volume;
- clump membership and attraction;
- moisture and product fields.

Moisture/product must transform material state rather than merely change the
shader. A first model can map them to rest curvature, bend damping, friction,
mass, and clump attraction. It does not need keratin chemistry to produce
meaningfully different wet, dry, conditioned, sprayed, and waxed behavior.

### Appearance state

Simulation guides and visible fibers should remain separate. Hundreds or low
thousands of guide strands carry mechanics; tens of thousands of fine fibers
interpolate root position, rest shape, and guide motion. Rendering needs a
fiber-aware Marschner/Principled-Hair-like response, root-to-tip width, color
variation, shadows, and anti-aliasing. Dense appearance is not evidence that
every visible fiber was simulated.

## Solver decision

Start with a compact CPU solver in the browser laboratory, organized so its
state arrays can later move to C++/Wasm or WebGPU without changing the groom or
tool contracts.

The first solver should be an augmented mass-spring or XPBD rod approximation:

- particles and stretch constraints preserve strand length;
- bend constraints preserve rest curvature;
- optional orientation/twist constraints distinguish straight, wavy, curly,
  and coily recovery;
- root pinning attaches to moving scalp triangles;
- a scalp signed-distance or capsule proxy provides body collision;
- a spatial hash supplies bounded local strand interaction;
- compliance is expressed in timestep-independent units and tested across
  timesteps.

Position-and-orientation Cosserat rods are the higher-fidelity destination.
[Position and Orientation Based Cosserat Rods](https://diglib.eg.org/bitstream/handle/10.2312/sca20161234/169-178.pdf)
provides a well-established constraint formulation, while 2025's
[Stable Cosserat Rods](https://jerryhsu.io/projects/StableCosseratRods/)
reports improved stability and speed across hair, trees, yarn, and other thin
structures. Beginning with a small testable XPBD core lets us learn which of
that machinery the haircut interaction actually needs before adopting a large
GPU architecture.

TressFX and Digital Salon should be kept as comparison/source lanes. Both are
MIT licensed, but importing either wholesale would bring a GPU/runtime
architecture that does not match the Mac/browser front door.

## Tool model

Tool behavior matters at least as much as free motion:

- **section:** select roots by scalp region and preserve named section sets;
- **comb:** swept teeth collect and order nearby segments; friction determines
  slip rather than teleporting strands;
- **fingers/clip:** temporary positional constraints hold an elevated section;
- **scissors:** cut strand segments intersecting the closed blade sweep;
- **razor/texturizer:** probabilistically stagger cuts across a captured
  section, with a deterministic seed and receipt;
- **clipper:** cut against a tool-local length surface or guard distance;
- **dryer:** directional drag plus optional moisture reduction;
- **product:** paint a material field, especially friction/clump/damping.

Scissor cutting does not require a fracture-mechanics solver. Hair strands are
already one-dimensional topology; segment/blade intersection followed by
constraint removal is both interactive and mechanically honest. The harder
problem is deciding which strands the stylist has actually captured with comb
and fingers.

## Artifact sequence

### 1. Material bench

Render 256--512 guide strands on a simple scalp in Three.js. Provide four
material presets (straight, wavy, curly, coily), head motion, gravity, scalp
collision, one grab constraint, and a cut brush. Show solver time, guide count,
render-fiber count, iterations, maximum stretch error, and memory.

Pass conditions:

- roots remain pinned;
- maximum length error stays bounded and reported;
- each preset recovers a visibly and numerically different rest shape;
- cutting updates topology without instability;
- the laboratory remains interactive on the primary M5 Mac.

The first implementation of this artifact is documented in
[Interactive hair material bench](HAIR_MATERIAL_BENCH.md).

### 2. Haircut construction

Add named sections, elevation and over-direction guides, fingers/clips, a comb,
scissors, undo/history, and a before/after length map in scalp coordinates.
Build one canonical long-layer or graduated-bob exercise rather than a broad
toolbox.

### 3. Dense groom

Interpolate 20,000 or more visible fibers from the guide state, add clump and
flyaway layers, improve hair shading, and export the state to Blender for a
high-quality receipt render. Keep interaction real-time even if the final bake
is offline.

### 4. Wet/product and calibration

Add moisture and product fields only after the dry solver passes. Calibrate
presets against simple reproducible tests: cantilever sag, curl recovery,
pendulum damping, comb pull-through, and post-cut silhouette. Preserve measured
parameters separately from artist-tuned ones.

## Claim boundary

The first laboratory will be a material-aware graphics solver, not a validated
predictor of an individual person's post-salon appearance. “Straight”, “wavy”,
“curly”, and “coily” presets are parameter families, not demographic labels or
claims about all fibers in a category. A future personalized product would need
capture, calibration, uncertainty, and validation against real tresses and
cuts.

## Primary references

- [Digital Salon project and paper](https://digital-salon.github.io/)
- [Digital Salon source, MIT license](https://github.com/digital-salon/Digital-Salon)
- [AMD TressFX](https://gpuopen.com/tressfx/)
- [NVIDIA HairWorks asset and material workflow](https://docs.nvidia.com/gameworks/content/artisttools/hairworks/Using_HairWorks.html)
- [Disney Elastic Rod hair model](https://media.disneyanimation.com/uploads/production/publication_asset/167/asset/moanaHair_abstract1.pdf)
- [Disney continuum collision treatment](https://www.disneyanimation.com/publications/detail-preserving-continuum-simulation-of-straight-hair-siggraph-2009-paper/)
- [Hair diameter, bending, and friction study](https://doi.org/10.1111/j.1467-2494.2006.00306.x)
- [Systems review of human hair fiber properties](https://pmc.ncbi.nlm.nih.gov/articles/PMC6393780/)
