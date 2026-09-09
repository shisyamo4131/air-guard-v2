# 0062 3環境のrisk-based検証選択とDev最終受入れ

- 日付: 2026-09-09
- 状態: Accepted
- 関連仕様: 開発ガバナンスと進捗管理
- 関連判断: [0024](0024-dev-trial-deployment-and-migration-runbook.md)、[0034](0034-codex-bounded-implementation-and-user-ui-acceptance.md)、[0040](0040-impact-based-staged-verification.md)、[0042](0042-risk-based-local-ui-acceptance.md)
- 一部置換: ADR 0034の利用者環境での最終UI受入れ、およびADR 0042のLocal環境選択と最終受入れに関する判断。承認済み実装境界、generated serverの技術条件、Dev・Prod・remote dataの別承認は継続する。

## 背景

検証環境は、Codex専用Local、利用者環境Local、Devの3つに分かれる。Codex専用Localは専用demo project・合成data・Emulator・Codex管理browserを使う局所的な確認であり、利用者環境Localは利用者の`.env.local`・`./saved-data`・Chrome profile・起動processを使う。Devは固定commitを実際のremote serviceへ反映して試用する環境である。

従来は通常の製品改修でLocal確認後にDevへ進み、さらに変更によってはCodex専用Localと利用者環境Localの両方を行う記述が残っていた。この順序では、同じ事項を3環境で繰り返しても保証範囲が増えない一方、検証と利用者確認が直列化する。最終受入れに必要なDev固有のartifact・設定・remote service・data結合はLocalでは保証できない。

## 決定

3環境の役割と保証範囲を次のとおり定める。

| 環境 | 主目的 | 保証する範囲 | 保証しない範囲 |
|---|---|---|---|
| Codex専用Local | Dev前にUI・application統合の問題を発見し手戻りを抑える | 専用build、合成data、専用Emulator、主要UI経路、保存・再表示、外部作用deny | Dev設定、deploy済みartifact、実Dev data・権限・外部service、利用者Chrome固有条件 |
| 利用者環境Local | 利用者固有条件とUXの問題をDev前に発見し手戻りを抑える | 利用者Chrome・profile、`.env.local`、local表示、利用者環境固有の再現、必要なUX判断 | deploy済みartifact、Dev Functions・Rules・Indexes・remote data・外部service |
| Dev | 製品変更を最終受入れする | 固定commitのdeploy済みartifact、対象service・Dev設定、remote認証・通信・権限・対象dataとの結合 | Prod固有状態、未確認の画面・actor・data、全利用者・全dataへの一般化 |

- Codex専用Localと利用者環境Localは任意のpre-Dev検証とし、製品変更の最終受入れまたは完了証拠にはしない。
- 自動testまたは静的検査が必要事項を直接証明する場合、同じ事項のために両Localを追加しない。
- 両Localが同じ事項を証明する場合は、Codexが再現・完結できるCodex専用Localを優先する。
- 利用者環境Localは、利用者Chrome・profile・表示環境、`.env.local`、利用者環境固有の再現、またはDev反映前の利用者によるUX判断が手戻りを実質的に抑える場合だけ選ぶ。
- 両Localを選ぶ場合は、開始前に各環境で異なる証明事項を明示する。
- 製品挙動を変える変更は固定commitをDevへ反映し、対象範囲のDev受入れが成功した時点を最終受入れとする。文書・governance・testだけの変更、Codex専用local toolだけの変更など、Devの製品挙動を変えない変更にはDev受入れを要求しない。
- 関連する変更はreview可能で境界の明確な単位へまとめ、微小な編集ごとにDev deploy・受入れを繰り返さない。
- Devで不具合が判明した場合は、原因と再現条件に対応する自動検証またはLocalだけへ戻り、両Localを自動的に再実行しない。修正後は新しい固定commitをDevへ反映して対象範囲を再確認する。

代表的な選択は次のとおりとする。実際の選択は変更差分と必要な証明事項を照合して決める。

