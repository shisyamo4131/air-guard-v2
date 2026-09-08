# 0031 必要十分なデータ境界・競合制御・cutover

- 日付: 2026-08-30
- 状態: Accepted
- 関連仕様: `docs/specification.md` の「Company設定」と「開発ガバナンスと進捗管理」
- 置換対象: ADR 0025のCCB文書分割・runtime互換・全設定revision/audit部分、ADR 0028、ADR 0029

## 背景

UWBではUser documentを権限ごとに分割せず、操作ごとのCallableがactorと変更可能fieldを確認した。競合制御もroleと有効・無効のように認証・認可へ直接影響する操作へ限定し、通常編集へ共通revision、lock、operation ledgerを広げなかった。

一方、CCBは単一Company documentの全体setによる未知field消失と、通常利用者へ公開できないStripe情報の混在を解消する目的から始まったが、8 target document、PrivateSettings、SettingAudits、全設定revision、LEGACY/STAGED/ACTIVE runtime、長期互換release、create-only staging・restoreまでを一つの改修へ含めた。正式release前のDevで確認済みCompany rootは4件であり、当時は短時間maintenanceによる一括変更が可能と判断していた。具体的な故障を超える予防策が積み重なり、目的に対して設計とroadmapが過大になった。後続のlegacy Stripe固有判断は、writer不存在と恒久cleanupを確認してmaintenanceを不要とした。

## 決定

### 既定は分割しない

- 一つの業務対象は一つのdocumentを既定とする。
- document分割は、次のいずれかを具体的に確認できる場合だけ採用する。
  1. 読取可能なactorが異なり、同一documentの全fieldを渡せない。
  2. 保存期間、削除条件、復旧条件が異なる。
  3. 履歴・明細等が継続的に増加する。
  4. 現在の上限とfield形状からdocument size超過の現実的な経路がある。
  5. 本体を読まずに独立したquery・一覧取得が必要である。
  6. 同一documentへの競合が実測または再現され、field限定updateでは解消できない。
- writerの権限、画面、編集フォーム、責務名が違うだけでは分割しない。操作ごとのserver認可とexact field allowlistで表現できる場合は同一documentを維持する。
- 分割を追加する提案は、具体的な故障、影響、より単純な対策で防げない理由、追加範囲の4点を示す。いずれかを示せなければ採用しない。

### 更新と競合制御

- 通常編集でwhole-document replacementを行わず、当該operationが所有するfieldだけを更新する。
- 共有管理画面はreal-time listenerで最新値を反映する。編集中の同一operationへ他actorの変更が届いた場合は通知し、operationごとに最新値の再読込または結果が明確な明示再確認を要求するUIを優先する。
- 会社名、住所、電話、通常設定、表示順等の可逆な通常変更はlast-write-winsを受容し、共通revision、lock、ledgerを導入しない。
- 試験運用中の可逆な通常操作の楽観表示では、保存完了やlistener反映を待つための共通pending lock、single-flight queue、更新順保証を既定にしない。操作後の最新local表示を保ち、listenerの正本で収束させる。短時間の連続操作や複数actorの競合が実測され具体的な業務被害を確認した場合だけ、該当operationへ局所的な制御を追加する。
- 追加のexpected value、transaction、idempotency、lock、ledgerは、権限・利用停止、削除、金銭確定、外部service作用、複数resourceの不変条件、復旧困難なdata loss、二重実行の具体的被害へ限定する。

### Schemaと編集componentの責務

- Firestore CRUDの新規・改修画面では、`AirItemManager`と`AirArrayManager`を入力draft、dialog、validation、永続化、購読反映のすべてを担う既定componentにしない。既存画面は一括置換せず、operation単位で専用editor、UI非依存のapplication処理、writerへ移す。
- FireModel/Class schemaはdocument全体に共通する必須・型・長さ・相関の正本として維持する。operation固有の編集field・追加必須条件は一つのoperation contractへ定義し、個別componentが同じvalidationを再定義しない。
- 保存時は最新のlive documentへdraftの変更fieldだけを重ねたcandidateをClassとoperation contractで検証する。検証対象は整合したdocument全体、永続化対象は実際に変わったoperation所有fieldと監査metadataだけとする。
- editorはlive modelを直接編集せず、開始時点の独立draftを持つ。listener更新でdraftを黙って置換しない。同じoperation所有fieldが外部変更された場合は通知する。再読込必須または明示再確認後のlast-write-winsのどちらを採るかはoperation contractへ固定する。Company基本情報は再読込必須とし、曖昧だった「自分の入力を優先する」controlを提供しない。
- 入力componentやdialog shell等の再利用は許容するが、業務operation、Firestore writer、権限判断を汎用UI componentへ戻さない。

### Callableとclient write

- Callableは、server-only情報、厳密なactor判定、複数resource、外部service、不可逆操作、必須audit等があるoperationに使用する。
- Firestore Rulesだけでactor、tenant、field、型、状態を完全に表現でき、server-only情報や外部作用を持たない単純updateはclient writeを選択できる。
- Callableを使うこと自体はdocument分割の理由にしない。

### migrationとRules cutover

