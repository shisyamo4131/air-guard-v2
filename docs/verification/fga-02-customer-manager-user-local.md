# FGA-02 Customer Manager 利用者Local検証記録

## 実行条件

- 実行日: 2026-09-10
- 対象: FGA-02-CUSTOMER-MANAGER-02、FGA-02-CUSTOMERS-MANAGER-03、FGA-02-CUSTOMER-ARCHIVE-04、FGA-02-CUSTOMER-LOCAL-05
- 環境: 利用者管理のLocal環境（`http://localhost:3000`）、利用者管理Chrome
- actor: 会社管理者
- source境界: governanceはcommit `25069a79e398ad3fa98b960fb758f18f053238e0`。Customer製品変更は未commitの同一worktreeであり、固定revisionの証拠ではない
- data境界: 合成Customer code `FGA02MGR01`だけを使用した。document ID、tenant、利用者識別情報は記録しない

## 実測結果

| 対象 | 結果 | 観測内容 |
|---|---|---|
| 一覧からのCreate | 成功 | `CustomersManager`の作成入口から登録した。dialogは画面上約476pxで、480px既定と整合した |
| 一覧listener | 成功 | 登録後、表示件数が6件から7件へ更新された |
| 詳細の基本情報Update | 成功 | `CustomerManager`のdialogは画面上約476px。備考を「FGA-02 Manager Local合成データ 更新確認」へ更新し、close後にlistener由来の表示へ反映された |
| 請求・回収条件 | 表示・取消を確認 | dialogは画面上約476px。値は変更せず取消した |
| archive入口 | 表示・取消を確認 | 専用の警告・理由入力dialogへ到達した。archiveは実行せず取消した |
| 物理delete | 入口なし | 通常画面にgenericな物理delete入口がないことを確認した |

## 保証範囲と未検証

- この記録が保証するのは、上記未commit worktree、会社管理者、合成data、記載した正常操作と取消操作の実測だけである。Dev、Prod、remote data、他role、認可陰性は検証していない。
- Autocomplete内Createは、現行routeから到達できる`creatable` callerがないため実UIでは未検証である。actual sourceでは未使用の`SiteManager`内だけにcallerがあり、source contractとcreation bridgeの自動testは接続を検証しているが、このLocal UI証拠の代替にはしない。
- Create・Updateの失敗経路は自動testだけで検証され、利用者Localでは実行していない。archiveの実行、参照拒否、成功後の一覧反映も今回実行していない。
- 開発時console logは`NODE_ENV=development`条件で合成dataだけを対象とし、Prodでは出力しない前提である。Prod artifactの確認は今回の保証範囲外である。

## 終了状態

- 合成Customer `FGA02MGR01`は利用者Localのsaved-dataに保持した。archive・物理delete・cleanupは行っていない。
- 利用者管理processとChromeは停止していない。
- Customer製品変更は未commit、Dev未反映であり、FGA-02は未完了・得点0のままである。
