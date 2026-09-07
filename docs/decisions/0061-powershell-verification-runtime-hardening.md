# ADR 0061: PowerShell検証runtimeとNorton再検知防止境界

- 日付: 2026-09-07
- 状態: Accepted
- 対象: repository-owned PowerShell gate、検証fixture、local補助script
- 関連: [検証policy](../../governance/verification-policy.json)、[検証運用](../operations.md)、[実測記録](../verification/norton-powershell-gate-hardening.md)、[旧runtime判断](0045-governance-3-normal-startup.md)

## 背景と変更前

repository-owned gateと一部のnpm scriptはWindows PowerShell 5.1を`-ExecutionPolicy Bypass`付きで起動していた。ドキュメント検証には日本語文字列のBase64復号、容量回帰fixtureには別の`powershell.exe`起動が含まれていた。利用者のNorton履歴では`IDP.HELU.PSE90`のふるまい検知に`powershell.exe`とTemp内の`__PSScriptPolicyTest_*.ps1`が記録されていた。履歴だけではBase64やfixture操作の単独因果は確定できないが、旧構成の組合せを継続する安全根拠は不足していた。

## 決定と理由

必須runtimeをPowerShell 7 Coreの`pwsh`へ変更し、repository-owned gateは`-NoProfile`で起動する。`-ExecutionPolicy Bypass`、`-EncodedCommand`、検証文字列を復元するBase64 decode、legacy `powershell.exe`の子process起動を使用しない。容量回帰は同一process内で対象scriptを呼び、Hashtableで名前付き引数を渡す。

Temp fixtureは一意の隔離directory、許可root内であることのcleanup前検証、finally cleanupを維持する。Temp fixtureを含む正負検証でNortonの新規検出が発生しなかったため、fixture自体は廃止しない。

## 影響と互換性

- ADR 0045のWindows PowerShell 5.1維持判断だけを置換する。通常startup、comprehensive 5 gate、検証classと証拠規則は維持する。
- repository-owned PowerShell gateとPowerShellを起動するnpm scriptはPowerShell 7が必要になる。
- 製品logic、UI、Firestore、Functions、Rules、schema、Dev/Prod、remote、実dataは変更しない。
- 過去のverification receiptやmigration記録に残る旧commandは時点証拠として書き換えない。

## 代替案

Windows PowerShell 5.1から`Bypass`だけを外す案は、検出履歴に記録された`powershell.exe`とpolicy test fileの組合せを残すため採用しない。全PowerShell scriptのNode移植は変更量が大きく、既存検証能力を保つため採用しない。Temp fixtureの全面廃止は負例と境界条件の検証を弱めるため採用しない。

## 移行・検証・rollback

Base64文字列をBOM付きUTF-8 literalへ置換し、容量回帰の子processを同一process呼び出しへ変更する。通常ドキュメント検証、Tempを使う負例検証、容量回帰を個別実行し、各段階後に利用者がNorton履歴の新規`IDP.HELU.PSE90`不存在を確認する。最終状態はpolicy指定のcomprehensive 5 gateで検証する。

PowerShell 7で同等の検証結果を得られない、またはNortonが再検出した場合は完了扱いにせず、影響するPowerShell gateを停止する。rollbackする場合も`Bypass`付きWindows PowerShellへは戻さず、Node等の非PowerShell runnerへの移行を別判断として行う。

## 再検討条件

PowerShell 7が利用できない実行環境を正式対応する場合、Nortonその他のふるまい検知が再発した場合、または同一process呼び出しで検証分離を維持できなくなった場合。
