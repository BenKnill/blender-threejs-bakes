const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  fixture: null,
  experiment: "energy",
  progress: 1,
  frictionDemand: { x: 3, y: 4 },
  frictionDragging: false,
  animationFrame: null,
};

const elements = {
  number: document.querySelector("#stage-number"),
  question: document.querySelector("#stage-question"),
  takeaway: document.querySelector("#stage-takeaway"),
  readout: document.querySelector("#readout"),
  actions: document.querySelector("#stage-actions"),
  technical: document.querySelector("#technical-content"),
  visual: document.querySelector("#contact-visual"),
  content: document.querySelector("#visual-content"),
  visualTitle: document.querySelector("#visual-title"),
  visualDescription: document.querySelector("#visual-description"),
};

const copy = {
  energy: {
    number: "EXPERIMENT 1 · MEASURED IN BOX3D",
    question: "Can a resting box gain speed?",
    answer: "Yes. Correcting an overlap launches it upward.",
  },
  threshold: {
    number: "EXPERIMENT 2 · MEASURED IN BOX3D",
    question: "Can 0.002 m/s decide a bounce?",
    answer: "Yes. One box keeps falling; the other rebounds.",
  },
  friction: {
    number: "EXPERIMENT 3 · MODEL + BOX3D CHECK",
    question: "What if we ask for too much friction?",
    answer: "The solver supplies only the maximum allowed amount.",
  },
};

function svg(tag, attributes = {}, label = null) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
  if (label !== null) node.textContent = label;
  return node;
}

function line(parent, x1, y1, x2, y2, attributes = {}) {
  parent.append(svg("line", { x1, y1, x2, y2, ...attributes }));
}

function text(parent, x, y, label, attributes = {}) {
  parent.append(svg("text", { x, y, ...attributes }, label));
}

function button(label, onClick) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "primary-action";
  control.textContent = label;
  control.addEventListener("click", onClick);
  return control;
}

function setReadout(items) {
  elements.readout.replaceChildren();
  items.forEach(([label, value, tone = ""]) => {
    const item = document.createElement("p");
    if (tone) item.classList.add(tone);
    const name = document.createElement("span");
    const result = document.createElement("strong");
    name.textContent = label;
    result.textContent = value;
    item.append(name, result);
    elements.readout.append(item);
  });
}

function setTechnical(paragraphs) {
  elements.technical.replaceChildren();
  paragraphs.forEach((paragraph) => {
    const node = document.createElement("p");
    node.textContent = paragraph;
    elements.technical.append(node);
  });
}

function floor(parent, x, y, width) {
  parent.append(
    svg("rect", {
      x,
      y,
      width,
      height: 55,
      fill: "rgb(92 225 220 / 10%)",
    })
  );
  line(parent, x, y, x + width, y, { stroke: "var(--cyan)", "stroke-width": 2 });
}

function cube(parent, x, y, fill, label) {
  parent.append(
    svg("rect", {
      x,
      y,
      width: 112,
      height: 112,
      fill,
      stroke: "var(--paper)",
      "stroke-width": 1,
    })
  );
  text(parent, x + 56, y + 62, label, {
    fill: "var(--ink)",
    "font-size": 14,
    "text-anchor": "middle",
  });
}

function renderEnergy() {
  const data = state.fixture.energy;
  const t = state.progress;
  const group = svg("g");

  elements.visualTitle.textContent = "A resting overlap becomes upward motion";
  elements.visualDescription.textContent =
    "Before and after panels show a resting box partly inside the floor, then moving upward after one measured step.";

  text(group, 190, 48, "BEFORE", {
    fill: "var(--muted-paper)",
    "font-size": 13,
    "text-anchor": "middle",
  });
  text(group, 710, 48, "AFTER ONE STEP", {
    fill: "var(--muted-paper)",
    "font-size": 13,
    "text-anchor": "middle",
  });

  floor(group, 50, 292, 280);
  cube(group, 134, 214, "var(--coral)", "at rest");
  group.append(svg("rect", { x: 134, y: 292, width: 112, height: 34, fill: "var(--coral)" }));
  text(group, 190, 374, "partly inside floor", {
    fill: "var(--coral)",
    "font-size": 13,
    "text-anchor": "middle",
  });

  line(group, 390, 236, 510, 236, {
    stroke: "var(--muted-paper)",
    "stroke-width": 2,
    "marker-end": "url(#arrow-cyan)",
  });
  text(group, 450, 216, "33 ms", {
    fill: "var(--muted-paper)",
    "font-size": 12,
    "text-anchor": "middle",
  });

  floor(group, 570, 292, 280);
  const liftedY = 180 - t * 35;
  cube(group, 654, liftedY, "var(--paper)", "moving");
  if (t > 0.05) {
    line(group, 790, liftedY + 70, 790, liftedY + 20, {
      stroke: "var(--cyan)",
      "stroke-width": 4,
      "marker-end": "url(#arrow-cyan)",
    });
    text(group, 710, 374, "upward at 0.223 m/s", {
      fill: "var(--cyan)",
      "font-size": 13,
      "text-anchor": "middle",
    });
  }

  elements.content.replaceChildren(group);
  elements.actions.replaceChildren(
    button("Replay before → after", () => {
      state.progress = 0;
      animate(renderEnergy);
    })
  );
  setReadout([
    ["speed before", "0 m/s"],
    ["speed after", `${data.post_vy.toFixed(3)} m/s upward`, "positive"],
  ]);
  setTechnical([
    `Native probe: translational kinetic energy rose from 0 to ${data.energy_after.toFixed(8)} J with gravity disabled.`,
    `This is fixture observation P1 against the pinned Box3D checkout, not a claim that every contact adds energy.`,
  ]);
}

