# SecurityReport Functions deep review

## メタデータ

- 状態: 実装調査
- 対象チェックポイント: SPEC-DEEP-008
- 最終確認日: 2026-08-11
- 対象: `functions/modules/securityReport/**` 6ファイル
- 境界: trigger/callableは直接callerと入口guardだけを照合し、runtime、Storage実データ、deploy状態は確認していない。

> 後続改修: 2026-08-15に警備日報インデックス再構築Callableは、verified email、token/current Auth双方の同社会社claim・`isSuperUser`・有効状態、同社の有効な本登録User、要求会社一致を共有認可で強制するよう変更した。以下の入口guard記述は2026-08-11時点の基準線であり、現在の境界は`callable-authorization.md`を正とする。

## ファイル別公開契約

| ファイル | export / 入出力 | 責務・主要分岐 | 到達経路 |
| --- | --- | --- | --- |
| `index.js` | ほか5 helperをnamed re-export | module barrel。独自処理なし | Storage trigger、SecurityReport index再構築callable |
| `parseSecurityReportPath.js` | `parseSecurityReportPath(filePath)` → path情報または`null` | `Companies/{companyId}/Operations/{operationId}/SecurityReports/{name}.jpg`だけを受理し、`_thumb.jpg`をthumbnailと判定する | finalize/delete trigger、rebuild、同期 |
| `createSecurityReportThumbnail.js` | `{bucketName,filePath,fileName}` → thumbnail path | 元画像を全downloadし、Sharpで400×400内・拡大なし・JPEG quality 80へ変換して同folderへsaveする | finalize triggerのみ |
| `fetchOperationDateAt.js` | `{companyId,operationId}` → `Date|null` | 同社prefixでOperationResultを先にfetchし、なければSiteOperationScheduleへfallbackする | 索引同期のみ |
| `syncSecurityReportIndex.js` | `{bucketName,companyId,operationId}` → 本体画像件数 | folderを列挙して本体`.jpg`を絶対件数再計算。0件なら既存索引削除、関連稼働なしでも既存索引削除、あればdate/countをcreate/update | finalize/delete trigger、再構築 |
| `rebuildSecurityReportIndexes.js` | `companyId` → `{processedCount,indexedCount}` | company Storageの本体画像operationIdと既存索引IDの和集合を20件ずつ同期し、最後に索引全件を再取得する | `rebuildSecurityReportIndexes` callable |

## Storage・索引フロー

1. 本体画像finalize eventはparser不一致またはthumbnailなら終了する。
2. 本体なら先に`syncSecurityReportIndex`を待ち、成功後にthumbnailを生成する。
3. thumbnail finalize eventはparserでthumbnailと判定され、再帰処理しない。
4. 本体delete eventは索引だけを再同期する。thumbnail delete eventは何もしない。
5. 再構築は`Companies/{companyId}/Operations/`を全列挙し、既存索引も候補へ加えるため、Storageに本体がないstale索引も削除対象になる。

本体画像のpathは`.jpg`で終わる単一階層だけを対象とする。サムネイル名は末尾`.jpg`を`_thumb.jpg`へ置換する。thumbnail saveは同一pathを上書きするため再実行で重複fileは増えないが、version preconditionやgeneration検証はない。

## 認証・テナント境界

6 helper自身は認証、role、tenant、入力field allowlistを実施しない。Storage eventではpathからcompanyId/operationIdを信頼してAdmin SDKで処理する。再構築callableだけが認証済みかつcustom claim `isSuperUser === true`を強制し、stringのcompanyIdを受ける。super-userは全会社横断の運営者という承認済み境界であり、caller companyとの一致は要求しない。App Check、rate limit、監査reason/run IDは入口にない。

`fetchOperationDateAt`と索引保存は同じcompany prefixを用いるため、pathに埋め込まれたcompany内だけを検索・保存する。ただしStorageへの元画像write認可はこのmoduleではなくStorage Rules境界であり、現行の認証のみ許可という問題はFUT-0105で管理する。

## 失敗・再試行・並行性

- `syncSecurityReportIndex`はincrementではなくStorageの現状から再計算するため、同一eventの再実行でcount加算重複は起きない。create/update/deleteは逐次でtransactionやgeneration compareはないため、並行upload/deleteの列挙時点と後続eventの順序に依存する一時的staleはあり得る。
- finalizeは索引同期後にthumbnail生成する。thumbnail decode/save失敗では索引だけ成功した部分状態になる。platform retryが行われれば索引を再計算し、thumbnailを同一pathへ再保存できるが、retry option、dead-letter、失敗監視はコードに明示されない。
- 本体deleteは対応thumbnailを削除しない。client側削除または親cleanupがthumbnail削除に失敗するとorphanが残り、delete triggerもrebuildもこれを除去しない。
- 関連OperationResult/Scheduleがない場合は索引だけを削除し、Storage本体は保持する。再構築も同じ動作で、orphan本体の隔離・削除・報告はしない。
- 再構築はStorage全件と索引全件をmemoryへ取得する。operationIdはSetで重複排除し、20件chunk内を`Promise.all`する。1件rejectでchunk全体がfail-fastとなるが、同chunkの開始済み処理はrollbackされず、後続chunkへ進まず、failed IDやresume cursorを返さない。
- `processedCount`は候補ID数、`indexedCount`は再取得したcollection全件数であり、今回成功したcreate/update件数ではない。
- thumbnail生成は元file全体をmemoryへdownloadし、入力size/pixel上限をmoduleで検証しない。Sharp例外はcatchせずtriggerへ伝播する。

## 未使用・コメント差・テスト

- 6 exportはすべて直接callerがあり、未使用exportは確認しなかった。
- parserの契約とtrigger commentは`.jpg`、thumbnail除外で一致する。
- helper単体、Storage event、並行event、rebuild partial failureを対象とするrepository内testは静的検索で確認できなかった。
- ログはcompanyId、operationId、reportCount、action、thumbnail path/bytesを出力する。tokenや画像内容は出力しないが、識別子とpathの保持・閲覧境界は監視基盤の方針に従う必要がある。

## 既存台帳との対応

- FUT-0105: 元画像Storage認可。今回のAdmin helperはpath由来tenant内で処理するが、upload主体を再検証しない。
- FUT-0107: thumbnail処理前のsize/MIME/magic bytes/pixel上限がない。
- FUT-0109: 索引の絶対再計算、部分状態、orphan本体/thumbnail、reconcile不足。
- FUT-0110: 全件列挙、20件chunk fail-fast、failed ID/resume/進捗・監視不足。
- CONF-0088〜0092は業務方針の判断であり、6 helperの実装事実だけでは解消しない。新規CONFは追加しない。

## 未確認範囲

Eventarcの実際のretry設定・順序、Storage generation/versioning/lifecycle、remote deploy、実画像decoder挙動、実データ件数・memory使用量、監視・alert、runtime testは未確認である。
