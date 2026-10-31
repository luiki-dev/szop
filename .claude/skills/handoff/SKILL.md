---
name: handoff
description: Hands a stage over to a new session. The owner runs `/handoff` to end a stage (writing), and starts the next session with `/handoff resume <branch>` as its first message (resuming). Claude may suggest it at the end of a stage or at about 150–200k of context, but never starts it (ADR 0059, decision 2).
---

# Handoff

Two modes, after [ADR 0059](../../../docs/decisions/0059-session-skills.md), decisions 2 to 5: no arguments writes a handoff; `resume <branch>` picks one up. The rules of the stages are in `docs/development/working-with-claude.md`; this skill only carries the state from one session to the next.

## Writing

1. **Put the work away.** If an edit is half done, finish the step or commit it as work in progress on the branch; never leave anything uncommitted. Push the branch. In the execution stage, bring the ledger in `.superpowers/sdd/<plan>/progress.md` up to date (finished tasks, rulings, the `## Findings` table).
2. **Write `.superpowers/handoff/<branch>.md`**, the branch name with `/` replaced by `-` (`feat/ph-16a-guests-first-list` → `feat-ph-16a-guests-first-list.md`), overwriting an earlier one. The file never names a head that is not pushed. Use this template:

   ```markdown
   # Handoff: <branch>

   ## Stage and next step

   - Stage: <such as "Execution of PH-16a">
   - Next step: <such as "Task 6, not started">

   ## Branch and head

   <branch>; <hash> <subject>; pushed.

   ## Read first

   1. <path> (spec)
   2. <path> (plan)
   3. <path> (the ledger, if any)
   4. <path> (the phase ADR)

   ## Decided in the conversation

   <what the owner decided that no committed document holds yet, one line each; empty is fine>

   ## Waiting on the owner

   <owner steps, reviews or answers the next session must not start without>

   ## Rules for this stage

   <only what goes beyond the repo-wide rules, such as "stop after every task">
   ```

3. **Give the prompt** in a code block of two lines:

   ````text
   /handoff resume <branch>
   <stage>; next: <next step>
   ````

   **In the cloud:** when the owner says the next session runs in the cloud, or this one does (`CLAUDE_CODE_REMOTE` is set), a local file does not survive. Then do not write the file: the prompt carries the file's whole content after the first line, plus what the next stage needs from the ledger: the finished tasks, the rulings and the findings list.
4. **Say where the file is** (its full path) and that the session can be closed.

## Resuming

The first message of a new session is `/handoff resume <branch>`, with the stage and next step on the second line. The branch is given with `/`; find the file under the name with `/` replaced by `-`.

1. **`git status -sb`:** the checkout is clean and on the named branch. If not, stop and tell the owner. Never switch branches in a checkout that holds someone else's changes.
2. **Read `.superpowers/handoff/<branch>.md`**, or the content in the prompt. If neither is there, work from the prompt's second line and the stage's documents. Compare the file's head commit with `git log -1`: on a mismatch, stop, say what the file says and what git says, and wait for the owner to say which to trust.
3. **Read the documents** under **Read first**, in order.
4. **Confirm in two or three lines:** the stage, what is done, the next step, and what waits on the owner. Then wait for the owner's go, unless **Rules for this stage** say to go on.
