# ARRAY FRONT — GitHub版

フェーズドアレイ武器を設計して戦う、ブラウザ向けの3D FPSです。React / Vite / Three.jsで動きます。ソースをGitHubに保管し、必要ならGitHub Pagesで遊べる形にした単独起動版です。

## まず起動する

Node.js 24とnpmを用意し、このREADMEと`package.json`があるフォルダで実行します。WindowsのPowerShell、macOS、Linuxで同じコマンドを使えます。

```sh
npm ci
npm run dev
```

表示されたローカルURL（通常は `http://127.0.0.1:5173/`）をブラウザで開きます。終了はターミナルでCtrl+C。`index.html`を直接ダブルクリックする起動方法には対応しません。

```sh
npm test          # ゲームロジック・マップ・保存処理を検証
npm run build    # 配信用ファイルをdistに作成
npm run preview  # ビルド結果をローカルで確認
```

WebGL 2が動作するブラウザが必要です。3D描画が始まらないときは、ブラウザのハードウェアアクセラレーションを有効にして再起動してください。音は出撃・クリックなどの操作後に有効になります。

## GitHubにアップロードする

ZIPを解凍し、`package.json`がリポジトリの直下に置かれるようにします。ZIPファイル自体をアップロードする方法では、ソース管理やActionsを利用できません。

1. GitHubで空のリポジトリを作成します。名前の例は`array-front`。公開範囲は用途に応じてPublicまたはPrivateを選び、README・ライセンス・gitignoreの自動追加は選択しません。
2. 解凍先の`array-front-github`フォルダで、以下を実行します。`YOUR_NAME`と`YOUR_REPOSITORY`は作成したリポジトリの値に置き換えます。

```sh
git init -b main
git add .
git commit -m "Add ARRAY FRONT game"
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

GitHubへの認証はGitの案内に従って行います。`node_modules`・ビルド出力・環境変数ファイルは同梱の`.gitignore`で除外します。GitHubリポジトリの作成や実際のアップロードは、このZIPではまだ行っていません。

GitHub Desktopを使う場合は、ローカルリポジトリを作成してこのフォルダの内容をコピーし、コミットして「Publish repository」を使う方法でも保管できます。`.github`フォルダも含めてコピーしてください。

手順の出典：[GitHub公式・既存コードをGitHubに追加する](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

## GitHub Pagesで遊べるようにする（任意）

ソースの保管だけであれば、この設定は不要です。Web公開にはGitHub Pagesが利用できるリポジトリを使います。

1. リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
2. **Actions → Publish game to Pages → Run workflow** を開き、`main`を選んで実行します。
3. 成功後、デプロイ結果またはSettings → Pagesに表示されたURLを開きます。

更新を公開するときも、ソースをpushしてから同じワークフローを実行します。通常のpushでは検証だけが走ります。Pagesのワークフローはテストとビルドが成功した場合に`dist`を公開します。個人用のアクセストークンや外部データベースは不要です。

`base: './'`を指定してあるため、`username.github.io/`と`username.github.io/repository/`のどちらにも対応します。通常の静的Webサーバーでも、`dist`の内容を配信できます。

出典：[GitHub公式・Pagesのカスタムワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。利用可能な公開範囲はGitHubのプランにより異なります。

## 収録内容

- **拠点制圧**：配置と高低差が異なる7マップ。味方AI、敵歩兵、オン／オフ可能な敵ドローン、拠点内の遮蔽、WPT回復。
- **サバイバル**：プレイヤーと50体の敵AI。4マップ、市街地の入れる建物、ランダムな開始地点、各マップ300個の拾得アイテム、縮小する安全地帯。視界内の敵に赤いマーカー・距離を表示しません。
- **難易度**：学士／修士／博士／白根。拠点制圧で3つの学位を修了すると白根が解放されます。サバイバルにも同じ4段階があります。
- **武器設定**：素子数、位相分解能、出力、ビーム幅、ビーム数1〜5、偏向、走査、連射速度、冷却、色、4種類のスコープ。最大3つのセットアップを持ち込み。
- **日頃の行い**：保存した武器ごとの経験値。最大Lv.10。実ダメージ・撃破で成長し、レベルに応じて設定範囲が広がります。サバイバルでは装備を拾って強化します。
- **操作設定**：キー割り当て、マウス／十字キーの感度、音量、画面揺れ、描画品質。銃声、反動、ヘッドショット、スコープ照準。

高層建物は外観を含む試作で、入れるのは地上階です。上階や屋上は閉鎖されています。オンライン対人戦、車両、建物破壊はありません。フェーズドアレイはゲーム用のモデルで、電磁界解析器ではありません。

## 初期操作

| 操作 | キー／マウス |
| --- | --- |
| 移動／視点 | WASD／マウス・十字キー |
| 射撃 | Enter・テンキーEnter／左クリック |
| スコープ | 右クリック長押し |
| ダッシュ／ジャンプ／しゃがむ | Shift／Space／C |
| セル交換／スキャン | R／Q |
| WPT回復 | 拠点制圧では給電範囲で静止してE長押し |
| 装備切替／一時停止 | 1・2・3／Esc |

サバイバルの拾得・回復を含む操作一覧は、ゲーム内のキーセッティングで確認・変更できます。マウスのポインターロックが利用できない環境では、画面端で連続旋回する補完操作になります。

## 保存について

GitHub版の武器設定・修了／撃破記録・経験値・操作設定は**そのブラウザ内**に保存します。ログインやサーバーは必要ありません。別の端末との同期はなく、ブラウザのサイトデータを削除すると記録も消えます。公開中の元ゲームのアカウントデータを自動移行する機能は含みません。ローカル起動とPagesでも保存先は別になります。

武器の設定範囲、白根の解放条件、経験値の重複加算防止は維持しています。保存が拒否された場合はゲーム内にエラーを表示します。複数タブの更新はWeb Locksが利用できるブラウザで直列化します。Web Locksが使えない場合は1つのタブで遊んでください。

## ソース構成

| 場所 | 内容 |
| --- | --- |
| `app/` | メニュー・HUD・武器設定・保存処理 |
| `engine/` | 戦闘、AI、マップ、装備、Three.js |
| `components/ui/` | UI部品 |
| `tests/` | ゲームロジック、UI処理、ローカル保存の検証 |
| `.github/workflows/` | 継続検証と任意のPages公開 |
| `public/` | アイコン・第三者ライセンス |

`app/local-storage.js`が元の認証付き保存APIの役割をブラウザ内で担います。ゲーム内の`fetch`という変数名はこの保存関数の別名で、`/api/`へのネットワーク通信は発生しません。マップと戦闘エンジンは元ゲームの内容を維持しています。

## 検証とライセンス

配布前に依存関係のクリーンインストール、本番ビルド、同梱の自動テスト124件の成功を確認しました。テストは実際のThree.js形状と戦闘ロジックを使いますが、実GPUの画質・速度、ブラウザでのマウス操作、GitHub上のActions実行は対象外です。

第三者ライセンスは[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。この配布物ではゲーム独自コード全体に新たな公開ライセンスを設定していません。`package.json`の`private: true`はnpmへの誤公開を防ぐ設定で、GitHubの公開範囲を指定するものではありません。
