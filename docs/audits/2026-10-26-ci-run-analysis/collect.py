"""Collect Szop's GitHub Actions runs and write them into ci-runs.html.

Run from the repository root with the GitHub CLI logged in:

    python3 -I docs/audits/2026-10-26-ci-run-analysis/collect.py

It lists every run of every workflow, fetches the jobs and steps of each
finished run (the latest attempt), and replaces the data between the
markers in ci-runs.html. Nothing else in the page changes.
"""

import concurrent.futures
import datetime as dt
import json
import pathlib
import subprocess
import time

REPO = "luiki-dev/szop"
PAGE = pathlib.Path(__file__).with_name("ci-runs.html")
START, END = "/* DATA START */", "/* DATA END */"


def gh(path, attempts=4):
    # The API sometimes refuses a burst of parallel requests; wait and retry.
    for attempt in range(attempts):
        result = subprocess.run(["gh", "api", "--paginate", path], capture_output=True, text=True)
        if result.returncode == 0:
            break
        if attempt == attempts - 1:
            raise RuntimeError(f"gh api {path} failed: {result.stderr.strip()}")
        time.sleep(2 ** (attempt + 1))
    out = result.stdout
    # --paginate concatenates JSON documents; split them back.
    docs, decoder, i = [], json.JSONDecoder(), 0
    while i < len(out):
        doc, i = decoder.raw_decode(out, i)
        docs.append(doc)
        while i < len(out) and out[i].isspace():
            i += 1
    return docs


def when(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))


def ran(job):
    return job["conclusion"] not in ("skipped", None) and job["started_at"] and job["completed_at"]


def category(jobs):
    """What a CI run checked, read from the jobs that ran."""
    names = {j["name"] for j in jobs if ran(j)}
    infra = "plan" in names or "infra" in names
    if "e2e" in names:
        return "app + infra" if infra else "app, no infra"
    if infra:
        return "infra only"
    if "workflows" in names:
        return "workflows only"
    return "docs only"


def main():
    workflows = [w for d in gh(f"repos/{REPO}/actions/workflows") for w in d["workflows"]]
    runs = []
    for w in workflows:
        for d in gh(f"repos/{REPO}/actions/workflows/{w['id']}/runs?per_page=100"):
            for r in d["workflow_runs"]:
                r["_workflow"] = w["name"]
                runs.append(r)
    finished = [r for r in runs if r["conclusion"] in ("success", "failure", "cancelled")]

    def jobs_of(run):
        docs = gh(f"repos/{REPO}/actions/runs/{run['id']}/jobs?per_page=100&filter=latest")
        return run["id"], [j for d in docs for j in d["jobs"]]

    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        jobs = dict(pool.map(jobs_of, finished))

    step_names, step_index = [], {}

    def step_id(name):
        if name not in step_index:
            step_index[name] = len(step_names)
            step_names.append(name)
        return step_index[name]

    rows = []
    for r in sorted(runs, key=lambda r: r["created_at"]):
        js = [j for j in jobs.get(r["id"], []) if ran(j)]
        span = None
        if js:
            span = round(
                (max(when(j["completed_at"]) for j in js) - min(when(j["started_at"]) for j in js)).total_seconds()
            )
        row = {
            "i": r["id"],
            "w": r["_workflow"],
            "e": r["event"],
            "c": r["conclusion"],
            "a": r["run_attempt"],
            "b": r["head_branch"],
            "t": r["created_at"],
            "s": span,
        }
        if r["_workflow"] == "CI":
            row["g"] = category(js)
            row["j"] = [
                [
                    j["name"],
                    j["conclusion"],
                    round((when(j["completed_at"]) - when(j["started_at"])).total_seconds()),
                    [
                        [step_id(s["name"]), d]
                        for s in j.get("steps", [])
                        if s.get("started_at") and s.get("completed_at") and s.get("conclusion") != "skipped"
                        for d in [round((when(s["completed_at"]) - when(s["started_at"])).total_seconds())]
                        if d >= 1
                    ],
                ]
                for j in js
            ]
        rows.append(row)

    data = {"generated": dt.date.today().isoformat(), "steps": step_names, "runs": rows}
    literal = json.dumps(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    page = PAGE.read_text()
    head, rest = page.split(START)
    _, tail = rest.split(END)
    PAGE.write_text(f"{head}{START} {literal} {END}{tail}")
    print(f"{len(rows)} runs written to {PAGE}")


if __name__ == "__main__":
    main()
