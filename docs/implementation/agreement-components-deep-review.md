# Agreement components deep review

## メタデータ

- 状態: 実装調査（file本文deep review）
- 対象checkpoint: SPEC-DEEP-013
- 最終確認日: 2026-08-11
- 対象: `components/Agreement/**`、`components/Agreements/**`のexact 10 files
- 境界: callerと`AgreementV2`/`DayTypeRates`/`RateSet`の直接契約だけを照合した。runtime、AirArrayManager内部、Firestore実行は未確認。

## file別公開契約

| file | 公開契約・責務 | mutation / side effect | error・到達性 |
| --- | --- | --- | --- |
| `Agreement/Input/index.vue` | `componentAttrs`、`disabled`を受け、勤務時間・締日・請求単位・曜日別単価inputを構成する。emitなし。 | field更新は各`componentAttrs`と子inputへ委譲。 | `disabled`を明示的に渡すのは`RateSetInput`だけで、左側inputは`componentAttrs`依存。 |
| `Agreement/Input/RateSet.vue` | `DayTypeRates`の`modelValue`、`dayType`、`disabled`; `update:modelValue`をemit。 | cloneした`DayTypeRates`へ編集結果を代入し、選択曜日へ同じ`newValue`参照を設定する。 | 欠損価格はconsole warningと`N/A`。`dayType`変更時の選択曜日resetはmanagerの`initialized`時だけ。 |
| `Agreement/ListItem/index.vue` | Agreement表示。`dayType`、請求単位/価格表示flagを受け、attrsを`v-list-item`へ透過。 | なし。 | 0円はtruthy判定で`-`表示となる。未知enumは`N/A`。 |
| `Agreement/ListItem/Title.vue` | 適用開始日と勤務区分chipを表示。 | なし。 | `AgreementV2` instance validatorあり。 |
| `Agreement/Select/index.vue` | AirSelect wrapper。keyをvalue、dateをtitleとし、selection/item slotを整形。 | 親のv-model契約をattrs透過。独自emitなし。 | 候補制限・permission・loading/errorは親責務。 |
| `Agreement/Table/index.vue` | 単一Agreementの勤務・締日・単価を表示。 | tabだけlocal mutation。 | propにinstance validatorがなく、未知`billingUnitType`、欠損rates/priceでは直接参照・`toLocaleString`がthrowし得る。consoleへAgreement全体を出力する分岐がある。 |
| `Agreements/Manager/index.vue` | `useBaseManager`経由でAirArrayManagerへv-model等を透過し、埋込み配列のcreate/update/delete/copyを提供。`update:shiftType`をemit。 | create/update前に表示shiftTypeを強制し、create時だけcutoffDate defaultを設定。親callerが`submit:complete`でSite/Company全体を保存する。 | 自身にpermission/loading/error/single-flight制御なし。icon-only actionに明示labelなし。 |
| `Agreements/Viewer/index.vue` | DAY/NIGHT tabsと勤務区分別viewerを構成し、`update:shiftType`/`update:currentAgreement`をemit。 | 勤務区分別current selectionをlocal objectに保持。 | permission/error制御なし。 |
| `Agreements/Viewer/ShiftTyped/index.vue` | shift別配列をwindow表示し、current agreement/indexをemit。 | next/prevをcomposableへ委譲。 | 空でもprev/next buttonは有効で、prevはindexを`-1`へ設定し得る。buttonはicon-onlyでlabelなし。 |
| `Agreements/Viewer/ShiftTyped/useIndex.js` | filter/sort、JST今日に対するvalid index、current index、next/prev/init/goTo API。 | reactive internal array/indexを更新。invalid inputをglobal loggerへwarning。 | props更新後に`currentIndex`を再正規化せず、配列短縮・shift変更で範囲外となり`currentAgreement`が`undefined`になり得る。直接testは確認できない。 |

## 保存・validation・配列identity

- 正本は`Site.agreementsV2`または`Company.agreementsV2`の埋込み配列で、manager自体はFirestore CRUDを行わない。callerの`doc.update()`がdocument全体を保存する。
- `item-key="key"`は`${date}_${shiftType}`であり、duplicate表示をAirArrayManagerへ委譲する。schemaはRateSet 4価格をrequired/default 0とするが、このcomponent群は負数・上限・小数精度を追加検証しない。
- 複数曜日編集は各曜日へ同じ`RateSet newValue` objectを代入する。同一dialog中の参照共有とserialize/hydrate後のidentityが同じかは未検証である。
- delete、rollback、dialog loading、重複submit防止、保存失敗時の配列復元はAirArrayManager/useBaseManagerとcallerへ委譲され、本10 filesだけでは保証されない。

## 権限・到達性

- Site詳細とCompany設定が直接callerである。Site詳細は現行`sites:read`入口からAgreement create/update/delete/copy UIへ到達する。component自身にpermission判定はない。
- Company設定callerもCompany document全体の更新へ接続する。field allowlist、監査、同時更新transactionはcomponent層にない。
- `AgreementSelect`はOperationBillingの手動取極め選択から使用され、候補制限と保存権限は親へ委譲する。

## accessibility・表示境界

- managerとviewerの主要操作はicon-only buttonで、明示的な`aria-label`/text/tooltipを持たない。
- 独自focus復帰、dialog error focus、screen-reader向け現在適用説明はない。loading/error/emptyのうちempty表示だけをShiftTyped viewerが持つ。

## 矛盾・未使用候補

- `AgreementTable`のコメントは`Agreement`と記す一方、実装は`AgreementV2`定数を使い、prop validatorもない。
- `AgreementSelect`は空の`defineEmits([])`を持つが独自emitはない。
- `useIndex`の`shiftType`公開computed、`validAgreement`、`init`、`goTo`は対象component callerでは未使用で、repo-wide static callerも見つからない。
- `RateSet.priceLabel`と`AgreementTable.priceLabel`は欠損時挙動が異なり、後者は価格欠損時にthrowし得る。

## 将来要対応・要確認

- FUT-0065〜FUT-0067へ、本deep reviewのpermission、validation、同時編集・履歴、index/表示errorの証拠を統合する。
- CONF-0051〜CONF-0053の既存上位判断へ統合し、新規CONFは追加しない。

## 未確認範囲

- AirArrayManager/useBaseManager内部のclone、validation、rollback、single-flight、array identity。
- Vuetify defaultsによるdisabled/ARIA補完、runtimeでのdialog・keyboard・focus。
- Firestore Rules実行、同時保存、実dataの欠損・旧形式、component単体test。
