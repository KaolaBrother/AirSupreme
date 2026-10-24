# Issue #15 publication summary

## Delivered

Android/HarmonyOS-only static opaque player aircraft batching shared across chapters 1–10. Same materials and 3732 triangles; opaque meshes 79→9, transparent meshes remain 17. Existing StaticBatcher handles transformed geometry and mirrored winding. Partial batching failure retains the original model. Glass, lights and dynamic exhaust remain separate. iOS/unknown platforms and menu callers keep the original model path; no quality, DPR, frame pacing or camera changes.

Candidate: baseline 65ae78de00dd700813a24f5d9067df1bcd0cc9b0 plus the issue-15 production diff. Host reviewed the final diff, StaticBatcher and CameraRig: the complete constructed player subtree is assigned to the exterior layer, so FP visibility behavior is unchanged.

## Acceptance and owner exception

Yanlei on 2026-10-24 explicitly authorized merge into main and push origin/main after Host wrap-up, skipped physical-device UAT for this delivery, and instructed not to wait for absent Devin/Opus Fusion review. Host accepts publication based on unchanged source, existing independent tests, build/type/lint gates and source review. No launchd, service or remote deployment configuration changes are authorized or performed.

New independent tests for the platform gate/player batching combination were not authored; the implementation author did not write its own tests. This coverage remains unverified and mission 4 is handed over to the existing open #15. Issue is intentionally kept open to preserve this coverage record. Physical-device FP/TP improvement and iOS visual/performance non-regression were not measured; mission 5 is owner-waived, not a test PASS. Mesh reduction is not an FPS result.

## Evidence

Existing commands at unchanged production source hashes: `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`, all exit 0. 169 test files, 8072 passing tests, 2 skipped. Build has the existing vendor-three chunk-size warning. Evidence under main `.kaola/run/android-smoothness/candidate-gates/`: results.json, source-hashes.json and command logs. Final wrap-up changes only docs/run records.

Source SHA256:
- src/config.ts: 89fc41d1d7af7eab3f886aeadc995e425f463a9b67ec7a9ef8be9cf0e1445412
- src/core/GameCoordinator.ts: 6a410246e21948be873a7d9df9fc1ee8ca1aeefee8199c4532f2fc6c952511f2
- src/features/aircraft/AircraftMeshFactory.ts: 7c8a713d7a325326bfd9cb48c0781f9c9ae7cc83762bc8251bf9cdb3d8e8aee6

Desktop baseline evidence at baseline commit: desktop-profile-report.md and desktop-profile-evidence/ contain 30 primary windows and 8 overhead windows on macOS hardware GPU; chapter8 FP draw medians78–86 versus TP165–169 at roughly60FPS. These synthetic, unmatched-load desktop measurements establish neither Android gains nor iOS non-regression. Temporary browser tab, 4175 server and collector were removed; original8080 untouched. Workers exact-stopped; no duplicate dispatch.

## Validation

classification: final_validation_stale
green: false
mode: final-validation

recorded validated_candidate_hash "8c35646044c566ccacc0126a0bd658f052dc0167b7381b22d16e96478ba22f4b" != current code-tree hash "a6c85dfa0710477750703559fe40a432a27d2dfdf7af9f99be0451753463cccd" — a relevant source/test/test-consumed file changed after the recorded validation; re-run the validation command and re-record final-validation.md with a fresh hash

A relevant source/test/test-consumed file changed after validation — or the record was written from a different checkout than this one. Re-run the validation command, then re-record with `kaola-workflow-validation-runner.js record --project <project> --verdict pass --command "<the validation command you ran>"`, invoked from the working tree you validated (the gate hashes the tree its own shell is in, and a linked worktree and main differ until the branch merges); never hand-patch the hash.

## Changed Paths

Files this branch changed outside the kaola-workflow/ run-state band:

- CHANGELOG.md
- IMPLEMENTATION_PLAN.md
- docs/api.md
- docs/architecture.md
- src/config.ts
- src/core/GameCoordinator.ts
- src/features/aircraft/AircraftMeshFactory.ts

## Follow-Up Items

- Existing #15 retains unverified independent new-branch coverage. No new defect established and no new issue filed.
- Physical-device UAT explicitly skipped by owner for this release; no device evidence claimed.
- Devin maintenance recovery unavailable due to missing CLI; no installation, auth repair or limited-pool retry. This is not a publication blocker under the owner update.

## Readiness

Ready for owner-authorized merge and push using the normal Workflow merge sink with #15 kept open. Preserve unrelated main Vite-cache changes and other worktrees. Publication and cleanup are established by sink receipts, not by this readiness statement.

## Finalize Findings

### residue_stage_failed

The `chore: finalize` commit could not stage the finalization residue: `git add` exited non-zero, and the transaction recorded `finalize_commit: nothing_to_commit` — the run reports closed while work may still be uncommitted in the worktree.

Every path this call was given did reach the index despite the non-zero exit.

git said:

```
The following paths are ignored by one of your .gitignore files:
node_modules
hint: Use -f if you really want to add them.
hint: Disable this message with "git config set advice.addIgnoredFile false"
```


## Post-transaction reconciliation

The finalize transaction accidentally mirrored and committed three pre-existing main Vite-cache files as f4957e2. Host reverted that entire unrelated commit with f74b38a before publication. `git diff 1c6c5e9 HEAD` is empty after the revert: the complete candidate tree is identical to the implementation commit, and main's original cache modifications are preserved. The transaction's historical stale-validation finding is retained above; it describes the transient cache-residue tree, not the restored candidate. The recorder refuses retroactive edits after archive, so no validation hash was hand-edited. Existing source-hash-bound test/build results remain applicable.

## Sink Findings

post_rebase_tests: skipped

archived_paths:
- kaola-workflow/archive/issue-15/.cache/final-validation.md
- kaola-workflow/archive/issue-15/.cache/origin/selection-record.json
- kaola-workflow/archive/issue-15/finalization-summary.md
- kaola-workflow/archive/issue-15/mission-ledger.jsonl
- kaola-workflow/archive/issue-15/workflow-state.md
