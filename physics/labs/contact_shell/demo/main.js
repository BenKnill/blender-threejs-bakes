const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  fixture: null,
  experiment: "energy",
  progress: 0,
  twin: "slow",
  frictionDemand: { x: 3, y: 4 },
  animationFrame: null,
  frictionDragging: false,
};

const elements = {
  kicker: document.querySelector("#stage-kicker"),
  title: document.querySelector("#stage-title"),
  description: document.querySelector("#stage-description"),
  readout: document.querySelector("#readout"),
  actions: document.querySelector("#stage-actions"),
  visual: document.querySelector("#contact-visual"),
  content: document.querySelector("#visual-content"),
  visualTitle: document.querySelector("#visual-title"),
  visualDescription: document.querySelector("#visual-description"),
  caption: document.querySelector("#visual-caption"),
  evidenceNote: document.querySelector("#evidence-note"),
};

const descriptions = {
  energy: {
    kicker: "PUBLIC BOX3D PROBE · P1",
    title: "Overlap becomes motion.",
    description:
      "With gravity disabled, the solver pushes an interpenetrating cube away from the floor. Its translational kinetic energy rises from exactly zero.",
  },
  threshold: {
    kicker: "PUBLIC BOX3D PROBE · P2",
    title: "Two thousandths split the future.",
    description:
      "The saved approach speed is compared with a strict 1 m/s restitution threshold. The slower twin keeps falling; the faster twin rebounds.",
  },
  friction: {
    kicker: "MODEL + HOL SHELL · C5 / P3",
    title: "Friction lives inside a disk.",
    description:
      "Drag the demand vector anywhere. The contact shell preserves demands inside the radius and projects larger ones back to its boundary.",
  },
};

function svg(tag, attributes = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
  if (text !== null) node.textContent = text;
  return node;
}

function line(parent, x1, y1, x2, y2, attributes = {}) {
  parent.append(svg("line", { x1, y1, x2, y2, ...attributes }));
}

function text(parent, x, y, value, attributes = {}) {
  parent.append(svg("text", { x, y, ...attributes }, value));
}

function format(value, digits = 4) {
  if (value === 0) return "0";
  return Number(value).toFixed(digits);
}

function setReadout(items) {
  elements.readout.replaceChildren();
  items.forEach(([label, value]) => {
    const wrapper = document.createElement("div");
    const term = document.createElement("dt");
    const definition = document.createElement("dd");
    term.textContent = label;
    definition.textContent = value;
    wrapper.append(term, definition);
    elements.readout.append(wrapper);
  });
}

function setActions(children) {
  elements.actions.replaceChildren(...children);
}

function button(label, onClick, className = "") {
  const control = document.createElement("button");
  control.type = "button";
  control.textContent = label;
  control.className = className;
  control.addEventListener("click", onClick);
  return control;
}

