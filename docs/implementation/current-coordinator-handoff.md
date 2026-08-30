# Current coordinator handoff snapshot

- 状態: 準備済み・未発効
- 準備日: 2026-08-30
- 発効条件: 次回の利用者承認済みcoordinator交代におけるADR 0030 activation baseline
- 現在のrestart正本: [2026-08-14 利用者主導開発ガバナンス交代引継ぎ](task-handoff-2026-08-14-user-led-governance.md)
- 準備手順: [coordinator handoff効率化runbook](../runbooks/coordinator-handoff-efficient-activation.md)

この文書は次回handoffでbounded current snapshotへ置き換えるための準備物である。現時点ではPM（AirGuardV2）-09のactive ownership、callback、instruction sourceを変更せず、旧handoff文書に代わるcurrent restart正本として使用しない。

## 次回activation時の必須field

- snapshot statusと更新日。
- former/new coordinator名、task ID、host、callback destination。
- direct repository、branch、full baseline、upstream、clean、worktree registry。
- common governance version/hash、generated AGENTS size、specification version。
- current phase、roadmap進捗、current checkpoint。
- 完了済みの機能・migration・test・review evidenceの短い参照。
- 次工程と、仕様・ADR・roadmap・implementationのexact source paths。
- 未統合作業、dirty例外、未検証事項、残存risk。
- application、Rules、deploy、network、remote/data、push/main merge/Prodの承認境界。
- program coordinatorと今後のassignment/callback routing。

## 現在の準備baseline

- coordinator: PM（AirGuardV2）-09 / task `01a0505c-6593-7571-9f4a-65a1e6cd14a3` host `local`。
- repository: `C:\Users\seven\projects\AirGuard\air-guard-v2`、branch `codex/dev-user-reservation-migration`。
- preparation baseline: `83d6811cd60cde218673bd8bb05d5bf0d5d645e5`。
- common governance: `1.4.0` / `d2511f9c2fcb2a90ac43f8c168241fd7cc026da9db1f37b7c66daf10ebfc1d47`。
- prepared specification: `0.5.18`。
- product state、次工程、検証、承認境界は発効前に必ず旧handoff正本と最新Gitから再取得し、この節を置換する。ここにある準備baselineを次回handoff baselineとして流用しない。