function renderThreshold() {
  const data = state.fixture.threshold;
  const t = state.progress;
  const group = svg("g");

  elements.visualTitle.textContent = "Nearly identical approach speeds produce opposite outcomes";
  elements.visualDescription.textContent =
    "Two side-by-side boxes approach at 0.999 and 1.001 metres per second. Only the faster box rebounds.";

  const samples = [
    {
      x: 245,
      speed: "0.999 m/s",
      result: "NO BOUNCE",
      post: "still downward",
      color: "var(--yellow)",
      velocity: data.slow.post_vy,
    },
    {
      x: 655,
      speed: "1.001 m/s",
      result: "BOUNCE",
      post: "now upward",
      color: "var(--coral)",
      velocity: data.fast.post_vy,
    },
  ];

  samples.forEach((sample) => {
    floor(group, sample.x - 155, 300, 310);
    const beforeImpact = t < 0.48;
    const phase = beforeImpact ? t / 0.48 : (t - 0.48) / 0.52;
    const y = beforeImpact
      ? 86 + phase * 102
      : sample.velocity > 0
        ? 188 - phase * 70
        : 188 + phase * 10;
    cube(group, sample.x - 56, y, sample.color, sample.speed);
    if (!beforeImpact) {
      text(group, sample.x, 365, sample.result, {
        fill: sample.color,
        "font-size": 18,
        "font-weight": 700,
        "text-anchor": "middle",
      });
      text(group, sample.x, 391, sample.post, {
        fill: "var(--paper)",
        "font-size": 13,
        "text-anchor": "middle",
      });
    }
  });

  line(group, 450, 56, 450, 392, { stroke: "var(--line)", "stroke-width": 1 });
  text(group, 450, 36, "ONLY 0.002 m/s APART", {
    fill: "var(--cyan)",
    "font-size": 13,
    "text-anchor": "middle",
  });
  elements.content.replaceChildren(group);
  elements.actions.replaceChildren(
    button("Replay both impacts", () => {
      state.progress = 0;
      animate(renderThreshold);
    })
  );
  setReadout([
    ["just below limit", "keeps falling"],
    ["just above limit", "bounces upward", "positive"],
  ]);
  setTechnical([
    `The configured restitution threshold is ${data.speed.toFixed(3)} m/s. Saved approach speeds were ${Math.abs(data.slow.saved_vn).toFixed(6)} and ${Math.abs(data.fast.saved_vn).toFixed(6)} m/s.`,
    `Native probe P2 observed post-step vertical velocities ${data.slow.post_vy.toFixed(6)} and +${data.fast.post_vy.toFixed(6)} m/s.`,
  ]);
}

