# 0026 project-wide maintenance静穏化とdata change境界

- 日付: 2026-08-28
- 状態: Accepted
- 関連仕様: 保守状態とdata change
- 関連手順: [maintenance・data change runbook](../runbooks/maintenance-and-data-change.md)
- 関連判断: [0024 Dev試行環境のdeployとmigration](0024-dev-trial-deployment-and-migration-runbook.md)
- 関連ロードマップ: [AirGuardV2 正式運用準備](../roadmaps/airguard-v2.md)、[Company設定改修](../roadmaps/company-settings.md)

## 背景

現行maintenanceはclient route制御であり、Firestore Rules、Callable、Admin SDK、scheduled・trigger Functions、開始済み処理を排他しない。data migrationやrestoreのために全Function wrapper、operation lease、実行中registryを実装すれば強い制御を作れるが、全処理へ恒久的な実装・保守コストが生じる。

一方、maintenance開始後に一定時間待つだけでは、scheduled処理や遅いin-flight処理が対象dataを更新し続ける可能性がある。logだけでも処理不存在を証明できないため、product側の最小gateと、対象migrationごとのquiet procedureを組み合わせる必要がある。

## 決定

maintenanceをCompany設定固有でなくproject-wide operational boundaryとする。maintenance自体を排他lockとはみなさず、現段階ではoperation lease、全Function wrapper、実行中registry、`DRAINING` stateを実装しない。

product側は次の最小gateを目標とする。

- maintenance stateはserver-ownedとする。
- Firestore Rulesは通常client writeを拒否する。
- business Callableの共通identity/auth gateは新しい通常処理を拒否する。
- scheduled・trigger Functionsは、対象tenantまたはSystemがmaintenance中なら通常の自動変更をskipする。
- 例外は、明示承認されたprovider migration・repairと、release checkpointに列挙したrebuild・検証だけとする。

運用は、maintenance開始、cutoff記録、処理別のbounded quiet period、対象Function log確認、dry-run、追加待機、再dry-runを行い、連続するdigestが安定した後にsnapshotとapplyへ進む。migration中はSite自動終了等、対象dataを変更し得る通常scheduled/trigger処理を停止対象へ含める。apply後は同じdry-run、integrity、明示したderived data rebuild、error log、主要正常・拒否経路を確認してから解除する。

quiet periodの長さ、監視Function、対象collection、許可するprovider処理、rebuild、停止条件はmigrationごとのbounded checkpointで固定する。logを単独証拠にせず、gate、quiet period、連続dry-run、snapshot、post-checkを組み合わせる。

## 理由

- migrationごとの実データ範囲と処理時間に合わせて静穏性を確認できる。
- 全Function共通の大規模wrapperを先行実装せず、通常利用者による新規処理と自動更新を最小gateで止められる。
- maintenanceを排他lockと誤認せず、in-flight処理とderived dataをrelease evidenceへ含められる。

## 代替案

- maintenance後に固定時間だけ待つ案は、対象Functionとdataの実状態を確認できないため単独では採用しない。
- logに実行中行がないことだけで進む案は、観測遅延・sampling・別write経路を除外できないため採用しない。
- 全処理へlease/registry/wrapperを実装する案は、現段階では開発・保守コストに見合わないため採用しない。migration頻度・規模・事故riskが増えた場合に再検討する。
- maintenance中も通常scheduled/trigger処理を動かす案は、snapshot・migrationと競合するため採用しない。

## 影響

- 利用者: maintenance中は停止案内とsign-out以外の通常業務を利用できない目標となる。現行実装はこの目標を満たしておらず、完了扱いしない。
- operator: checkpointに対象、quiet period、監視、dry-run digest、snapshot、post-checkを明示する必要がある。
- implementation: Rules、Callable共通gate、scheduled/trigger skip、unknown-state fail-closed、status再取得・表示を段階実装する。
- data: migrationが起動するtriggerまたはderived data更新を列挙し、必要なものだけ明示的に再構築・検証する。推測によるglobal rebuildは行わない。

## 移行とロールバック

現行maintenanceはroute制御だけであるため、新しいrunbookは「利用可能な排他機能」として扱わない。product gateが揃うまでは、bounded wait、log、連続dry-run、snapshotをrelease checkpointで補い、対象外write経路が見つかった時点でapply前に停止する。

gate導入は、状態schema、Rules、Callable、scheduled/trigger、client表示を整合releaseとして行う。失敗時はmaintenanceを維持し、data apply前なら既知の互換releaseへ戻す。apply後は推測rollbackをせず、snapshotと前後digestから対象を確定したcorrective releaseまたはrepairを別承認で実行する。

## 再検討条件

maintenance頻度・対象規模・同時operatorが増える場合、処理時間がbounded quiet periodへ収まらない場合、logとdry-runで静穏状態を十分に確認できない場合、またはProdのRPO/RTOが強い排他を要求する場合にlease、registry、DRAINING、専用orchestratorを再検討する。
