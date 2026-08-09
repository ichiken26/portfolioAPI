UPDATE products
SET data = json_set(data, '$.body', '## 概要

本サイト

## 実装ポイント

- ページ単位で役割を分離する
- 情報源を Markdown に寄せて更新しやすく
- 一覧と詳細の導線を明確にする
- 追加実績が増えても崩れない共通テンプレートにする
- とにかく遊び心を！

## 画面メモ

シンプルで見やすく、コンポーネントを意識したデザインを心がける  
背景のグリッド線は特技のドット絵のキャンバスをイメージ'),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'portfolio-site';

UPDATE products
SET data = json_set(data, '$.body', '## 概要

仕事用とプライベート用とでメモを分けたいと思い、開発したメモアプリ


## 実装ポイント

- コンポーネントごとの責務を小さく分ける
- Firebase Authを用いて開発者側でOAuth画面を作成することでユーザー情報を受け取りやすくし、タグとそれに紐づけられたメモを、ユーザーごとに関連付けてCloudflare D1に保存

## メモ

新人研修用に作ったものですが、コンポーネントごとのpropsなどのデータの理解、NoSQLにも転用できるIDによる紐づけの考え方、コンポーネントを作ってそれを流用するというNuxtの基本的な考え方を万遍なく学ぶことができる点で優れたプロジェクトだと感じている。  '),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'memo-app';

UPDATE products
SET data = json_set(data, '$.body', '## 概要

CMSからリンク集をイジれるようにし、それを表示フロントで誰でも見れるように公開したもの

## 設計方針

- 表示フロント・外部API・CMSの3つのCloudflare Workersを立て、ビジネスロジックの責任を分離
- Cloudflare D1をDBとして使い、リレーショナルDBを実現
- ブックマークIDとカテゴリーIDを保持し、ブックマーク名とカテゴリー名が変わってもシームレスに更新できるように
- Cloudflare Zero TrustとGoogle OAuthを用いることでGoogle認証を実装し、CMSをセキュリティ的に堅牢に

## 実装ポイント

- CMSはGoogle OAuthとCloudflare Zero Trustを組み合わせ、Google認証を導入
- Cloudflare側でアクセス制限をかけ、自分以外のユーザーはCMSにログイン不可能に
- APIは外部化し、表示用フロントではGETのみ、CMSではすべてのAPIを用いる
- CRUDを丁寧に作りこみ、ドラッグアンドドロップなど、順番をソートするビジネスロジックも実装
  - orderはデフォルトでは10単位の数値で管理、入れ替えるとその中間の値に更新され、PATCHが走る
  - メモやカテゴリのorderをドラッグアンドドロップしたとき、中間の値がなくなったときはPUTとして全体更新を入れるようにし、CMSの動作を軽くするよう工夫

## メモ

普段からバックエンドを主に触っているので、CRUDの設計を丁寧にすることで設計力の向上に努めました。  
また、Google認証によるアクセス制限をかけることで、セキュリティ的にも堅牢にするようにしました。'),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'bookmark-site';

UPDATE products
SET data = json_set(data, '$.body', '## 概要

.NETで動く、WindowsにEmacsキーバインド風のショートカットを追加するためのコンソールアプリです。

## 実装ポイント

- CapsLockキーをF13キーとして変換
- CapsLockにはKeyUpがなく、KeyDownしかないので物理キーのKeyUp, Downとして認識
- それでも順番をうまく認識してくれないので、F13キーのKeyUpとKeyDownの制御タイミングを、物理キーのKeyDownが押されてからそれを一定時間検知しなくなるまでの時間をタイマーとして保持してシステム側で信号を完全に制御

## メモ

CapsLockキーが元々トグルのキーなので挙動に癖があり、デバッグがとても大変でした。
ひとまずのCapsLockキーの制御方法を探る山場は超えたので、後は環境によってどのくらい挙動に差が出るかを手の空いたときに検証予定'),
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'wemacs';