function renderFriction() {
  const oracle = state.fixture.oracle;
  const native = state.fixture.friction;
  const center = { x: 450, y: 260 };
  const scale = 55;
  const limit = oracle.friction_norm;
  const request = state.frictionDemand;
  const requested = Math.hypot(request.x, request.y);
  const clamp = requested > limit ? limit / requested : 1;
  const supplied = { x: request.x * clamp, y: request.y * clamp };
  const suppliedNorm = Math.hypot(supplied.x, supplied.y);
  const requestEnd = { x: center.x + request.x * scale, y: center.y - request.y * scale };
  const suppliedEnd = {
    x: center.x + supplied.x * scale,
    y: center.y - supplied.y * scale,
  };
  const group = svg("g");

  elements.visualTitle.textContent = "Requested friction is capped at a fixed limit";
  elements.visualDescription.textContent =
    "A draggable requested sideways push is shown as a dashed line. The friction actually supplied never leaves the labelled limit circle.";

  group.append(
    svg("circle", {
      cx: center.x,
      cy: center.y,
      r: limit * scale,
      fill: "rgb(92 225 220 / 8%)",
      stroke: "var(--cyan)",
      "stroke-width": 3,
    })
  );
  text(group, center.x, 132, "MAXIMUM FRICTION", {
    fill: "var(--cyan)",
    "font-size": 14,
    "text-anchor": "middle",
  });

  line(group, center.x, center.y, requestEnd.x, requestEnd.y, {
    stroke: "var(--coral)",
    "stroke-width": 3,
    "stroke-dasharray": "9 8",
    "marker-end": "url(#arrow-coral)",
  });
  line(group, center.x, center.y, suppliedEnd.x, suppliedEnd.y, {
    stroke: "var(--cyan)",
    "stroke-width": 6,
    "marker-end": "url(#arrow-cyan)",
  });
  text(group, requestEnd.x, requestEnd.y - 24, "REQUESTED", {
    fill: "var(--coral)",
    "font-size": 13,
    "text-anchor": "middle",
  });
  text(group, suppliedEnd.x - 18, suppliedEnd.y + 28, "SUPPLIED", {
    fill: "var(--cyan)",
    "font-size": 13,
    "text-anchor": "end",
  });

  const handle = svg("circle", {
    cx: requestEnd.x,
    cy: requestEnd.y,
    r: 16,
    fill: "var(--coral)",
    stroke: "var(--paper)",
    "stroke-width": 3,
    role: "button",
    "aria-label": "Drag requested friction",
    style: "cursor: grab",
  });
  group.append(handle);
  elements.content.replaceChildren(group);
  enableFrictionDrag(handle, center, scale);

  const limited = requested > limit;
  elements.takeaway.innerHTML = `<span>Answer</span> ${
    limited
      ? "The request is too large, so it is clipped to the limit."
      : "The request is within the limit, so it is supplied exactly."
  }`;
  elements.actions.replaceChildren(
    button("Reset to a too-large request", () => {
      state.frictionDemand = { x: 3, y: 4 };
      renderFriction();
    })
  );
  setReadout([
    ["requested", requested.toFixed(2)],
    ["supplied", suppliedNorm.toFixed(2), limited ? "limited" : "positive"],
  ]);
  setTechnical([
    `The model example uses a limit of ${limit.toFixed(2)}. Dragging changes the requested two-dimensional impulse; larger vectors are projected back to the circle.`,
    `Native probe P3 measured friction ${native.friction_impulse.toFixed(9)} within radius ${native.radius.toFixed(9)}. HOL claim C5 covers the exact-real projection formula only.`,
  ]);
}

function enableFrictionDrag(handle, center, scale) {
  const update = (event) => {
    const point = elements.visual.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(elements.visual.getScreenCTM().inverse());
    state.frictionDemand = {
      x: Math.max(-4.5, Math.min(4.5, (local.x - center.x) / scale)),
      y: Math.max(-3.5, Math.min(3.5, (center.y - local.y) / scale)),
    };
    renderFriction();
  };
  handle.addEventListener("pointerdown", (event) => {
    state.frictionDragging = true;
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

function animate(render) {
  cancelAnimation();
  const start = performance.now();
  const duration = 1000;
  state.progress = 0;
  render();
  const frame = (now) => {
    state.progress = Math.min(1, (now - start) / duration);
    render();
    if (state.progress < 1) state.animationFrame = requestAnimationFrame(frame);
    else state.animationFrame = null;
  };
  state.animationFrame = requestAnimationFrame(frame);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function renderExperiment({ playMotion = false } = {}) {
  cancelAnimation();
  const current = copy[state.experiment];
  elements.number.textContent = current.number;
  elements.question.textContent = current.question;
  elements.takeaway.innerHTML = `<span>Answer</span> ${current.answer}`;
  document.querySelectorAll("[data-experiment]").forEach((tab) => {
    const active = tab.dataset.experiment === state.experiment;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
  elements.visual.onpointermove = null;
  elements.visual.onpointerup = null;
  elements.visual.onpointerleave = null;
  state.frictionDragging = false;
  const animateSelection = playMotion && !prefersReducedMotion();
  if (state.experiment === "energy") {
    if (animateSelection) animate(renderEnergy);
    else {
      state.progress = 1;
      renderEnergy();
    }
  }
  if (state.experiment === "threshold") {
    if (animateSelection) animate(renderThreshold);
    else {
      state.progress = 1;
      renderThreshold();
    }
  }
  if (state.experiment === "friction") renderFriction();
}

document.querySelectorAll("[data-experiment]").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.experiment = tab.dataset.experiment;
    renderExperiment({ playMotion: true });
  });
});

async function start() {
  const response = await fetch("fixture.json");
  if (!response.ok) throw new Error(`fixture load failed: ${response.status}`);
  state.fixture = await response.json();
  renderExperiment({ playMotion: true });
}

start().catch((error) => {
  elements.question.textContent = "The measured fixture could not be loaded.";
  elements.takeaway.textContent = error.message;
  elements.visual.replaceChildren();
});
