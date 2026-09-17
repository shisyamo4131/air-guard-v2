# SCR Local verification receipt（2026-09-17）

- Evidence-producing UI checkpoint: `SCR-LOCAL-UI-01`
- Documentation checkpoint: `SCR-LOCAL-DOCS-02`
- Repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`
- Branch: `codex/scr03-10-standard-crud-prelocal`
- HEAD under test: `082d9d70b0289eb73d66958970a83b720da10d4b`
- Evidence type: immutable receipt for the reported Local verification session. This receipt separates previously executed automated evidence from the interactive Local UI smoke and cleanup report.
- Scope: documentation of Local verification only. No product score or completion status is changed by this receipt.

## Previously executed automated evidence

The following results were reported as completed before this documentation closeout; they were not rerun in this documentation checkpoint.

| Command / gate | Result | Exit |
|---|---|---:|
| `npm run test:local` | 135/135 | 0 |
| `node --test test/domain/*.test.mjs` | 1302/1302 | 0 |
| `npm run test:local:ui:build` at HEAD `082d9d70b0289eb73d66958970a83b720da10d4b` | completed | 0 |
| `pwsh -NoProfile -File scripts/check-project-docs.ps1 -RepositoryRoot C:\Users\seven\projects\AirGuard\air-guard-v2` | TOML 8, Markdown 325, ADR 74, roadmap 13 | 0 |

## Interactive Local UI smoke and diagnostic findings

- `/billings/operations` (SCR-05) rendered without a registration/create control.
- `/sites` and `/employees` rendered normally, but no target rows were available.
- The dedicated saved snapshot did not contain `System/system`; consequently `isSystemMaintenanceOff()` produced a Null value error and prevented Customer create.
- The actor Auth/User baseline was independently confirmed valid, so an Auth/User mismatch was excluded. Whether a product defect exists is not decided by this smoke.
- No business data was created. `System/system` injection or setup was not approved or added as a procedure.
- SCR-03/06/07/10 write acceptance remains unverified. SCR-04/08/09 received no additional UI evidence. SCR-09 Callable behavior and existing acceptance remain unchanged.

## Cleanup and process status

- Browser was closed.
- Server process exit after Ctrl-C: 1.
- Emulator process exit after Ctrl-C: 1; its log reported clean shutdown.
- Cleanup success was established by no target-port LISTEN, unchanged dedicated and user saved-data fingerprints, and removal of `.output`.
- The verification session's worktree was clean before this documentation update.

## Explicitly out of scope

Restore, legacy/server-adapter, future lifecycle, Prod, remote deployment, migration, repair, and any score/product-completion update are outside this receipt. The receipt does not authorize baseline `System/system` injection or setup.
