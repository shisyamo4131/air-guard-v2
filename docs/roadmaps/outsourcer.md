# Outsourcerマスター改修ロードマップ

- 目標: 特定の協力会社を表すOutsourcer masterについて、同一tenant内の権限、保存契約、契約終了、archive、検索・表示、重複配置を段階的に整合させる。
- 確認済み業務境界: Outsourcerは外注警備員個人ではなく協力会社masterである。同じOutsourcerを一つの配置へ複数回登録できる。Outsourcerと人数を一組にして集約する方式は採用しない。
- 現在の進捗: 0%
- 部分加点: 行わない。各phaseの完了条件をすべて満たした時点で当該重みを加点する。
- 環境境界: OUT-01はlocal実装・検証までを対象とする。Dev反映・remote/data確認はマスタ改修後の別承認checkpointまで行わない。

## マイルストーン

| マイルストーン | 重み | 得点 | 状態 | 内容と完了条件 |
|---|---:|---:|---|---|
| OUT-01 更新権限と破壊操作停止 | 15 | 0 | In progress | 会社管理者またはstrict `manager`だけが作成・編集でき、UIとRulesが一致する。client deleteとarchive writeを拒否し、対象domain、Emulator、local UI build、文書検証を完了する。 |
| OUT-02 保存data契約 | 15 | 0 | Proposed / 未承認 | 許可field、型、長さ、status、system metadata、exact field update、draft・競合契約を合意する。 |
| OUT-03 契約終了と候補 | 10 | 0 | Proposed / 未承認 | 新規配置・実績と過去訂正でACTIVE／TERMINATEDをどう扱うか、終了日の要否を合意する。 |
| OUT-04 archive・restore安全性 | 20 | 0 | Proposed / 未承認 | Schedule、OperationResult、ArrangementNotification等の参照、並行作成、過去表示、archive対象、restore、保持を合意する。 |
| OUT-05 code・検索・一覧表示 | 10 | 0 | Proposed / 未承認 | code方針、検索対象、取得件数とpagination、Autocomplete renderer、終了済み表示を整合する。 |
| OUT-06 協力会社masterと重複配置の互換性 | 10 | 0 | Requirement confirmed / 実装未着手 | 協力会社masterの同一IDを複数配置明細へ登録できることを維持し、人数集約や個人masterへ変更していないことを対象回帰で確認する。 |
| OUT-07 local統合確認 | 10 | 0 | Proposed / 未承認 | 権限別UI、Rules陰性、配置・通知・実績・請求・帳票の必要な対象回帰、文書とrollbackを確認する。 |
| OUT-08 Dev反映・受入れ | 10 | 0 | Deferred / 別承認 | 他のマスタ改修とまとめたbounded Dev releaseで、旧client・既存data・権限別操作・関連操作を確認する。 |

## OUT-01の確定範囲

- readは現行の同一tenant境界を維持する。
- create、update、`contractStatus`変更は、認証UIDとUser document IDが一致する同社の有効な本登録会社管理者、またはnon-super-userかつ既知presetがexactに`manager`であるUserだけに許可する。会社管理者かつsuper-userは会社管理者を根拠に許可する。
- non-admin super-user、controller、accountant、その他preset、直接permission文字列、未知または混在role、仮登録、無効User、他tenantはwriteを拒否する。
- live deleteは全clientで拒否し、`Outsourcers_archive`のclient writeを全て拒否する。archive readは現行どおり維持する。
- UIはread-only actorへ作成・編集・削除を表示せず、write actorにも削除を提供しない。create/update transport直前に同じ純粋policyを再評価する。
- Firestore Rulesの広いfallbackからlive/archiveを除外し、個別Rulesを迂回できないようにする。
- schema、data shape、Functions、migration、検索、pagination、個人外注警備員、archive/restoreの正式policyは対象外とする。

## OUT-01の互換性・rollback・検証

- 既存document、path、ID、配置明細、下流readを変更せず、data migrationは行わない。
- controller・accountant等のreadは維持するが、従来到達できたwriteは意図的に拒否する。manager・会社管理者の作成・編集は維持する。
- rollbackはclientとRulesのreview済み変更を対で戻す。ただし既知の広いwriteを再開するため、検証失敗時はwriteを広げずlocalで停止する。
- 変更classは`ui-css-layout`、`application-logic`、`data-contract-schema-migration`の和集合とする。completion gateは`project-docs`、`domain-full`、`local-emulator-suite`、`local-ui-build`、`diff-check`である。

## 未確認・別承認

- Dev・Prodの現在Rules、remote Firestore、既存Outsourcer/archive件数、実利用actor、旧client併存は未確認である。
- OUT-02以降の具体仕様、Dev/Prod、remote/data、migration、deploy、package変更は未承認である。