- 正式release前のDevで、対象全件を一つのbounded maintenance内にbackup、変換、検証でき、旧clientを継続稼働させる必要がない場合は、長期互換層を作らずcoordinated cutoverを既定とする。
- production利用、複数client versionの併存、許容できない停止時間、bounded maintenanceへ収まらない件数・外部作用がある場合だけ互換releaseを追加する。
- 新規pathは最初のdocument作成前にclient denyを確立する。Rules、Functions、client、migrationの順序は対象operationの実際の停止条件に合わせ、旧機能の継続を一律の必須条件にしない。
- migrationは対象、件数、backup、dry-run、apply、post-check、停止条件、rollbackを固定し、実data操作は別の明示承認を必要とする。

### CCBのrestart

- CCBの目的は、Company全体setを廃止し、実際の会社情報と通常設定をoperationごとのexact field updateへ移すこととする。
- 今回のCCBからStripe、subscription、entitlement、employeeLimit、PrivateSettingsを除外する。現行のlegacy Stripe fieldは独立した小規模改修で削除し、将来サブスクリプションを実装する時点で保存構造、権限、外部作用を新規設計する。
- 8 target document、LEGACY/STAGED/ACTIVE runtime、compatible reader、全設定revision、SettingAudits、長期stagingを確認済み目標から外す。
- Company documentは、同じactorが読める会社情報・通常設定・利用状態を同居可能とする。別documentは本ADRの分割条件を満たしたfieldだけに限定する。`siteOrder`・`scheduleOrder`は実際のsize上限を再計測してから分割を判断する。
- 確認済みDev Company root 4件は、対象operationの実際のwriterと互換性に応じて一括変換する。legacy Stripe scaffoldは未使用で、現行client・Functions・Rulesに旧fieldのwriterがなく、exact field deleteが通常Company更新を保持するため、ADR 0038の固有契約によりmaintenanceなしで恒久削除する。UWB方式のFirestore全体snapshot、fresh dry-run、post-check、Dev受入れを一つのbounded checkpointへ固定する。
- 旧CCBのapplication、Rules、migration・restore script、test、Schemas consumer、Admin SDK guardはcommit/file単位でinventoryし、UWB、独立したsecurity改善、公開済みpackage artifactを巻き込まずcorrective commitでrollbackまたは再利用を決める。公開済みpackageをunpublishしない。

### roadmapの大きさ

- roadmapは、独立してFIXできる一つの利用者価値または一つのdata correctionを対象とし、原則として設計・実装・local検証・必要なmigration・Dev反映・Dev受入れまでを100%とする。
- 複数の独立改修を一つのroadmapへ集約しない。Stripe legacy field削除、Company exact field update、表示順の大容量対策、Company lifecycle等は別々に完了できる単位として扱う。
- Dev反映を完了条件とするroadmapは、local実装だけで進捗100%にしない。未承認のDev操作はapproval gateとして残し、完了を主張しない。

## 理由

UWBで採用した局所的な安全対策をproject全体へ一般化し、通常CRUDへ不可逆操作と同じ保護を強制しないためである。read visibilityが異なる情報の分離、whole-document replacementの廃止、外部作用のserver管理という実害へ直結する境界は維持しながら、推測上の完全防御を実装・運用・migrationの恒久負担へ変えない。

## 代替案

- 旧CCBを継続する案: 4件のpre-release dataに対して長期互換・8 document・runtime state・audit/restoreを維持するため不採用。
- Companyを無条件に単一documentへ戻す案: read visibility、大容量、増加し続ける履歴等の正当な分割理由まで否定するため不採用。
- 全更新をCallableまたは全更新をclient Rulesへ統一する案: operationごとの外部作用、認可、offline、複数resource条件を無視するため不採用。
- real-time listenerだけで全競合を解決したとみなす案: 保存直前の同時変更、複数端末、外部作用の重複は残るため、高risk operationだけ追加保護する。

## 影響

- 仕様: CCB v1の8 document構造、runtime互換、全設定revision/audit、Stripe境界を確認済み要件から外す。field単体の既存validation判断は、旧構造へ依存しない範囲で維持し、restart inventoryで再確認する。
- application/data: 本ADRの文書commitだけでは変更しない。rollbackと新設計は後続checkpointで行う。
- progress: Company設定roadmapの10%は誤ったscopeの準備であり、active progressとして引き継がない。完了済み調査・package公開・testは履歴証拠として残すが、新roadmapへ自動加点しない。
- governance: project-wideの設計・Rules cutover・roadmap単位を変更するためinstruction-chain変更としてcoordinatorを交代する。

## 移行とrollback

本判断を仕様、project rules、開発workflow、ADR/roadmap/implementation索引、CHANGELOG、current handoff snapshotへ反映し、検証済みlocal commit後に完全新規coordinatorへ交代する。新coordinatorは旧CCB差分を正確にinventoryし、rollback commit案を提示・検証してからapplication/Rulesを変更する。

本ADRの文書変更は通常のGit revertで戻せる。application/data rollbackはhistory rewriteや公開package unpublishを使わず、review済みcorrective commit、backup、dry-run、post-checkを用いる。

## 検証

- project documentation validator、managed governance validator、renderer check、diff check。
- rollback inventoryでexact commits/files、残す独立security改善、関連repository影響、test範囲を確認する。
- 各小規模roadmapでdomain test、Rules/Emulator、real-time UI、migration dry-run/apply/post-check、bounded Dev releaseと利用者受入れを対象に応じて実施する。

## 再検討条件

正式release後に複数client versionを併存させる場合、Company数・書込頻度・document sizeが増加した場合、法令・監査・復旧要件が確定した場合、または単純なfield updateとreal-time listenerで防げない具体的事故が確認された場合に、該当operationだけを再検討する。
