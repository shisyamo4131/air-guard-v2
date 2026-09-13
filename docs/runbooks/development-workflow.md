# 開発workflow runbook

- 状態: 運用中
- 最終確認日: 2026-09-12（文書整理）
- 役割: 承認済みcheckpointの開発・review・検証、UI契約の適用、Rules cutoverの実行手順

## 担当と変更単位

- 担当、subagent、並列化、writer、Git境界は[Coordination and Git rules](../project-rules/coordination-and-git.md)、承認・環境・local UI境界は[Environment and approval rules](../project-rules/environment-and-approval.md)を正とする。本runbookは承認済みcheckpointの実行順だけを定め、scopeや権限を拡張しない。
- 通常は承認済みsegment単位で連続実装・検証し、変更挙動、security境界、test、残存risk、rollback、利用者確認項目をまとめる。application fileごとの利用者確認はcheckpointが明示した場合だけ行う。
- 認証・認可・tenant分離は一括改修せず、独立して説明・review・rollbackできる最小segmentを1件ずつ扱う。

## 試行段階の高速な開発loop

1. 現行挙動、actor・tenant、data影響、失敗経路、対象・対象外、rollback、受入れ条件を一つのcheckpointへまとめる。[フェーズごとのテスト範囲の合意](../project-rules/development-and-data.md#フェーズごとのテスト範囲の合意)に従い、利用者と変更・テストの範囲、環境・data、期待結果、完了条件を着手前にすり合わせる。他機能の受入れを自動追加しない。
2. 下記[segment contract](#必要十分なdata設計)を材料に、実装可能性とtest・失敗経路の2視点を原則並行で独立reviewする。目的に対するscopeの過大・不足、完了条件の十分性、未確認事項の扱いを判定に残す。security境界またはproject rulesの高risk境界を含む場合はsecurity視点を追加する。対象には認証・認可・tenant、Firebase Rules、秘密情報、個人・顧客・勤怠・請求・Stripe・通知、削除・外部作用を含む。
3. review指摘を設計へ反映してから実装する。実装中は直接影響する静的確認と対象testから始め、当該phaseの代表操作を保存・再読込・失敗時の挙動まで確認する。UI非対象なら該当処理境界までとし、最終統合へ初回確認を集中させない。問題の扱いは上記scope規則に従い、設計変更時だけ変更範囲を再reviewする。
4. [フェーズごとのテスト範囲の合意](../project-rules/development-and-data.md#フェーズごとのテスト範囲の合意)と[3環境の選択基準](../project-rules/environment-and-approval.md#local-emulatorとlocal-ui)に従い、自動検証で残る不確実性を直接減らす場合だけCodex専用Localまたは利用者環境Localを選ぶ。自動検証で十分な変更はLocalを省略してDev release判断へ進める。
5. segmentの最終状態に対して影響範囲の回帰と、選択済みcompletion gateを1回実行する。phaseまたはreleaseの完了に包括testが必要な場合も、この最終実行へまとめる。後続変更で失効していない証拠と、上位gateに含まれる下位gateは再実行しない。
6. 既存Dev documentへの状態確認・migrationの要否は[project rulesの3条件](../project-rules/development-and-data.md#dev試用中の既存document)に従う。製品変更は固定commitのDev受入れを最終受入れとし、checkpointまたはfeature boundary単位で行う。利用者環境Localは、Dev前の利用者固有条件またはUX判断を別途証明する場合だけ追加する。
7. 結果が確定した後、現在値は該当する一つの正本、実行結果はimmutable verification receipt、履歴はCHANGELOGへ一括して記録する。索引は値を複写せず正本へリンクする。
8. 記録だけの後続編集では、その編集で失効したgateだけを再実行する。製品codeが変わっていないことを理由に、既に有効な製品testを繰り返さない。

このloopは[Verification Matrix](../operations.md#verification-matrix)と`governance/verification-policy.json`のiteration、targeted、completion、release-only区分を実行順へ落としたものである。文書責務は[ADR 0041](../decisions/0041-single-source-documentation-and-final-validation.md)に従う。既存の安全境界や外部作用の承認は緩和しない。

発見時は必要最小限の切り分けを行う。後続へ送る独立問題は[既存FUT](../implementation/future-actions.md)へ同一原因を統合し、発見phase、再現根拠、影響、現在phaseを妨げない理由、対応予定を記録する。未確認は明示する。その修正phaseの冒頭で対象一覧・方針・影響・test範囲・Dev反映を止める問題を利用者と一括確認し、対象確定後に設計review・実装・検証を行う。新たな発見も同じ分類に戻し、最終統合確認へ未承認の修正を混ぜない。現scope内の通常修正は既存checkpoint内で継続する。

## 非同期UI操作のerror・loading責務

1. 操作がManager管理下のCRUDか独立操作かを分類し、[現行仕様のerror・loading契約](../specification.md#非同期ui操作のerrorloading責務)に対応する既存経路へ接続する。
2. 成功、失敗、取消、処理中と再操作を対象testへ含め、error伝播、通知の二重登録、loading解除、失敗後のdialog状態、安全なmessageを照合する。Manager接続は[入力component契約](../specification.md#editorと入力component)に従う。
3. 基盤全体の将来整理は[FUT台帳](../implementation/future-actions.md)のFUT-0136・0137・0139・0181へ同一原因を統合する。対応優先度と未解決の安全上の不具合は各FUTを正とし、本手順へ複写しない。

## Client操作policyとcomposableの責務

1. [現行仕様のclient操作policy](../specification.md#client操作policyとcomposableの責務)と[通常業務・例外の境界](../specification.md#テナントと認証)から、対象operationで必要な事前判定とserver検証を特定する。
2. 既存機能は一括移行せず、新規機能と改修対象機能からpolicy、composable、component接続、server共通条件parity testを小segmentで追加する。
3. 表示と送信直前の判定、拒否時の送信抑止、例外APIの非認可検査と標準error経路を、適用対象の契約へ照合する。判断理由は[ADR 0019](../decisions/0019-client-operation-policy-composable-boundary.md)を参照する。

## Firestore Rulesを狭める改修順序

判断理由は[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)を正とする。Rules変更だけを無条件に先行releaseせず、次を確認してcutover方式を選ぶ。

1. 対象pathと全caller、whole-document replacement、対象環境、既知のdata規模、旧client併存、許容停止時間、外部作用を確認する。既存Dev dataの追加取得は[project rulesの3条件](../project-rules/development-and-data.md#dev試用中の既存document)で必要な範囲に限る。migrationを行う場合は対象件数を実確認する。
2. 将来Rulesが許可するpath、actor、operation、schemaと、通常のdocument単位last-write-winsまたは例外operation固有の競合制御を固定して実装・検証する。Prod公開後のfield単位方式を別途採用した場合だけ、変更top-level fieldのexact updateを要求する。
3. 新規pathは最初のdocument作成前にclient denyを確立する。候補Rulesのlocal実装・Emulator成功だけをdeploy readinessとみなさない。
4. 正式release前のDevで全件を一つのbounded maintenance内にbackup・変換・post-checkでき、旧clientを継続利用しない場合は、Rules、Functions、client、migrationを同じmaintenanceのcoordinated cutoverとして扱う。長期互換層、runtime mode、dual reader/writerを既定にしない。
5. production、複数client version、許容できない停止、bounded maintenanceへ収まらない件数・外部作用がある場合だけ、現行Rules下へ将来CRUDを先行導入し、旧・候補Rules双方の回帰、既存機能継続、旧writer 0件後にRulesを閉じる互換releaseを採用する。
6. deploy後は対象方式に応じ、Rules receipt、許可・拒否経路、migration post-check、主要UI、rollback先を確認する。

既存許可を直ちに閉じないとdata exposureが継続する緊急incidentは通常手順の例外とする。影響する機能、停止範囲、暫定対応、rollback、陰性testを固定した別checkpointとして利用者の明示承認を得る。

## 必要十分なdata設計

data構成と分割条件は[現行仕様](../specification.md#firestoreドキュメントの構成)、段階移行は[Development and data rules](../project-rules/development-and-data.md#実装原則)、通常更新と例外の競合制御は[現行仕様](../specification.md#firestoreドキュメントの同時更新)を正とする。判断理由は[ADR 0031](../decisions/0031-proportional-data-boundary-and-change-safeguards.md)と[ADR 0066](../decisions/0066-pre-production-document-level-last-write-wins.md)を参照する。本runbookでは承認済み設計を下記segment contractへ落とし込む。

認証・認可およびCRUD改修は、既存の機能設計へ次のsegment contractを揃えます。対象外項目は理由を示し、独立した書式文書は増やしません。

```text
segment: <一つの入口・権限・data境界>
objective: <当初目的、維持・廃止する挙動。Air managerを利用・再利用・不使用とする範囲>
current-behavior: <codeとtestから確認した現行挙動>
dependencies: <実際の呼出元・保存先・背景処理・cache等の副作用と根拠>
ui-data-flow: <page/root/child、useFetch origin・inject、主対象listener、従属cache、missing表示>
threat-or-failure: <actor、前提、操作、影響>
in-scope: <今回変更するfile・rule・contract>
out-of-scope: <後続segmentへ残す境界>
proposed-contract: <許可・拒否・状態遷移、通常のdocument単位last-write-winsまたは例外固有の競合制御、従属CRU・削除時検査>
compatibility-and-data: <既存利用者・data・migrationへの影響>
rollback: <code、rule、data、外部作用を戻す条件と方法>
tests: <許可経路、拒否経路、tenant境界、失敗経路>
acceptance: <条件ごとの操作・data前提・期待結果・確認方法。関連する旧形式/初期選択済み/空cache等を選び、必要な環境を照合>
unknowns: <未確認事項と設計・完了への影響。妨げるものは実装前に解消または利用者判断>
user-confirmation: <実装前判断と実装後確認>
```

開発環境:

```powershell
npm run dev
```
