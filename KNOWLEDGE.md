# 開発知識メモ

この文書は AirGuardV2 の確定仕様ではなく、開発者の学習と作業補助を目的とした一般的な技術メモです。プロジェクト固有の仕様は `docs/specification.md`、実在する運用手順は `docs/operations.md` を参照してください。

## Git の基本

### 作業状況を確認する

```powershell
git branch --show-current
git status
git diff
```

### 作業ブランチを作成する

```powershell
git switch -c feature/example
```

変更をコミットし、リモートへ初回 push する例:

```powershell
git add <対象ファイル>
git commit -m "変更内容を表すメッセージ"
git push -u origin feature/example
```

`git add .` は意図しないファイルまで含める可能性があるため、差分と対象を確認してから使用します。

### リモートブランチを取得する

```powershell
git fetch origin
git switch --track origin/feature/example
```

### 変更を退避する

未コミットの変更を一時退避する例:

```powershell
git stash push -m "作業内容"
git stash list
git stash pop
```

`git stash pop` は競合する場合があります。重要な変更はコミットまたは別途バックアップしてから操作します。

### 復元の考え方

- 未コミット変更、コミット済み変更、公開済み履歴では安全な復元方法が異なる。
- 共有済みコミットの取り消しには、履歴を書き換えない `git revert <commit>` を優先する。
- `git reset --hard` や強制 push は変更を失うため、対象と影響を確認し、明示的な承認なしに実行しない。

## dayjs

### 基本

```javascript
import dayjs from "dayjs";

const value = dayjs("2026-08-03");
const formatted = value.format("YYYY-MM-DD");
const nextDay = value.add(1, "day");
```

dayjs のオブジェクトは不変であり、`add`、`subtract`、`startOf` などは新しいオブジェクトを返します。戻り値を使用してください。

### UTC とタイムゾーン

```javascript
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const tokyo = dayjs.tz("2026-08-03 09:00", "Asia/Tokyo");
const asUtc = tokyo.utc();
```

- `dayjs.utc(value)` は値を UTC として解釈または UTC 表示へ変換するために使用する。
- `dayjs.tz(value, zone)` は指定タイムゾーンの日時として生成する。
- 日付だけを表す業務値と、世界で一意な時点を表す Timestamp を混同しない。
- Firestore Timestamp、JavaScript `Date`、文字列を相互変換するときは、保存形式と表示タイムゾーンを明示する。

## UI 実装メモ

### 動的な高さとスクロール

スクロールさせる要素に `overflow-y-auto` を指定するだけでなく、その祖先要素まで高さが確定している必要があります。Vuetify では `fill-height` と Flexbox の組み合わせを確認します。

### 省略表示

テーブルセルで ellipsis を使用するときは、幅または最大幅と、`overflow: hidden`、`text-overflow: ellipsis`、`white-space: nowrap` が必要です。テーブルレイアウトによってはラッパー要素へ指定します。

## pdfMake

VFS フォントデータは大きく、初期読込へ影響することがあります。帳票生成時に遅延読み込みし、アプリ起動時のバンドルへ常時含める必要があるかを検討します。
