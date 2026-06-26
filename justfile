# Dev tasks. Run `just` to list. Hooks (lefthook) run lint/format on commit automatically;
# these recipes are for running things by hand on the whole tree.

# ruff isn't required on PATH — fall back to `uvx ruff` (uv is available).
ruff := `command -v ruff >/dev/null 2>&1 && echo ruff || echo "uvx ruff"`

# List recipes
default:
    @just --list

# Lint everything (no changes) — JS + Python
lint:
    npx eslint editor
    npx prettier --check 'editor/**/*.{js,css,html}'
    {{ruff}} check scripts

# Format everything in place — JS + Python
format:
    npx prettier --write 'editor/**/*.{js,css,html}'
    {{ruff}} format scripts

# Install / refresh git hooks
hooks:
    lefthook install

# Editor server (launchd-managed on :8091): start | stop | restart | status
serve action="start":
    ./scripts/serve.sh {{action}}

# Blender round-trip smoke test — proves the bake contract (CONVENTIONS 5.1)
smoke:
    ./scripts/blender.sh --background --python scripts/smoke_roundtrip.py

# Render a layout in Blender: `just render layouts/live.layout.json`
render layout:
    ./scripts/blender.sh --background --python scripts/render_layout.py -- {{layout}}