function renderEnergy() {
  const data = state.fixture.energy;
  const t = state.progress;
  const eased = 1 - (1 - t) ** 3;
  const cubeY = 245 - eased * 74;
  const energy = data.energy_after * eased ** 2;
  const velocity = data.post_vy * eased;

  elements.visualTitle.textContent = "Energetic overlap recovery";
  elements.visualDescription.textContent =
    "An overlapped cube moves upward over one measured Box3D step while its kinetic energy meter increases.";
  elements.caption.textContent = `MEASURED SUBSTEP · ${(data.dt * 1000 * t).toFixed(2)} / ${(data.dt * 1000).toFixed(2)} MS`;

  const group = svg("g");
  group.append(svg("rect", { x: 40, y: 315, width: 680, height: 110, fill: "url(#floor-glow)" }));
  line(group, 40, 315, 720, 315, { stroke: "var(--cyan)", "stroke-width": 2 });
  for (let x = 55; x <= 710; x += 38) {
    line(group, x, 315, x - 36, 370, { stroke: "var(--cyan-dim)", "stroke-width": 1 });
  }
  text(group, 54, 402, "STATIC FLOOR", { fill: "var(--muted-paper)", "font-size": 12 });

  const overlap = Math.max(0, cubeY + 144 - 315);
  if (overlap > 0.5) {
    group.append(
      svg("rect", {
        x: 260,
        y: 315 - overlap,
        width: 144,
        height: overlap,
        fill: "var(--coral)",
        opacity: 0.72,
      })
    );
    text(group, 417, 310, `OVERLAP ${(overlap / 144).toFixed(2)} m`, {
      fill: "var(--coral)",
      "font-size": 11,
      "text-anchor": "start",
    });
  }

  group.append(
    svg("rect", {
      x: 260,
      y: cubeY,
      width: 144,
      height: 144,
      fill: "url(#cube-face)",
      stroke: "var(--paper)",
      "stroke-width": 1,
    })
  );
  line(group, 260, cubeY, 285, cubeY - 22, { stroke: "var(--paper)" });
  line(group, 404, cubeY, 429, cubeY - 22, { stroke: "var(--paper)" });
  line(group, 285, cubeY - 22, 429, cubeY - 22, { stroke: "var(--paper)" });
  text(group, 332, cubeY + 77, "1 kg", {
    fill: "var(--ink)",
    "font-size": 14,
    "text-anchor": "middle",
  });

  if (velocity > 0.001) {
    line(group, 468, cubeY + 72, 468, cubeY + 72 - velocity * 330, {
      stroke: "var(--cyan)",
      "stroke-width": 3,
      "marker-end": "url(#arrow-cyan)",
    });
    text(group, 482, cubeY + 55, `v = ${velocity.toFixed(3)} m/s`, {
      fill: "var(--cyan)",
      "font-size": 12,
    });
  }

  text(group, 548, 118, "KINETIC ENERGY", {
    fill: "var(--muted-paper)",
    "font-size": 11,
  });
  group.append(
    svg("rect", {
      x: 548,
      y: 142,
      width: 118,
      height: 178,
      fill: "none",
      stroke: "var(--line)",
    })
  );
  const barHeight = (energy / data.energy_after) * 178;
  group.append(
    svg("rect", {
      x: 548,
      y: 320 - barHeight,
      width: 118,
      height: barHeight,
      fill: "var(--coral)",
    })
  );
  text(group, 607, 345, `${energy.toFixed(5)} J`, {
    fill: "var(--paper)",
    "font-size": 14,
    "text-anchor": "middle",
  });
  elements.content.replaceChildren(group);

  setReadout([
    ["energy before", `${format(data.energy_before)} J`],
    ["energy after", `${data.energy_after.toFixed(8)} J`],
    ["post velocity", `${data.post_vy.toFixed(6)} m/s`],
    ["contact points", String(data.contact_points)],
  ]);

  const replay = button(
    "Replay substep",
    () => {
      state.progress = 0;
      animateProgress(renderEnergy);
    },
    "is-primary"
  );
  const label = document.createElement("label");
  label.className = "timeline-control";
  label.textContent = "SCRUB SUBSTEP";
  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = "1";
  range.step = "0.001";
  range.value = String(t);
  range.setAttribute("aria-label", "Substep progress");
  range.addEventListener("input", () => {
    cancelAnimation();
    state.progress = Number(range.value);
    renderEnergy();
  });
  label.append(range);
  setActions([replay, label]);
}

function renderThreshold() {
  const data = state.fixture.threshold;
  const selected = data[state.twin];
  const t = state.progress;
  elements.visualTitle.textContent = "Restitution threshold twins";
  elements.visualDescription.textContent =
    "Two cubes approach identical floors at nearly identical speeds; only the faster twin rebounds.";
  elements.caption.textContent = "MEASURED PUBLIC-API OUTCOMES · RESTITUTION THRESHOLD 1.000 M/S";

  const group = svg("g");
  const twins = [
    { key: "slow", x: 215, label: "SLOW TWIN", color: "var(--yellow)" },
    { key: "fast", x: 545, label: "FAST TWIN", color: "var(--coral)" },
  ];
  line(group, 60, 340, 700, 340, { stroke: "var(--cyan)", "stroke-width": 2 });
  line(group, 380, 65, 380, 395, { stroke: "var(--line)", "stroke-width": 1 });
  twins.forEach((twin) => {
    const sample = data[twin.key];
    const outgoing = state.progress > 0.48;
    const phase = outgoing ? (state.progress - 0.48) / 0.52 : state.progress / 0.48;
    const incomingY = 112 + phase * 154;
    const outgoingDistance = Math.abs(sample.post_vy) * 105 * phase;
    const y = outgoing
      ? twin.key === "fast"
        ? 266 - outgoingDistance
        : 266 + outgoingDistance
      : incomingY;
    const selectedOpacity = state.twin === twin.key ? 1 : 0.35;
    group.append(
      svg("rect", {
        x: twin.x - 56,
        y,
        width: 112,
        height: 74,
        fill: twin.color,
        opacity: selectedOpacity,
      })
    );
    text(group, twin.x, y + 44, twin.key === "slow" ? "−0.999" : "−1.001", {
      fill: "var(--ink)",
      "font-size": 15,
      "text-anchor": "middle",
      opacity: selectedOpacity,
    });
    text(group, twin.x, 84, twin.label, {
      fill: twin.color,
      "font-size": 12,
      "text-anchor": "middle",
      opacity: selectedOpacity,
    });
    text(group, twin.x, 382, `${sample.post_vy > 0 ? "+" : ""}${sample.post_vy.toFixed(6)} m/s`, {
      fill: "var(--paper)",
      "font-size": 13,
      "text-anchor": "middle",
      opacity: selectedOpacity,
    });
  });
  text(group, 380, 428, "THE SAME FLOOR · THE SAME MATERIAL · Δv = 0.002 m/s", {
    fill: "var(--muted-paper)",
    "font-size": 11,
    "text-anchor": "middle",
  });
  elements.content.replaceChildren(group);

  setReadout([
    ["selected twin", state.twin],
    ["saved approach", `${selected.saved_vn.toFixed(6)} m/s`],
    ["post velocity", `${selected.post_vy > 0 ? "+" : ""}${selected.post_vy.toFixed(6)} m/s`],
    ["branch", selected.saved_vn < -data.speed ? "restitution" : "no restitution"],
  ]);

  const slow = button("−0.999 slow", () => selectTwin("slow"), "twin-choice");
  const fast = button("−1.001 fast", () => selectTwin("fast"), "twin-choice");
  slow.classList.toggle("is-active", state.twin === "slow");
  fast.classList.toggle("is-active", state.twin === "fast");
  slow.setAttribute("aria-pressed", String(state.twin === "slow"));
  fast.setAttribute("aria-pressed", String(state.twin === "fast"));
  const replay = button(
    "Drop twins",
    () => {
      state.progress = 0;
      animateProgress(renderThreshold);
    },
    "is-primary"
  );
  setActions([slow, fast, replay]);
}

