export function createMotionControls({ player }) {
  const fileInput = document.querySelector("#motionClipFile");
  const playButton = document.querySelector("#motionPlay");
  const resetButton = document.querySelector("#motionReset");
  const status = document.querySelector("#motionStatus");

  async function load(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      player.load(JSON.parse(await file.text()));
      status.textContent = `Loaded ${file.name}`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = "";
    }
  }

  function update(state) {
    playButton.disabled = !state.loaded;
    resetButton.disabled = !state.loaded;
    playButton.textContent = state.playing ? "Pause" : "Play";
    if (state.loaded) {
      status.textContent = `${state.time_s.toFixed(2)} / ${state.duration_s.toFixed(2)} s · ${state.frame_count} frames`;
    }
  }

  function wire() {
    fileInput.addEventListener("change", load);
    playButton.addEventListener("click", () => player.toggle());
    resetButton.addEventListener("click", () => player.reset());
  }

  return { update, wire };
}
