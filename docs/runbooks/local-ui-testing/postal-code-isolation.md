# 専用UIの郵便番号隔離

- 状態: 運用中
- 役割: Codex専用UIで郵便番号検索の外部通信を遮断する個別手順

先に[local UI検証runbook](../local-ui-testing.md)の共通手順を適用する。実装・再検証の適用状態は[検証証拠索引](../../verification/README.md)から対象receiptを参照する。

- Schemasの郵便番号field・共通入力component・保存契約を維持し、専用client buildだけで実解決先の郵便番号検索utilityを無通信・`null`返却moduleへ置換する。7桁入力でも外部検索・住所自動補完はせず、郵便番号と住所の手入力は維持する。通常利用・通常Dev・関連package・data形状は変更しない。
- 対象moduleが見つからない、対象置換が実行されない、隔離成功receiptを確認できない場合はbuild identityを成立させない。生成receiptは固定の非秘密metadataだけとし、古いreceipt/markerを使って成功を装わない。
- 専用dotenvの検査だけでなく、build子processとgenerated serverの有効な公開Firebase設定も固定する。継承環境変数が専用allowlistと衝突する場合は起動前に停止し、診断には変数名だけを使い値を出力しない。設定の不一致を無視して通常環境用buildを専用identityへ偽装しない。
- 再検証は7桁入力の外部fetch 0、住所更新event 0、手入力保存・再表示、通常設定非影響の陰性testと、fresh専用buildの通常UI操作を分ける。未調査の外部hostすべてについて通信0を保証するものではない。
- rollbackは限定実装commitを安全に戻し、生成物・receipt・markerを破棄する。元へ戻すと既存のbrowser直接検索が復帰するため、その状態で専用UIを隔離済みとして再開しない。data migrationは不要。
