export function createRenderUi({ gallery, status }) {
  function setStatus(message) {
    status.textContent = message;
  }

  function renderGallery(renders) {
    gallery.replaceChildren();
    if (!renders.length) {
      const empty = document.createElement("p");
      empty.textContent = "No renders yet";
      empty.dataset.testid = "render-empty";
      gallery.appendChild(empty);
      return;
    }
    for (const render of renders.slice(0, 6)) {
      const link = document.createElement("a");
      link.className = "renderTile";
      link.href = render.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.setAttribute("aria-label", `Open render ${render.name}`);
      link.dataset.testid = `render-tile:${render.name}`;
      const image = document.createElement("img");
      image.src = `${render.url}?v=${render.mtime}`;
      image.alt = render.name;
      image.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = render.name;
      link.append(image, label);
      gallery.appendChild(link);
    }
  }

  return { setStatus, renderGallery };
}
