# ADR 0065: 同一tenantを信頼境界とする通常業務認可

- 日付: 2026-09-09
- 状態: Accepted
- 対象: role、permission、通常業務data、Firestore Rules、Callable、段階移行
- 関連仕様: [テナントと認証](../specification.md#テナントと認証)
- 適用計画: [根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)
- 一部置換: ADR 0053・0056・0058・0059、および現行仕様にある通常業務のrole・permission別server認可。Company、Auth/User管理、機微・機密情報、archive・復旧・master物理削除、Stripe操作のactor境界は置換しない。

## 背景

現行実装と仕様は、通常のCustomer、Site、Employee、Outsourcer、transaction系操作にも会社管理者、role preset、permission文字列をserver側で検証し、operationごとのCallableへ移す方向で改修してきた。この設計はroleをsecurity boundaryとして扱う範囲が広く、client policy、Callable、Rules、testの重複とRules式数を増やしている。CompanyとUserは認証・tenant管理の基点であるため、利用者の追加判断によりこの簡素化対象から除外する。

利用者は、AirGuardV2の同一tenantに所属する有効な認証済み利用者を通常業務dataについて同じ権限で操作できる主体として信頼し、role差を原則UXへ限定する方針を示した。一方、identity・権限管理、機微情報、不可逆なmaster lifecycle、Stripe外部作用は同じ信頼へ含めない。

## 決定

### 通常業務の認可

- 同一tenantに所属する有効な認証済み本登録Userは、tenant内の通常業務dataについて同じserver権限でreadし、提供済みのcreate・updateその他の通常操作を行えるものとして信頼する。
- 通常業務のRules・Callableでrole名、role preset、permission文字列、会社管理者、super-user等をallow条件にしない。roleによるmenu、route、button、初期表示、説明等の差はUXとして設けられる。
- 通常業務の認可は、`request.auth`、確認済みemail、User documentの存在とUID一致、本登録、非disabled、正常なtenant claim、User所属tenantとpath tenantの一致を必須とする。AuthまたはUserの無効化、tenant不一致、仮登録、claim欠損・型不正はfail closedとする。
- role制限を外しても、strict field allowlist、型・長さ・必須、tenant・document identity等の不変field、同一tenant参照、許可された状態遷移、上限、確定済みdataの保護、masterのclient物理delete拒否等、operation固有のdata破壊防止条件は維持する。

### 例外

次は通常業務のtenant共通信頼から除外し、必要なrole、permission、actor、target、最新状態等のserver側認可を適用する。clientの表示・非表示、route、disabledは認可境界にしない。

1. Firebase Authentication account、Company document、User document、role、permission、tenant所属の現行提供操作。CompanyとUserはdocument全体を例外とし、現在のactor・field・validation・競合制御を維持する。
2. マイナンバー、口座情報等の機微な個人情報・機密情報。
3. archive、復旧、master dataの物理削除。
4. Stripeによる契約、課金、決済、返金。

例外のexact actorと操作条件は既存の確認済み仕様を維持し、利用者が別途変更するまで通常業務の共通権限から導出しない。Companyの口座情報等を別documentへ分割するADR 0064の境界は維持し、Company実装維持を機微情報の同居継続とは解釈しない。

### ClientとCallable

- Rulesでtenant境界とdata不変条件を十分に強制できる単純な通常操作はclientへ実装できる。
- 複数documentのatomicity、server timestamp・秘密値、信頼できる派生値、外部作用、冪等性、再開・reconcile等の技術要件があれば通常業務にもCallableを使える。ただし、その技術要件だけからrole制限を戻さない。
- 既存CallableとRulesを一括撤去しない。各operationのreader/writer、例外該当性、旧client、data、query、failure pathを確認し、維持、簡素化、client化のいずれかを選ぶ。

## 理由

プロジェクトの実際の信頼単位をroleではなくtenantへ合わせることで、通常業務のclient policy、server policy、Rules、Callableの重複を減らせる。例外とdata不変条件を分離して残すことで、権限昇格、機密情報露出、不可逆操作、Stripe外部作用を通常業務の簡素化へ巻き込まない。

## 代替案

- 現行のrole別server認可を全通常操作へ維持する案: 利用者が定めたtenant内信頼と一致せず、重複実装を維持するため採用しない。
- Rulesをtenant一致だけにする案: schema pollution、型・上限違反、tenant参照改変、無効な状態遷移等を防げないため採用しない。
- 全Callableを直ちにclient化する案: atomicity、server-only値、外部作用、旧client、段階的rollbackを確認できないため採用しない。

## 影響と互換性

- 現在の多くの通常CRUDは新ルールより狭いrole/permission条件または専用Callableを持ち、未解消の実装差となる。
- CompanyとUserの現行actor・field・validation・競合制御は実装差ではなく、維持する例外である。FGAの機能順にもCompany/Userの通常実装置換を追加しない。
- server許可を広げる変更であり、誤分類すると機微情報や例外操作を過剰開放するriskがある。operationごとに通常業務か例外かを先に分類する。
- role別UXは維持できるが、通常業務では直接requestを送った同一tenantの有効Userもserverで許可されることを前提にする。
- 記録済みDev FirestoreはStandard editionだがremoteの現在値は今回確認していない。本判断はedition固有機能に依存せず、実装・release時にactual targetを再確認する。
- このADRの文書変更だけでapplication、Functions、Rules、schema、data、Dev・Prodを変更しない。

## 移行

[根本ガバナンス整合phase](../roadmaps/foundational-governance-alignment.md)でCustomer、Site、Employee、Outsourcer、その他transaction系の順に進める。各機能は対象operationと規模に応じて小checkpointへ分け、現行挙動、例外分類、reader/writer、変更契約、data互換、rollback、test、固定commit、Dev反映・受入れを確定する。破壊的変更、migration、remote write、Dev deployはcheckpointごとの明示承認を必要とする。

## rollback

今回の文書変更は通常のGit revertで戻せる。製品checkpointは旧Rules・Functions・clientの互換性とdata形状を確認し、単純revert、coordinated rollback、forward correctionのどれが安全かを着手前に固定する。アクセス拡張後にRulesだけを戻して新clientを壊す、またはclientだけを戻して過剰許可を残すrollbackを行わない。

## 検証

- governance、仕様、ADR、roadmap、再開案内、CHANGELOGのrouteと置換範囲をcomprehensive governance gateで確認する。
- 各製品checkpointで、同一tenantの複数role・roleなし・super-userを含む有効本登録Userの通常操作許可と、未認証、未確認email、仮登録、disabled、User不在、claim不正、他tenantの拒否を確認する。
- strict schema、型・長さ・上限、immutable field、tenant参照、状態遷移、client物理delete拒否と、4例外のrole/actor認可迂回拒否を確認する。
- Rules、Functions、client、Emulator、必要なUI、固定commitのDev受入れを対象checkpointの変更classとriskに応じて選ぶ。

## 再検討条件

tenant内の通常Userを同じ権限で信頼できない実運用が確認された場合、法令・契約・顧客要件にrole別server認可が必要となった場合、例外分類が不足した場合、またはtenant共通権限による具体的な事故・監査不適合が確認された場合。
