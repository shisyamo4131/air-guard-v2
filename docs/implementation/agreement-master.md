# Agreement（取極め）マスター実装調査

## メタデータ

- 状態: SITE-06完了。FGA-03で通常Site更新・document last-write-winsへ置換したLocal候補
- 対象セグメント: SPEC-SEG-022
- 最終確認日: 2026-09-11
- 根拠ファイル: `pages/sites/[id].vue`、`components/Agreements/**`、`components/Agreement/**`、`components/OperationBilling/CustomInput/Agreement.vue`、`air-guard-v2-schemas/src/AgreementV2.js`、`WorkTimeBase.js`、`Site.js`、OperationResultの直接agreement参照、Sites Rules

## 確認済み方針

- 取極めなしのOperationResultは運用上あり得る。
- 請求稼働管理では、適用日・勤務区分上は通常適用外の取極めも手動選択してよい。
- 取極めなしでも請求日、単価、数量等を個別設定して請求対象化できる必要がある。
- 取極めの作成・編集・削除はSiteの通常writeに含め、同じtenantの有効な認証済み本登録Userへrole・permission・会社管理者区分に依存せず許可する。取極め専用permissionと承認workflowは設けない。
- 全単価は0〜10,000,000円の整数、休憩・規定実働は0〜1,440分の整数、締日は`0/5/10/15/20/25`だけを許可する。0円は警告付きで許可し、休憩は勤務区間を超えてはならない。
- OperationResultへ適用済みのmasterも編集・削除できるが、既存OperationResult snapshotは変更しない。取極めmaster専用のrevision、before/after履歴、変更理由、監査collectionは設けない。詳細は[ADR 0053](../decisions/0053-site-agreement-write-validation-and-history.md)を正とする。

以上はユーザー確認済み方針である。SITE-06で導入した専用保存境界のうち、actor・競合・CallableはADR 0065・0066とFGA-03で通常Site更新へ置換した。数値、重複、0円確認、既存OperationResult snapshot不変は維持する。OperationResultの明示的な再適用・訂正operationはFUT-0068側の別課題である。

## 入口・権限

- 独立したAgreement一覧・詳細page、pageSettings、Firestore collection CRUDはない。
- AgreementV2は`Site.agreementsV2`配列の埋込みvalue objectで、`/sites/[id]`に直接表示する`AgreementsManager`から作成・更新・削除する。編集後の配列をlistener由来の現在のSiteへ重ね、Site modelの通常`update()`で保存する。専用Callableは使用しない。
- UI入口は`sites:read`で、通常Site writeと同じく同一tenantの有効な認証済み本登録Userが編集できる。ACTIVE Siteだけを編集対象とし、temporary、disabled、User不在、claim不正、他tenantは通常Site境界で拒否する。
- schemaに`collectionPath="AgreementV2s"`はあるが、この調査範囲で独立documentとして保存・検索する到達経路や専用Rulesは見つからない。

## データ契約

- 所属Site/Customer IDをAgreement自身は持たない。親`Sites/{siteId}`と、そのSiteの`customerId/customer`によって文脈が決まる。
- WorkTimeBase由来の必須field: `dateAt`（適用開始日）、`shiftType`、`startTime`、`endTime`、`breakMinutes`、`regulationWorkMinutes`。
- AgreementV2固有の必須field: `rates`、`billingUnitType`、`cutoffDate`。`includeBreakInBilling`はdefault false。
- `rates`はWEEKDAY/SATURDAY/SUNDAY/HOLIDAYの各RateSetを必須で持つ。各RateSetは`unitPriceBase`、`overtimeUnitPriceBase`、`unitPriceQualified`、`overtimeUnitPriceQualified`を持ち、全てdefault 0かつrequired。
- `billingUnitType` defaultはPER_DAY。`shiftType` defaultはDAY。`dateAt` defaultは現在日の00:00、休憩・規定実働は共通field definitionのdefaultを使う。
- 読み取り専用プロパティは`date`、`startAt`、`endAt`、`isSpansNextDay`、`attendanceDateAt/attendanceDate`、`key`等。`key`は`${date}_${shiftType}`。
- `isKeyChanged`ゲッターは更新前後のkey差を返す。独立doc ID、status、有効終了日、archive flagはない。

