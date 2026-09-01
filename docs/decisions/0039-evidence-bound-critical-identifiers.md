# 0039 Critical identifierの正本照合とSchemas consumer preflight

- 日付: 2026-09-01
- 状態: Accepted
- 関連仕様: システム境界、開発ガバナンスと進捗管理
- 関連判断: [0032](0032-required-specialist-subagent-routing.md)、[0038](0038-legacy-stripe-scaffold-removal.md)

## 背景

STRIPE-02準備中、正本を確認していないSchemas package名がcoordinator promptへ入り、複数agentが同じ誤値を繰り返したことで、誤ったconsumer変更が開始された。package自体の公開名は変更されておらず、誤りはAirGuardV2の未コミット差分だけに留まり、正確なowned pathの復元後にworktreeはcleanへ戻った。

agentの数や同意では、package、repository、Git、environment、deploy、dataの識別子を確認済みにできない。特に公開package導入は、source、公開証拠、consumer lockの異なる層が一致して初めて安全に開始できる。

## 決定

- Managed common governance 1.4.1のevidence-bound critical identifier contractをAirGuardV2へ導入する。
- critical identifierは当該turnでtask-routed正本または実targetから取得し、source/locationまたはcommand/valueを確認してからdelegationまたはstate changeに使用する。
- chat、要約、memory、親prompt、coordinator・subagent reportは探索の手掛かりに限定し、複数agentの一致を確認証拠にしない。
- coordinatorが委譲前に確認し、委譲先もstate change前にactual targetと独立照合する。不足・stale・曖昧・矛盾時はapplication diffを作らず停止する。
- Schemas consumer更新では`scripts/check-schemas-package-adoption.ps1`を使用し、source tagのpackage manifest、repository release evidence、AirGuardV2 root/Functionsのmanifest・lockにあるname、version、resolved、integrityを一つのchainとして比較する。変更前は`PreAdoption`、変更後は`PostAdoption`を要求する。
- network未承認時はlocal tagと記録済みrelease evidenceまでを確認し、remote registry freshnessを推測しない。

## 理由

値を文書へ固定するだけでは将来versionで陳腐化する。正本の層を毎回機械比較し、誤った期待値を与えた場合にもwrite・install前にnonzeroで止めることで、同じ種類の誤報が実装差分へ伝播する経路を断てる。

## 代替案

- agentを増やして相互確認する案: 同じ未確認promptを共有すると誤値を複製するだけなので採用しない。
- package名だけをproject rulesへ固定する案: version、tag、integrity、consumer lockの不一致を検出できないため採用しない。
- 毎回registryへ接続する案: network承認境界を不要に広げ、記録済み公開証拠とlocal tagで可能な確認まで外部状態へ依存するため標準にはしない。

## 影響

- ガバナンス: common governance、生成`AGENTS.md`、project rules、仕様、runbook、開始prompt、validator、snapshotを更新し、全active AirGuardV2 taskを完全新規taskへ交代する。
- product: この判断自体ではapplication、Functions、Rules、dependency、package-lock、Dev・remote/dataを変更しない。STRIPE roadmap進捗は10%のまま維持する。
- Schemas: 公開済み`@shisyamo4131/air-guard-v2-schemas@3.0.0-dev.1`は導入候補であり、AirGuardV2の`PostAdoption`成功までconsumer導入済みと扱わない。現在の`2.4.2-dev.167`をrollback baselineとして維持する。

## 移行

installed skillの正規sync commandでmanaged artifactsを1.4.1へ更新し、project-owned preflightとroutingを追加する。project docs validator、managed governance validator、renderer `-Check`、正しい値の`PreAdoption`、意図的なfalse package名の停止、`git diff --check`を独立実行してlocal commitする。その後、利用者承認済み手順でcoordinatorをforkしない完全新規taskへ交代し、no-change callbackと最初のfile限定activation commitを確認する。

## Rollback

問題があればhistory rewriteを使わず、project-owned変更とmanaged 1.4.1同期をreview済みrevertまたはcorrective commitで戻す。instruction-chainを戻す場合も新しいtask turnoverを行う。preflight失敗時はconsumer変更を開始せず、正本またはscriptの不一致を修正して再確認する。

## 検証

- false package名でpreflightがnonzeroとなり、tracked diffを作らない。
- 正しいpackage名・target versionでsource tag commit、release evidence、現在のroot/Functions consumer chainを報告し、`PreAdoption`が成功する。
- consumer導入後はroot/Functionsのversion、resolved、integrityがrelease evidenceと一致するまで`PostAdoption`が成功しない。
- common governance 1.4.1、生成`AGENTS.md`、project rules、文書routing、ADR index、roadmap進捗、validator、Git diffが整合する。

## 再検討条件

Schemas release evidenceの形式、package manager、lockfile schema、repository配置、公開workflowが変わった場合、または別のpublished artifactにも同じproject-local preflightを展開する場合。
