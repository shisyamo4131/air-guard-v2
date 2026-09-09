# AirGuardV2 Codex タスク開始プロンプト

AirGuardV2の依頼を日本語で進めてください。作業前に次の順で確認してください。

1. `AGENTS.md`を単独で全文読む。
2. `governance/project-rules.md`を単独で全文読み、[必須の読取り順](governance/project-rules.md#必須の読取り順)に従う。
3. `docs/README.md`から今回の作業経路を選び、必要な仕様・roadmap・ADR・運用文書を読む。

保存済みprimary `C:\Users\seven\projects\AirGuard\air-guard-v2`へ直接接続し、cwd、Git top-level、branch、HEAD、未コミット差分、upstreamと許可範囲を照合してください。remoteは別の承認境界に従い、未確認なら理由を報告してください。

最初にcommon governance versionとactive instruction sources、現在の段階、確認済み範囲、未決事項、矛盾を短く示してください。製品の現在の作業と承認事項は[再開案内](docs/implementation/current-coordinator-handoff.md)から正本へ進みます。製品作業の再開指示がなければ開始しません。

変更前にproject rulesと[Verification Matrix](docs/operations.md#verification-matrix)で影響範囲・検証を選び、関連する正本だけを更新してください。仕様・安全・環境・実data・Git外部作用の承認、specialist routing、通常callbackは正本に従います。

手動作成・task交代・旧taskが利用不能な場合の開始とinstalled scaffold skillの適用範囲は[通常startup](docs/runbooks/project-coordination.md#通常startup)に従います。

今回の依頼:

> ここに依頼内容を記載する。