## CRUD・validation

- `AirArrayManager`がitem-key=`key`で配列内CRUDを行い、clientが同じ適用開始日・勤務区分のduplicate key `${date}_${shiftType}`を拒否する。
- 選択した一件の入力draftは保存まで保持し、保存失敗時も入力内容を残す。`AirArrayManager`の処理中制御と0円確認中の停止により同じ操作の二重送信を防ぐ。baseline比較、同一field競合、明示的な最新値再読込は設けない。
- DAY/NIGHT tabごとに取極めを作成・編集し、copy buttonは選択中Agreementを新規入力の初期値として渡す。
- create時は表示中shiftTypeを強制し、Siteの埋込みCustomerにcutoffDateがあれば初期値に設定する。
- deleteはcandidate配列から除去し、専用archive、終了status、参照確認、revisionはない。通常Site更新の成功後にlistenerの最新値を表示する。
- 開始/終了時刻、翌日開始、規定実働、休憩、請求単位、締日、4曜日×4単価を編集する。曜日を複数選択して同じRateSetを一括反映できる。
- clientは、全16単価を0〜10,000,000円のsafe integer、`breakMinutes`と`regulationWorkMinutes`を0〜1,440分のsafe integer、締日を`0/5/10/15/20/25`へ限定する。休憩は日跨ぎ・同時刻24時間を含む勤務区間以内とし、規定実働は範囲内なら勤務区間超過を許可する。0円を有効値として維持し、candidate内に0円がある保存だけ明示確認する。
- `dateAt`、`DAY/NIGHT`、時刻、boolean、`PER_DAY/PER_HOUR`、AgreementとRateSetの永続化shapeはAgreement inputとSite schemaで検査・正規化する。変更時は現在のSite document全体を通常`update()`で保存し、後から成功した保存を正本とする。
- 期間重複という概念はなく、同一shiftTypeでは開始日の系列として扱う。key完全重複だけがUI管理対象。

## 適用判定・検索

- `Site.getValidAgreement({date, shiftType})`はshiftType一致だけを抽出し、適用開始日降順で指定日以前の先頭を返す。指定日なしではそのshiftTypeの最新を返す。
- dayTypeは適用Agreementの選定条件ではなく、選定後に`rates[dayType]`を選ぶ条件。
- ViewerはshiftType別に開始日昇順で表示し、JST今日以前の最新を「現在適用」とする。未来分も前後navigationで閲覧・編集できる。
- 独立検索、site/customer横断一覧、終了済み検索はない。
- OperationBillingの手動選択UIはSiteの`agreementsV2`候補を利用する。承認済み方針どおり、適用日・勤務区分で候補を強制除外しない境界は自動適用とは別である。

## 単価・数量計算

- Agreement自体は数量を保存しない。単価、残業単価、請求単位、休憩を請求時間に含めるか、規定実働時間を提供する。
- OperationResultのoriginal計算は、実績のdayTypeに対応するRateSetを使い、base/qualifiedを分ける。
- PER_DAYでは各categoryの実績人数をquantityとする。PER_HOURではtotalWorkMinutesを60で割り、`includeBreakInBilling=true`ならbreakMinutesを加えてquantityとする。
- 残業金額は`overtimeMinutes × overtimeUnitPrice / 60`。通常金額は`quantity × unitPrice`。各金額にはRoundSettingが適用される。
- Agreementまたは該当dayType RateSetがなければoriginal単価・金額は0側となる。手動調整（useAdjusted）は別fieldから計算し、取極めなし請求の回復経路となる。

