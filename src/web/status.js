export function showTransientStatus(element, message, options = {}) {
  const timeout = options.timeout ?? 2000;
  const setTimer = options.setTimeout ?? globalThis.setTimeout;
  element.textContent = message;
  element.classList.add("visible");
  setTimer(() => element.classList.remove("visible"), timeout);
}
