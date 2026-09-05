# 現在の製品作業と再開案内

この文書は現在の製品作業・未決事項・次の操作から正本へ進むための案内です。taskのowner、交代状態、Git先端、過去の検証結果は保存しません。通常startupは[文書案内](../README.md)と[project coordination](../runbooks/project-coordination.md)に従います。

## 現在の作業

- 製品は試験運用中。Customer状態改修はCS-03、Customer archive safetyはCAS-04までlocal実装・検証・Git統合を完了しました。CS-04とCAS-05のDev反映・利用者受入れは、マスタデータ管理改修後まで延期しています。
- 2026-09-04の反省会に基づくproject rule整理の判断は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)、現在の入口と必読routeは[project rule index](../../governance/project-rules.md)を正とする。共通ガバナンス、生成AGENTS、lock記録済みmanaged reference、verification policy、製品code・data・environmentはこの整理の変更対象外である。
- 仕様・実装・進捗・実行証拠をこの案内へ複製せず、以下の各正本を参照します。remoteのlive状態は別承認の直接照合がない限り未確認です。
- governance移行の実行範囲・未検証事項は[移行記録](../migrations/2026-09-03-governance-3.0.0.md)、通常startupへの変更判断は[ADR 0045](../decisions/0045-governance-3-normal-startup.md)を参照します。

## 未決事項と承認

- Customer archive safetyは[確認済み仕様](../specification.md)、[ADR 0046](../decisions/0046-customer-archive-reference-barrier.md)、[工程・進捗](../roadmaps/customer-archive-safety.md)、[実装設計](customer-archive-safety.md)に従いCAS-04までlocal完了した。[local受入れ証拠](../verification/customer-archive-local-acceptance.md)を参照する。
- Spark用standalone Developer taskは実装前に中止・削除済みで、再利用しない。CAS-02/03/04はprimary coordinator配下の通常サブエージェント運用で完了した。現在はSiteのSITE-01仕様判断を進めている。別taskで作成されたEmployee改修案は利用者判断により破棄され、Siteの正本・進捗・実装判断へ採用しない。CAS-05、Dev/Prod、remote data/migration、package、緊急restore、retention/purge、OUT-08以降は未承認・対象外である。
- Sparkはこの規模・必読範囲に適さないという試験結果として扱い、再採用しない。反省会の恒久判断は[ADR 0049](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)、実行履歴は[CAS-02試験記録](customer-archive-cas02-developer-trial.md)に保存し、一時メモへ依存しない。

## 次の作業

1. Outsourcerは特定の協力会社masterであり、同じ外注先を配置へ複数回登録できる方式を維持する。旧試行の人数集約方式は採用しない。[Outsourcerロードマップ](../roadmaps/outsourcer.md)のOUT-01からOUT-07はlocal完了し、90%である。[OUT-07証拠](../verification/outsourcer-out07-local-integration.md)に自動検証、write actorのUI smoke、利用者承認済みの拒否actor自動代替、省略、cleanupを記録した。配置・通知・実績・請求・帳票のFirestore更新経路は変更していない。OUT-08のDev反映・受入れはマスタ管理改修後の別承認である。
2. Site masterのread-only現状確認と[Site専用ロードマップ](../roadmaps/site.md)の利用者承認を終え、SITE-01を開始した。CONF-0049は[ADR 0051](../decisions/0051-site-mistaken-registration-archive-boundary.md)、CONF-0050は[ADR 0052](../decisions/0052-site-downstream-snapshot-timing.md)として確定済みである。次はCONF-0051〜CONF-0053の取極め契約を一つの依存グループとして判断する。製品実装は未承認である。
3. Employee masterはSiteと分離した将来作業とし、破棄された別taskの改修案を正本、進捗、承認済み計画として扱わない。再開する場合はrepositoryの現行事実から改めてscopeと承認境界を確認する。
4. マスタデータ管理の一連の改修が揃った後、[Dev受入れの実施時期](../roadmaps/airguard-v2.md#今後のdev受入テストの実施時期)に従い、Customer状態のCS-04とarchive safetyのCAS-05を含むDev反映・権限別受入れ、他マスタとの関連操作をまとめて行う。停止済み専用Auth/Emulator/serverを再利用せず、別承認前にDev・remote・実dataへ進まない。

## 参照

- [確認済み仕様](../specification.md)
- [Siteマスター改修ロードマップ](../roadmaps/site.md)
- [Outsourcerロードマップ](../roadmaps/outsourcer.md)
- [Outsourcer OUT-07 local統合確認の進行記録](../verification/outsourcer-out07-local-progress.md)
- [Outsourcer OUT-07 local統合確認証拠](../verification/outsourcer-out07-local-integration.md)
- [Customer取引状態roadmap](../roadmaps/customer-status.md)
- [Customer archive safety roadmap](../roadmaps/customer-archive-safety.md)
- [Customer archive safety実装設計](customer-archive-safety.md)
- [Customer archive safety local受入れ証拠](../verification/customer-archive-local-acceptance.md)
- [Customer状態のlocal検証記録](../verification/customer-02-status-local.md)
- [確認事項台帳](pending-confirmations.md)
- [local UI手順](../runbooks/local-ui-testing.md)
- [project rule index](../../governance/project-rules.md)
- [project rule整理の判断](../decisions/0049-project-rule-routing-and-checkpoint-closeout.md)
