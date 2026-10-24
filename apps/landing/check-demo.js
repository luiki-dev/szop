/**
 * Tells whether Szop's demo answers.
 *
 * The request is `no-cors`: the page is on dzwoniec.com and the demo on
 * szop.dzwoniec.com, and the application sends no CORS headers (ADR 0044,
 * decision 5). A `no-cors` request that gets an answer the browser lets the
 * page receive resolves with an opaque response, and one that gets none (no
 * DNS record while the demo is down, no connection, the timeout) rejects. The
 * browser also rejects it when the answer's Cross-Origin-Resource-Policy
 * forbids the page, which is why /api/health sends same-site (ADR 0046). So
 * this can tell "an answer" from "none", but not the status code: a 503 from
 * the load balancer while the tasks start counts as up.
 *
 * @param {typeof fetch} fetchFn
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<"up" | "down">}
 */
export async function checkDemo(fetchFn, url, timeoutMs) {
  try {
    await fetchFn(url, {
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return "up";
  } catch {
    return "down";
  }
}
