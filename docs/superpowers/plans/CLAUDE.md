# Executing a plan

Rules for any session that executes a plan in this folder, whichever method the owner chose at the plan's handoff (subagent-driven or native). The owner reviews each task as it lands, often remotely, where only pushed changes are visible.

- **After each task:** commit it, `git push` the phase branch, then stop and summarize the task for the owner. Start the next task only when the owner says so.
- **Tick the task's step boxes** (`- [ ]` → `- [x]`) in the plan, in the task's own commit, so the pushed plan shows progress.
- **Never merge.** The PR opens after the last task, or when the owner asks.
- **Plans repeat these rules** in their Global Constraints, so a subagent that only sees its task still follows them.
