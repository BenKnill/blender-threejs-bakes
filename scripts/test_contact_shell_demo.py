#!/usr/bin/env python3
"""Dependency-light contract checks for the contact-shell browser fixture."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "physics" / "labs" / "contact_shell" / "demo"
PROBE = ROOT / "physics" / "labs" / "contact_shell" / "outputs" / "contact_shell.jsonl"


def main() -> None:
    fixture = json.loads((DEMO / "fixture.json").read_text(encoding="utf-8"))
    index = (DEMO / "index.html").read_text(encoding="utf-8")
    script = (DEMO / "main.js").read_text(encoding="utf-8")

    assert fixture["schema"] == "contact-shell-demo/1"
    assert fixture["energy"]["energy_before"] == 0
    assert fixture["energy"]["energy_after"] > 0

    threshold = fixture["threshold"]
    assert threshold["slow"]["saved_vn"] > -threshold["speed"]
    assert threshold["fast"]["saved_vn"] < -threshold["speed"]
    assert threshold["slow"]["post_vy"] <= 0 < threshold["fast"]["post_vy"]

    friction = fixture["friction"]
    assert friction["within"] is True
    assert friction["friction_impulse"] <= friction["radius"] + 1e-6
    assert fixture["oracle"]["softness_sum"] == 1

    assert 'src="main.js"' in index
    assert 'href="styles.css"' in index
    assert 'fetch("fixture.json")' in script
    assert "final cold audit pending" in fixture["evidence"]["hol"].lower()
    assert "Three surprises inside a collision." in index
    assert "Overlap can add motion" in index
    assert "A tiny change flips the bounce" in index
    assert "Friction has a hard limit" in index
    assert "Technical details and evidence boundary" in index
    assert "Can a resting box gain speed?" in script
    assert "One box keeps falling; the other rebounds." in script
    assert "The solver supplies only the maximum allowed amount." in script
    assert "renderExperiment({ playMotion: true });" in script
    assert 'window.matchMedia("(prefers-reduced-motion: reduce)")' in script
    assert "state.progress = 0;\n  render();" in script

    if PROBE.exists():
        probe_bytes = PROBE.read_bytes()
        assert hashlib.sha256(probe_bytes).hexdigest() == fixture["probe_sha256"]
        probe = {
            item["case"]: item
            for line in probe_bytes.decode("utf-8").splitlines()
            if (item := json.loads(line))
        }
        assert fixture["energy"]["energy_after"] == probe["energetic_penetrator"]["energy_after"]
        assert fixture["threshold"]["slow"]["post_vy"] == probe["threshold_twin_slow"]["post_vy"]
        assert fixture["threshold"]["fast"]["post_vy"] == probe["threshold_twin_fast"]["post_vy"]
        assert fixture["friction"]["friction_impulse"] == probe["friction_disk"]["friction_impulse"]

    canonical = json.dumps(fixture, sort_keys=True, separators=(",", ":")).encode()
    digest = hashlib.sha256(canonical).hexdigest()
    print(f"contact shell demo fixture: ok ({digest[:12]})")


if __name__ == "__main__":
    main()
