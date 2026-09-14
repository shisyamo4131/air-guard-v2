# 標準CRUD整合ロードマップ

- 状態: Planned
- 開始日: 2026-09-15
- 現在の進捗: 0%
- 目的: [棚卸し](../implementation/operation-crud-simplification-inventory.md#2026-09-15の実装棚卸し)で確認した専用保存経路・Rules・クラス契約の差を、一つずつ承認済み仕様へ揃える。
- 開始基準: local main `048e44e9cfd4ca887ec328e7e835c291579e68af`と、同基準で調査した2026-09-15の棚卸し。
- 作業branch: `codex/standard-crud-alignment`。本書の棚卸し解消を範囲とし、checkpointごとに差分・検証・Git統合を閉じる。
- 今回の成果範囲: branchと実行計画の作成。製品実装・package変更・deploy・実data操作は未実施。
- 要件の正本: [標準CRUDと後続処理](../specification.md#標準crudと後続処理)、[画面別lock](../specification.md#稼働実績ロックと画面別操作)、[archive・restore](../specification.md#ドキュメントのアーカイブと物理削除)。本書で新しい機能要件を追加しない。

## 既存計画との関係

本書は[FGAロードマップ](foundational-governance-alignment.md)のうち、2026-09-15の仕様回答に対応する棚卸し解消の実行計画である。この範囲の順序・状態・完了証拠は本書だけで更新する。FGAの過去完了checkpointは当時の証拠として保持し、新仕様の達成へ読み替えない。

本書の進捗は今回の追加整合だけを測る。FGAおよび[製品全体](airguard-v2.md)の得点とは合算・平均しない。親phaseの加点・再評価は、その完了条件と証拠を満たした時に親の正本で行う。

既存の `FGA-06-SCHEDULE-MANAGER-RESTORE-09` の画面再受入れと `FGA-06-TRANSACTION-PARENT-INDEPENDENCE-10` のprojection・Dev復旧は、FGAの未完項目として保持する。本書のSCR-06〜08で共有するcode・Rules・画面・Triggerの証拠は相互参照し、同じ修正や受入れを二重に計上しない。実data repairを通常CRUD改修へ混ぜない。

## 解消順とマイルストーン

重みは各checkpointの完了を数えるための均等配点で、工数・riskの見積りではない。合計100、checkpoint内の部分加点なし。製品の実装・必要な検証・対象範囲のDev受入れが揃うまで0点とし、計画作成だけでは加点しない。

| マイルストーン | 重み | 得点 | 状態 | 完了条件・対象となる確認 |
|---|---:|---:|---|---|
| SCR-01 Customer archive・restore整合 | 10 | 0 | Planned | 既存archive入口をManager／Classへ接続し、従属あり拒否・なし移動、同ID標準restore、tenant境界、旧envelope互換性を確認。専用writerと対象Rulesを一体で整合し、通常CRUDを維持する |
| SCR-02 Site手動終了・再開 | 10 | 0 | Planned | 終了・再開の既存業務条件と標準クラスを照合し、入口・保存・Rulesを整合。自動終了system処理と終了後の通常編集条件を維持する |
| SCR-03 Site archive・restore整合 | 10 | 0 | Planned | Siteの従属hook、標準移動・復旧、旧形式を照合し、既存入口とRulesを整合。SCR-01の共通確認は有効な範囲だけ再利用する |
| SCR-04 Employee退職・訂正とAuth分離 | 10 | 0 | Planned | beforeUpdateの状態拒否とtoTerminated内のUser削除を含むClass契約を確認し、業務更新と厳密なUser/Auth処理を分離。退職・誤退職訂正、連携Userあり／なし、失敗時の状態を検証する |
| SCR-05 Employee archive・restore整合 | 10 | 0 | Planned | SCR-04の分離結果を前提に、従属あり拒否・標準移動復旧・Rulesを整合。archiveからUser/Auth・従属documentを連鎖削除しないことを確認する |
| SCR-06 稼働請求・実績lock・稼働外売上 | 10 | 0 | Planned | 取極め・調整・lock等を既存OperationBilling／OperationResultの標準保存へ接続し、共有Rulesを整合。画面別操作表、経理画面アクセス、稼働請求からの実績削除禁止、請求・勤怠等への後続反映を検証する |
| SCR-07 予定から実績化 | 10 | 0 | Planned | Generatorを標準syncToOperationResultへ接続し、同ID実績作成・予定更新・通知実勤務値反映・作成Rulesを整合。旧convert callerを撤去し、既存実績作成を回帰確認する |
| SCR-08 配置通知の状態更新・編集 | 10 | 0 | Planned | Managerと本人向け確認・上番・下番を標準クラスへ接続し、独自期待値比較・patch transactionを整理。時刻・実勤務値・表示収束と既存通知生成条件を検証する |
| SCR-09 Billings入金予定日 | 10 | 0 | Planned | 提供済み編集をManager／Classへ接続し、Rulesと旧比較testを整合。保存・再表示・失敗、tenant境界を検証する |
| SCR-10 請求確定・確定後CRUD | 10 | 0 | Planned | 未提供UI・issuer snapshot等の確認残を具体化し、合意した提供操作を標準CRUDで実装。確定後の直接編集・請求document削除と、元実績の非削除を検証する |

この表の順に1件ずつ閉じる。Siteの状態変更とarchive、Employeeの状態変更とarchiveはそれぞれ別checkpointにし、先行分の完了証拠を後続へ渡す。SCR-06と07は同じOperationResults Rulesを扱うため並列編集せず、後続着手時に先行変更との整合を確認する。

## 各工程で先に解消する確認残

- SCR-01・03・05: 標準restoreの基盤と製品UIの提供範囲を区別する。未提供UIを自動追加せず、必要な入口は当該checkpointで具体化する。旧archiveと新標準形式の互換性・対象dataへの影響を確認し、変換が必要なら対象・方法・復旧を確定してから実行する。標準restoreが旧envelopeをそのまま扱えるとは想定しない。
- SCR-02: 標準クラスの終了・再開条件が現行仕様と一致するか確認する。既存Callableがあること自体を例外維持の根拠にしない。
- SCR-04: 別packageの変更が必要か、業務状態と認証処理をどう分離するかを先に設計する。必要なpackage作業は対象repository・契約・公開／採用範囲を具体化し、本repositoryの承認だけで変更しない。
- SCR-06: 稼働外売上の現行提供操作を維持し、[確認事項台帳](../implementation/pending-confirmations.md)に残る権限判断を保存方式の変更から推論しない。共有Rulesに関わる未決が対象保存を妨げる場合は実装前にその一点を解消する。
- SCR-10: 標準CRUD方式は確定済み。未提供の確定UI、必要な表示・入力・snapshotの確認残だけを具体化する。[確認事項台帳](../implementation/pending-confirmations.md)の未決な入金dataモデルまで自動採用しない。

## 維持対象と範囲外

- Customer／Outsourcerの通常CRUD・取引状態、Site／Employeeの既に標準化した通常CRUDは再実装せず、変更が直接影響する範囲だけ回帰確認する。Outsourcerのarchive／restore UIは追加しない。
- 配置通知の標準作成、Notifications生成、FCM送信・結果記録、実績から請求・勤怠・履歴等への既存Triggerは維持する。確認する工程はSCR-06〜08とし、送信条件・宛先・集計仕様の変更を追加しない。
- 実績複製等、棚卸しの過去記録にある未精査の残経路はSCR-06・07のcaller確認で現状を確かめる。独立した改修が必要と判明した場合は既存FGAへ残件として明示し、10件の終了だけで全transaction移行完了と宣言しない。
- マスタ削除機能の将来見直しは[archive仕様のFUT-0146案内](../specification.md#ドキュメントのアーカイブと物理削除)を維持する。retention・purge・汎用復旧UI・自動終了公開・実data repairを本書の標準CRUD整合へ追加しない。

## 実行・検証・完了証拠

各checkpointの着手時に[開発workflow](../runbooks/development-workflow.md#必要十分なdata設計)へ従い、実際の対象file、入口と全caller、維持条件、互換性、rollback、test・Dev受入れ範囲を固定する。既に確定した標準CRUD方式は再質問せず、未確定の提供範囲・依存契約だけを確認する。実装、独立review、選択した検証、固定commitの受入れ、Git統合を既存手順で閉じてから次へ進む。

検証の正本は[verification policy](../../governance/verification-policy.json)と[Verification Matrix](../operations.md#verification-matrix)。本書作成はproject-guidance-metadataで、project-docs・diff-checkを実行する。後続の製品改修は実際の変更classの和集合で選び、Rules・schemaを変える場合の必須gateやrelease gateを省略しない。既存成功証拠は同じ条件を覆い失効していない場合に再利用する。

代表操作は表の条件に加え、保存・再表示・失敗時のUI、認証と同一tenant、標準クラスの業務検証、影響するTrigger結果を確認する。archive確認直後の稀な競合を完全防止するためのbarrier追加は完了条件にしない。

code・Rulesを戻す必要が生じた場合は[Git統合](../runbooks/project-coordination.md#git統合)と対象の既存runbookに従う。保存形式や実dataが変わる工程ではcodeのrevertだけで戻せるとせず、当該checkpointの互換性・復旧確認に含める。

完了時は各行から実装差分と検証receiptへリンクし、command・exit・review findingと解消・未確認事項を確認可能にする。棚卸しには変更後の実装事実を反映する。本書作成時点では製品検証証拠は未取得。

## 次の作業

SCR-01 Customerを対象に、既存archiveの入口、Classの削除hook／標準restore、Rules、旧envelopeとの互換性、必要なtestを照合し、最初の実装checkpointを具体化する。今回の終了条件は、このロードマップと関連案内の作成・review・文書検証までとする。
