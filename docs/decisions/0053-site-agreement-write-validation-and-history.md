# 0053 Site取極めの書込み・数値・履歴境界

- 日付: 2026-09-05
- 状態: Accepted
- 関連仕様: [取引先・現場・取極め](../specification.md#取引先現場取極め)
- 関連判断: [0031 必要十分なデータ境界](0031-proportional-data-boundary-and-change-safeguards.md)、[0048 SiteのCustomer変更と履歴snapshot](0048-site-customer-change-and-historical-snapshots.md)、[0052 Site下流情報のsnapshot時点](0052-site-downstream-snapshot-timing.md)

## 背景

現行の取極めは`Site.agreementsV2`の埋込み配列であり、`sites:read`で到達できる画面から作成・編集・削除できる。Sites Rulesも同一tenant Userへ広いwriteを許し、取極め固有のactor、field、数値範囲を強制しない。単価は0をdefaultとする一方で負数・小数・上限の検証がなく、休憩・規定実働時間は負数だけを拒否する。

既存OperationResultは適用取極めをobject snapshotとして保持し、Site側取極めの後日の編集・削除へ自動追随しない。このsnapshot境界が過去実績の再現性を担うため、取極めmasterへ全変更履歴やrevisionを重ねる必要性と、その保存・表示・保持・個人情報管理の負担を分けて判断する必要があった。

## 決定

### 書込み権限

- 取極めの作成・編集・削除はSiteの書込み操作に含め、同じ会社の有効な本登録Userのうち、会社管理者または既知role preset由来の`sites:write`を持つUserだけに許可する。
- 直接permission文字列、未知role、会社管理者でないsuper-user、temporary、disabled、他tenantのUserを権限根拠にしない。UI、送信直前policy、Rulesまたは専用Callableを同じactor境界へ揃える。
- 取極め専用permissionと作成者・承認者workflowは設けない。請求へ影響することは明示するが、通常のSite管理権限から分離しない。

### 数値契約

- WEEKDAY、SATURDAY、SUNDAY、HOLIDAYの各RateSetにある通常・残業、一般・有資格の全単価は、0円以上10,000,000円以下の整数とする。負数、小数、非数値、上限超過を保存前と永続化境界で拒否する。
- 0円は有効値として保存を許可する。ただし意図しない無償設定を見落とさないよう、保存前に警告を表示する。0円を欠損または未設定と同一視しない。
- `breakMinutes`と`regulationWorkMinutes`は0分以上1,440分以下の整数とし、負数、小数、非数値、上限超過を拒否する。
- `breakMinutes`は開始・終了・翌日扱いから算出した勤務区間を超えてはならない。`regulationWorkMinutes`は勤務区間との大小を理由に拒否せず、0〜1,440分の範囲だけを強制する。
- `cutoffDate`は既存の月末、5日、10日、15日、20日、25日だけを許可する。保存値は現行互換の月末値`0`または`5/10/15/20/25`とし、その他、文字列、小数、非数値を拒否する。
- 取極めの重複条件は今回変更せず、現行仕様を維持する。

### 適用済み取極めと履歴

- 過去または現在のOperationResultへ適用済みであることだけを理由に、取極めmasterをlockしない。許可actorは過去・現在・未来の取極めを編集・削除できる。
- 取極めmasterの編集・削除は、既存OperationResultに保存済みの取極めsnapshotを変更しない。変更後のmasterは、以後に作成するOperationResult、またはSite・稼働日・勤務区分等の明示訂正によって取極めを再適用するOperationResultにだけ影響する。
- 未実績化のSiteOperationScheduleはlive Siteを参照するため、master変更後に作成されるOperationResultでは変更後の取極めが選ばれ得る。編集・削除画面は「既存実績には影響せず、今後作成または明示的に再適用する実績へ影響する」ことを保存前に示す。
- 既存OperationResultの取極め訂正はmaster変更の波及として行わず、ADR 0052の請求影響、発行状態、before/after、actor、reasonを扱う専用の実績訂正operationに限定する。
- 取極めmaster専用のrevision、before/after履歴、変更理由、監査collectionは設けない。Site documentの通常の更新者・更新時刻は維持するが、これを取極め変更履歴とは扱わない。

## 理由

OperationResultの取極めsnapshotを過去実績の正本にすれば、masterの現在値を訂正しても既存実績と請求根拠を暗黙に書き換えない。master専用履歴を追加しても既存OperationResultの再現性は高まらず、保存量、履歴reader、閲覧権限、保持・削除方針、actor情報の管理対象だけが増える。そのため、金額に影響するmasterの書込み権限と入力検証は強化しつつ、確認された必要性のない全変更履歴は追加しない。

0円は仮登録や無償契約として正当になり得るためrejectせず、警告で意図確認する。負数と小数は現行の請求計算・値引き表現に明示的な意味がなく、極端な値は誤請求riskとなるため拒否する。規定実働時間は契約上の基準値であり、実勤務区間を超える設定にも意味があり得るため、休憩時間と同じ相互制約は課さない。

## 代替案

- 取極め専用permissionまたは二者承認を設ける案: 現時点の運用需要に対してrole・画面・server状態が増え、Site管理との責務分離に十分な根拠がないため採用しない。
- 適用済み取極めをlockし、新しいrevisionだけを追加する案: 既存OperationResultがsnapshotを保持しており、master訂正を不必要に複雑化するため採用しない。
- masterの全変更をbefore/after監査として保存する案: 過去実績の正本と重複し、具体的な監査・保持要件がないため採用しない。
- 0円または規定実働時間が勤務区間を超える値を一律拒否する案: 正当な無償・仮設定や契約上の基準時間を表せなくなるため採用しない。

## 影響と互換性

- `Site.agreementsV2`の埋込み配列、適用開始日と勤務区分による選定、曜日別RateSet、既存の単価・時間・締日fieldを維持する。独立Agreement collection、revision、status、archiveを追加しない。
- 現行UI・Rules・Site document全体保存はactorと数値契約を強制していないため、SITE-02・SITE-03・SITE-06でoperation固有writer、部分保存、UI、RulesまたはCallable、testを整合させる必要がある。
- 既存OperationResultのagreement snapshotと既存dataを本判断だけで変更しない。既存取極めの範囲外値の件数・shapeはDev/remoteの別承認まで未確認であり、推測して補正しない。
- 取極めmasterを削除しても既存OperationResult snapshotは保持する。未実績化予定と将来実績への影響はlive master契約どおりであり、自動復元または過去実績への伝播は行わない。

## 移行とrollback

この文書化ではdata migrationを行わない。実装時は既存値をreadできる互換経路を先に維持し、保存時の新validationと書込み境界を導入する。Dev/remoteで範囲外の既存値が確認された場合は、件数・shape・業務上の正値を示した別承認のmigrationまたは手動訂正計画を作り、現在値から推測補正しない。

data変更前の文書・codeはreview済みcommit単位でrevertできる。新validation導入後に保存不能な既存値が見つかった場合も、広い直接writeを再開せず、対象を限定した互換表示と訂正手段を設計する。

## 検証

- 会社管理者とstrict `sites:write` actorによる作成・編集・削除を許可し、read-only、直接permission、未知role、会社管理者でないsuper-user、temporary、disabled、他tenantをUI・writer・Rulesで拒否する。
- 全16単価fieldについて0、1、10,000,000を許可し、負数、小数、10,000,001、非数値を拒否する。0円警告を確認し、0を欠損へ変換しない。
- 休憩・規定実働について0、1,440、日跨ぎを確認し、負数、小数、1,441、非数値、勤務区間を超える休憩を拒否する。規定実働が勤務区間を超える値は範囲内なら許可する。
- 締日は`0/5/10/15/20/25`を許可し、それ以外の値と型を拒否する。重複key、曜日一括入力、保存失敗、二重送信、同一field競合も確認する。
- masterの編集・削除前後で既存OperationResult agreement snapshotが不変であり、以後の新規または明示的再適用だけが新masterを使うこと、未実績化予定への影響警告、専用履歴collectionを作成しないことを確認する。
- 実装時のchange classは最終差分に応じて`ui-css-layout`、`application-logic`、`data-contract-schema-migration`のunionとする。Dev／Prod・remote/data・migration・packageは別承認とする。

## 再検討条件

取極め変更について法令・契約・内部統制上の保存義務、二者承認、変更理由、過去時点masterの復元が具体的に必要と確認された場合、負単価・小数単価・10,000,000円超または1,440分超を正当に扱う業務が生じた場合、あるいはOperationResult snapshotが過去実績を再現できないことが確認された場合に再検討する。
