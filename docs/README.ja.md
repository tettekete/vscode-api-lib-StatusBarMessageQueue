<p align="center"><a href="../README.md">English</a> / 日本語</p>

# 概要

VSCode 機能拡張開発向けの `StatusBarMessageQueue` クラスの開発ポジトリです。

`StatusBarMessageQueue` が依存する `DynamicWait` クラスもリポジトリに含まれています。


# StatusBarMessageQueue クラス

`vscode.window.setStatusBarMessage` による表示を順次表示するためのキューイングクラスです。

通常 `setStatusBarMessage` は以前の `setStatusBarMessage` が表示したメッセージを即座に上書きしてしまいます。

`StatusBarMessageQueue` クラスでは `setStatusBarMessage` 向けのメッセージをキューイングし、順次（若しくはプライオリティーの高い順に）表示することが出来ます。

また最大表示時間（デフォルト10秒）を越えないように自動的に 1 メッセージあたりの表示時間を圧縮する機能も実装されています。

シングルトン設計のため、`import`  さえすればどこからでも共通のキューを利用できます。

## USAGE

```ts
const messageQueue = StatusBarMessageQueue.getInstance();

messageQueue.enqueue( "I'm watching you.",3000 );
messageQueue.enqueue( "I am a cat.",3000 );
messageQueue.enqueue( "Give me a snack.",3000 );
```

![I am cat demo](./images/demo.gif)