| 変更 | Codex専用Local | 利用者環境Local | Dev |
|---|---|---|---|
| 文書・governanceだけ | 不要 | 不要 | 不要 |
| UIを変えない内部logic | 自動検証に不足がある場合だけ | 原則不要 | 製品変更なら必要 |
| 既存UIの内部改修 | UI結合に不足がある場合だけ | 原則不要 | 必要 |
| 新画面・新操作・UX変更 | 原則実施 | Dev前に利用者判断が必要な場合 | 必要 |
| Functions・Rules・schema | UI経路も変わる場合だけ | 原則不要 | 必要 |
| Dev設定・Indexes・外部service | 原則不要 | 原則不要 | 必要 |
| 利用者Chrome固有の不具合 | 補助的な切り分け | 必要 | 修正後に必要 |

## 理由

環境ごとに得られる証拠が異なるため、実行回数ではなく必要な保証から選ぶ方が、重複を減らしながら見落としを防げる。Localは短いfeedback loopに適し、Devは実際のdeploy artifactとremote構成を確認できる。最終受入れをDevへ統一すると、完了判断が実利用経路と固定commitへ結び付く。

## 代替案

- 3環境を毎回すべて実行する案: 同じ事項の重複確認が増え、変更riskと無関係に作業が直列化するため採用しない。
- Localを一切行わず常にDevだけで確認する案: UI・application統合や利用者固有条件の早期発見が有効な変更で手戻りが大きくなるため採用しない。
- 利用者環境Localを最終受入れとする案: deploy済みartifactとDev固有の設定・remote service・data結合を保証できないため採用しない。
- Codex専用Localを全製品変更の必須gateとする案: UIを含まない変更や自動検証で十分な変更にも同じ環境準備を要求するため採用しない。

## 影響

- checkpoint: 証明事項、自動検証、選択した環境と選択理由、各環境の結果、選択しなかった環境の理由を記録する。
- 利用者: 利用者環境Localは利用者固有条件またはDev前のUX判断に集中し、同じ操作を一律に繰り返さない。
- Codex: 自動検証後に残る不確実性からLocal環境を選び、製品変更をDev受入れ前に完了と報告しない。
- release: 関連変更をbounded Dev releaseへまとめ、固定commitと対象範囲へ受入れ証拠を結び付ける。
- product/data: 本判断だけではapplication、Firebase設定、Rules、schema、Dev・Prod dataを変更しない。

## 互換性

既存の自動test、Codex専用Local、利用者環境Local、Dev runbookの実行方法と安全境界は維持する。変更するのは各環境の選択条件と最終受入れの位置付けである。既存のimmutable verification receiptは取得時点の履歴として保持し、新判断へ書き換えない。

## 移行

project rules、開発workflow、3環境のrunbook、operations、仕様のrouting、document・runbook索引、ADR 0034・0042、CHANGELOGを同期する。`governance/verification-policy.json`はrepository command gateの機械可読正本であり、環境受入れの選択は別の証拠判断なので変更しない。

## Rollback

重複検証の増加、Dev受入れの過大化、Localで発見できたはずの回帰増加が確認された場合は、history rewriteを使わず本ADRと現行ruleをcorrective commitで修正する。個別の変更では、必要な証明事項を明示したうえでLocal検証を追加できる。

## 検証

- 現役文書にLocal完了をDevへ進む一律条件とする記述、または利用者環境Localを製品変更の最終受入れとする記述が残らないこと。
- 3環境の目的、保証範囲、非保証範囲、選択条件がproject rules、operations、runbookで一致すること。
- 製品変更のDev最終受入れと、Devを要求しない非製品変更が区別されていること。
- 自動検証の`governance/verification-policy.json`と環境検証の選択が別の判断軸として説明されていること。
- project documentation、managed governance、capacity regression、差分形式のcomprehensive gateが成功すること。

## 再検討条件

Dev以外が実際の最終提供環境になった場合、利用者環境Localでしか発見できない不具合が継続的に増えた場合、Codex専用browser・Emulatorの保証範囲が変わった場合、Dev deploy頻度またはrelease単位が手戻りを増やしている実測が得られた場合。
