// Applies the user's color scheme before the first paint, so the page never
// flashes in the wrong one (APR-1; ADR 0049). A classic script loaded from
// index.html's <head>: the CSP blocks inline scripts but allows this file,
// and the app's bundle runs too late. The rules are those of
// src/shell/color-scheme.ts, kept in step by hand.
(() => {
  let choice = null;
  try {
    choice = localStorage.getItem("szop-color-scheme");
  } catch {
    // Blocked storage: the system's scheme.
  }
  if (
    choice === "dark" ||
    (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    document.documentElement.classList.add("dark");
  }
})();
