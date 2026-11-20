# keijiban-cfw

Cloudflare Workers + D1（バインディング名: `DB`）のカウンターと、ローカル専用のDBビューア。

## ドキュメントの役割

この README はプロジェクトの構成と利用・開発・デプロイの手順を管理します。エージェント向けの作業ルールは [AGENTS.md](AGENTS.md) に記載し、コマンドや設定値はこの README に集約します。

## 起動方法

DockerとDocker Composeを用意し、リポジトリのルートで実行します。npmはすべてコンテナ内で実行します。

```bash
docker compose up --build -d workers admin-db
```

- アプリ: http://localhost:8787/
- DBビューア: http://localhost:8080/

起動時にローカルDBへマイグレーションを適用します。ローカル開発はD1のローカルの保存領域（`preview_database_id`）を使います。停止は `docker compose down`。D1のデータは名前付きボリュームに保存され、`down -v` で削除されます。

再起動は `bash restart-docker.sh`。`docker compose down` の後に `docker compose up -d` を実行します。

## 編集する場所

- アプリ画面: `source/public/`
- アプリAPI: `source/src/index.ts`
- DBスキーマ: `source/migrations/`
- DBビューア: `source-db-admin/src/`、`source-db-admin/public/`
- Worker設定: 各ディレクトリの `wrangler.jsonc`
- Docker設定: `docker-compose.yml`、`docker/`

ソース変更はホットリロードされます。依存関係を変更したら対象コンテナで `npm install` を実行し、`docker compose up --build -d` で再ビルドします。

型は `wrangler types` が生成する `worker-configuration.d.ts` を使用します。以下で型を再生成してチェックします。

```bash
docker compose exec workers npm run check
docker compose exec admin-db npm run check
```

スキーマ変更は新しいマイグレーションSQLに追加し、ローカルへ手動適用する場合は次を実行します。

```bash
docker compose stop admin-db workers
docker compose run --rm --no-deps workers npm run db:migrate:local
docker compose up -d workers admin-db
```

## デプロイ方法

D1の名前は作成時にアプリごとに決めます（例: `keijiban-cfw-db`）。Wrangler設定では `database_name` を省略し、本番の接続先は `database_id` のUUIDで指定します。マイグレーションのコマンドはバインディング名の `DB` を指定するため、DB名をコマンドに記載する必要はありません。ローカルでは `preview_database_id` を使い、DBビューアにもバインディング名の `DB` を表示します。

本番のD1は初回に手動作成し、IDをWrangler設定に記載します。デプロイ時はD1の未適用のマイグレーションを適用してからWorkerを公開します。マイグレーションが失敗した場合は公開を停止します。

1. Cloudflareのデプロイ先アカウントで「D1 SQL database」を開き、このアプリ専用の名前（例: `keijiban-cfw-db`）でDBを作成します。
2. 作成したD1のUUIDをコピーし、`source/wrangler.jsonc` と `source-db-admin/wrangler.jsonc` の `database_id` に設定します（設定済み: `d62d0127-096f-4741-afcc-92c36be607d7`）。
3. 設定変更をコミットしてGitHubへプッシュしてから、以下のWorker作成・デプロイ設定を行います。

既存のD1を使う場合は、接続したいリソースのIDを設定します。ローカル用の `preview_database_id` は、アプリとDBビューアが同じローカルDBを使うため、そのままにします。[D1の作成・設定手順](https://developers.cloudflare.com/d1/get-started/)。

IDは認証情報ではないためWrangler設定で管理し、APIトークンはCloudflareのビルド設定で管理します。ID欄は空欄や省略にせず、作成したリソースのIDに置き換えてください。

Cloudflareの「アプリケーションをセットアップする」画面でGitHubリポジトリを選び、以下を設定します。

| 項目 | 設定値 |
| --- | --- |
| プロジェクト名 | `keijiban-cfw`（`source/wrangler.jsonc` の `name` と一致させる） |
| ビルドコマンド | 空欄 |
| デプロイコマンド | `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy` |
| プレビューコマンド | `npx wrangler preview` |
| プレビュービルドを有効化 | 本番だけを配信する場合はオフ |
| Cloudflare Accessで保護 | 公開ページとして使う場合はオフ |
| 詳細設定 → パス | `source` |
| 詳細設定 → APIトークン | 下記の権限を持つ、このアカウントのユーザートークン |
| 環境変数 | このスターターでは追加不要 |

APIトークン欄の「新しいトークンを作成する」を使うか、既存トークンを選択します。自動作成されたトークンの既定権限は残し、[My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) で以下を確認・追加してください。アカウントの対象はデプロイ先に合わせます。

| アカウントの権限 | 用途 |
| --- | --- |
| Workers Scripts → Edit | Workerのデプロイ |
| D1 → Edit | 本番DBへのマイグレーション適用 |
| Artifacts → Read | 警告の `artifacts_read` に対応 |
| Artifacts → Edit | 警告の `artifacts_write` に対応 |

Workersの新しい権限画面では、デプロイ先Workerの `Editor` を指定します。トークンで新規Workerも作成する場合は `Admin` が必要です。[Workersの権限](https://developers.cloudflare.com/workers/authorization/workers/)。

`artifacts_read`・`artifacts_write` の不足が表示された場合は、上記のArtifacts権限を追加してトークンを再選択します。Artifactsの書き込み権限は画面では `Edit` と表記されます。[Artifactsの認証](https://developers.cloudflare.com/artifacts/guides/authentication/)。

プレビュービルドを有効にする場合は、プレビュー用のD1バインディングとテーブルを別途設定してください。[Preview設定](https://developers.cloudflare.com/workers/previews/get-started/)。[ビルド画面の設定項目](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)。

手動デプロイは `docker compose exec workers npm run deploy`。上記と同じ順序でマイグレーション、デプロイを実行します。`source-db-admin/` はローカル専用です。