## 参照・snapshot

- SiteはAgreementV2配列をlive masterとして保持する。Schedule等がsiteIdから参照する時点では現在のSite取極めが適用候補となる。
- OperationResultは作成時またはgroup key変更時に`Site.getValidAgreement`の結果を`agreement` objectとして保存する。既存OperationResultはSite側取極めの更新・削除に自動追随しない。
- したがって、過去OperationResultの単価・締日計算はsnapshot、将来の自動適用は更新後masterという境界である。
- SiteのCustomer変更や埋込みCustomer staleにより、create時cutoffDate defaultとOperationResultへ同期されるcustomerIdの時点が混在し得る。

## 削除・終了

- Agreement単独の終了、無効化、archive、restoreはない。新しい開始日のAgreementを追加することで旧Agreementの適用を将来分から置き換える。
- 過去Agreementも親配列から直接編集・削除でき、status/date lockはない。
- 削除済みAgreementをsnapshotした既存OperationResultは保持するが、同日/shiftの未確定処理や再適用は残ったmasterから選定される。
- 親SiteをarchiveするとAgreement masterも通常Sites collectionから消える。Site archive/restore policyに従属する。

## Rules・tenant境界

- Agreement専用collection Rulesはなく、親Sites Ruleの通常updateが適用される。
- Sites Rulesはtenant、認証済み本登録User、ACTIVE、actor UID、status保護を維持し、`agreementsV2`は他の通常fieldと同じdocument更新で許可する。
- Agreementの構造・重複・数値は正規application writerで検査する。applicationを介さない同一tenant requestによる形状不正は、現在の合意済み脅威モデルでは追加対策の対象にしない。

## 矛盾・未使用候補

- `AgreementV2.collectionPath`は定義されるが、現行経路はSite埋込みだけで独立collectionは未到達候補。
- 過去適用済みAgreementを上書き・削除できるが、既存OperationResultはsnapshotを保持するためmaster表示と過去実績の単価が一致しないことがある。
- priceのdefault 0は維持し、保存時の明示確認を追加した。Viewerの0円表示が`-`になる既存表示はSITE-06の保存境界とは別である。
- ListItemは0円を`-`表示し、Tableは欠損enum/rate/priceを安全に正規化しない。表示対象配列が短縮・勤務区分変更された場合、viewer indexが範囲外に残り得る。
- copy後にdateを変え忘れた場合はduplicateKeyで拒否されるが、隣接期間や将来/過去の整合警告はない。
- Viewerの「現在適用」と手動選択可能範囲は意味が異なる。手動選択非制限は承認済みであり、不具合とは扱わない。
- 旧`Agreement` classとdeprecated getter群がschemaに残るが、現行Site UIはAgreementV2を使用する。

## 将来要対応

- FUT-0065: FGA-03で置換。取極めをtenant共通の通常Site writeへ統合し、専用Callableと直接client変更拒否を撤去した。
- FUT-0066: local完了。単価・時間・締日validation、duplicate、0円確認をapplicationで実装・検証した。
- FUT-0067: local完了。適用済みAgreementの編集・削除を許可し、既存OperationResult snapshotへ書込まず、専用履歴・revisionを追加しない契約を実装・検証した。
- FUT-0068: Agreement snapshotと再適用境界を明示・検証する。
- FUT-0069: AgreementV2の独立collection契約と旧classを整理する。

## 要確認事項

- CONF-0051〜CONF-0053は2026-09-05に回答済みで、ADR 0053へ記録した。CONF-0054・CONF-0055は`pending-confirmations.md`に残る。

## 未確認範囲

- OperationResult statistics/RoundSetting内部、請求集約処理、明示的な再適用・訂正operation。
- 実データ中の重複・範囲外値・0円、独立AgreementV2s collectionの存在、必要index、Dev/remote shape、ブラウザ受入れ。
- 旧Agreement classの全利用箇所とmigration。