function selectTwin(twin) {
  state.twin = twin;
  state.progress = 1;
  renderThreshold();
}

function renderFriction() {
  const data = state.fixture.friction;
  const oracle = state.fixture.oracle;
  const center = { x: 380, y: 230 };
  const scale = 62;
  const demand = state.frictionDemand;
  const demandNorm = Math.hypot(demand.x, demand.y);
  const demoRadius = oracle.friction_norm;
  const responseScale = demandNorm > demoRadius ? demoRadius / demandNorm : 1;
  const response = { x: demand.x * responseScale, y: demand.y * responseScale };
  const responseNorm = Math.hypot(response.x, response.y);

  elements.visualTitle.textContent = "Friction impulse projection";
  elements.visualDescription.textContent =
    "A draggable demand vector is clamped to a circular friction bound; the measured Box3D impulse is also marked inside its own radius.";
  elements.caption.textContent = "DRAG THE CORAL DEMAND HANDLE · RESPONSE IS THE CYAN VECTOR";

  const group = svg("g");
  group.append(
    svg("circle", {
      cx: center.x,
      cy: center.y,
      r: demoRadius * scale,
      fill: "rgb(92 225 220 / 7%)",
      stroke: "var(--cyan)",
      "stroke-width": 2,
    })
  );
  line(group, 90, center.y, 670, center.y, { stroke: "var(--line)" });
  line(group, center.x, 35, center.x, 425, { stroke: "var(--line)" });
  text(group, center.x + 8, 54, "t₂", { fill: "var(--muted-paper)", "font-size": 12 });
  text(group, 652, center.y - 10, "t₁", { fill: "var(--muted-paper)", "font-size": 12 });
  text(group, center.x, 86, "μ λₙ", {
    fill: "var(--cyan)",
    "font-size": 12,
    "text-anchor": "middle",
  });

  const measuredAngle = -0.72;
  const measuredRatio = data.friction_impulse / data.radius;
  const measuredX = center.x + Math.cos(measuredAngle) * demoRadius * scale * measuredRatio;
  const measuredY = center.y + Math.sin(measuredAngle) * demoRadius * scale * measuredRatio;
  group.append(
    svg("circle", {
      cx: measuredX,
      cy: measuredY,
      r: 7,
      fill: "var(--yellow)",
      stroke: "var(--ink)",
      "stroke-width": 2,
    })
  );
  text(group, measuredX + 13, measuredY - 10, "BOX3D PROBE", {
    fill: "var(--paper)",
    "font-size": 10,
  });

  const demandEnd = {
    x: center.x + demand.x * scale,
    y: center.y - demand.y * scale,
  };
  const responseEnd = {
    x: center.x + response.x * scale,
    y: center.y - response.y * scale,
  };
  line(group, center.x, center.y, demandEnd.x, demandEnd.y, {
    stroke: "var(--coral)",
    "stroke-width": 2,
    "stroke-dasharray": "8 7",
    "marker-end": "url(#arrow-coral)",
  });
  line(group, center.x, center.y, responseEnd.x, responseEnd.y, {
    stroke: "var(--cyan)",
    "stroke-width": 4,
    "marker-end": "url(#arrow-cyan)",
  });
  const handle = svg("circle", {
    cx: demandEnd.x,
    cy: demandEnd.y,
    r: 14,
    fill: "var(--coral)",
    stroke: "var(--paper)",
    "stroke-width": 2,
    role: "button",
    "aria-label": "Drag friction demand vector",
    style: "cursor: grab",
  });
  group.append(handle);
  elements.content.replaceChildren(group);
  enableFrictionDrag(handle, center, scale);

  setReadout([
    ["demand norm", demandNorm.toFixed(3)],
    ["response norm", responseNorm.toFixed(3)],
    ["model radius", demoRadius.toFixed(3)],
    ["native ratio", `${(measuredRatio * 100).toFixed(5)}%`],
  ]);
  const reset = button(
    "Reset to (3, 4)",
    () => {
      state.frictionDemand = { x: 3, y: 4 };
      renderFriction();
    },
    "is-primary"
  );
  const branch = document.createElement("span");
  branch.className = "stage-kicker";
  branch.textContent = demandNorm > demoRadius ? "PROJECTED TO BOUNDARY" : "UNCHANGED INSIDE DISK";
  setActions([reset, branch]);
}

