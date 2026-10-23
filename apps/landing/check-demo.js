/**
 * Tells whether Szop's demo answers.
 *
 * The request is `no-cors`: the page is on dzwoniec.com and the demo on
 * szop.dzwoniec.com, and the application sends no CORS headers (PH-34 spec,
 * decision 5). A `no-cors` request that gets any answer resolves with an
 * opaque response, and one that gets none (no DNS record while the demo is
 * down, no connection, the timeout) rejects. So this can tell "an answer" from
 * "none", but not the status code: a 503 from the load balancer while the
 * tasks start counts as up.
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
