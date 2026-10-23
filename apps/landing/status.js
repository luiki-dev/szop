import { checkDemo } from "./check-demo.js";

const HEALTH_URL = "https://szop.dzwoniec.com/api/health";
const TIMEOUT_MS = 5000;
const INTERVAL_MS = 30_000;

const dot = document.getElementById("demo-dot");
const text = document.getElementById("demo-text");

// A check takes at most TIMEOUT_MS, but the tab becoming visible can start one
// while another is still running.
let checking = false;

async function refresh() {
  if (checking || !dot || !text) return;
  checking = true;
  try {
    const state = await checkDemo(fetch, HEALTH_URL, TIMEOUT_MS);
    const label = `Szop demo is ${state}`;
    dot.dataset.state = state;
    dot.title = label;
    text.textContent = label;
  } finally {
    checking = false;
  }
}

void refresh();

// A hidden tab does not poll; it checks again when it is shown.
setInterval(() => {
  if (document.visibilityState === "visible") void refresh();
}, INTERVAL_MS);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refresh();
});