function enableFrictionDrag(handle, center, scale) {
  const update = (event) => {
    const point = elements.visual.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(elements.visual.getScreenCTM().inverse());
    state.frictionDemand = {
      x: Math.max(-4.2, Math.min(4.2, (local.x - center.x) / scale)),
      y: Math.max(-3.1, Math.min(3.1, (center.y - local.y) / scale)),
    };
    renderFriction();
  };
  handle.addEventListener("pointerdown", (event) => {
    state.frictionDragging = true;
    handle.style.cursor = "grabbing";
    event.preventDefault();
  });
  elements.visual.onpointermove = (event) => {
    if (state.frictionDragging) update(event);
  };
  elements.visual.onpointerup = () => {
    state.frictionDragging = false;
  };
  elements.visual.onpointerleave = () => {
    state.frictionDragging = false;
  };
}

function cancelAnimation() {
  if (state.animationFrame !== null) cancelAnimationFrame(state.animationFrame);
  state.animationFrame = null;
}

function animateProgress(render) {
  cancelAnimation();
  const start = performance.now();
  const duration = 1150;
  const frame = (now) => {
    state.progress = Math.min(1, (now - start) / duration);
    render();
    if (state.progress < 1) state.animationFrame = requestAnimationFrame(frame);
    else state.animationFrame = null;
  };
  state.animationFrame = requestAnimationFrame(frame);
}

function renderExperiment() {
  cancelAnimation();
  const copy = descriptions[state.experiment];
  elements.kicker.textContent = copy.kicker;
  elements.title.textContent = copy.title;
  elements.description.textContent = copy.description;
  document.querySelectorAll("[data-experiment]").forEach((tab) => {
    const active = tab.dataset.experiment === state.experiment;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
  if (state.experiment === "energy") renderEnergy();
  if (state.experiment === "threshold") renderThreshold();
  if (state.experiment === "friction") renderFriction();
}

document.querySelectorAll("[data-experiment]").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.experiment = tab.dataset.experiment;
    state.progress = state.experiment === "friction" ? 1 : 0;
    renderExperiment();
    if (state.experiment !== "friction") {
      animateProgress(state.experiment === "energy" ? renderEnergy : renderThreshold);
    }
  });
});

document.querySelectorAll("[data-evidence]").forEach((control) => {
  control.addEventListener("click", () => {
    document
      .querySelectorAll("[data-evidence]")
      .forEach((item) => item.classList.remove("is-active"));
    control.classList.add("is-active");
    elements.evidenceNote.textContent = state.fixture.evidence[control.dataset.evidence];
  });
});

async function start() {
  const response = await fetch("fixture.json");
  if (!response.ok) throw new Error(`fixture load failed: ${response.status}`);
  state.fixture = await response.json();
  renderExperiment();
  animateProgress(renderEnergy);
}

start().catch((error) => {
  elements.title.textContent = "Fixture unavailable.";
  elements.description.textContent = error.message;
  elements.visual.replaceChildren();
});
