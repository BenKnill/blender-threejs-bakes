# Parametric rescue ship conditioning plate

This model deliberately establishes architecture before image detail. It uses
only basic parametric solids, procedural materials, and studio lighting to make
a coherent source plate for later image generation.

The silhouette is divided into three readable functional thirds:

1. **Habitation** — a flattened pressure hull with forward/outward observation
   windows, four orange side-mounted lifeboats, and no visible occupants.
2. **Machinery** — an exposed dark service box, copper truss and pipes,
   deployable radiators, and one dorsal winch at the forward pressure collar.
3. **Propulsion** — four white cylindrical propellant tanks around a central
   spine and five unmistakable aft-facing engine bells. There are no guns.

Hull, rescue, machinery, copper, and engine surfaces use deterministic Noise
Texture color/roughness/bump variation. Geometry supplies the large and medium
forms; the shader adds only restrained surface breakup. Warm key, cool fill,
cyan rim, and engine-bounce lights keep the functional thirds legible against a
dark studio ground. The default render backend is headless Cycles CPU so the
same job works on `bluestar` without depending on a GLX/EGL display context.

Launch the three-view render as a background job (the default):

```sh
bash scripts/build_parametric_rescue_ship.sh
bash scripts/build_parametric_rescue_ship.sh status
bash scripts/build_parametric_rescue_ship.sh log
```

Use `foreground` only for debugging. Outputs include hero, side, and top PNGs,
the editable `.blend`, a `parametric-rescue-ship/1` design receipt, a live
`bake-telemetry/2` job receipt, and the captured log under
`renders/parametric_rescue_ship/`.

The model is a visual conditioning plate, not an engineering-qualified pressure
vessel or propulsion design. Procedural surface breakup is illustrative rather
than manufactured panel topology.
