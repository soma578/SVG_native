# SVGMap (Modular SVGMap.js)

SVGMap は SVG をベースにしたウェブマッピングフレームワークです。従来のフレームワークにはない疎結合で分散型のウェブマッピング機能と、通常のベクトルタイルを超えた高度なタイリング機構を備えており、大規模な WebGIS の実装を可能にします。

標準化活動は W3C で進められています。

* [公式ホームページ](https://svgmap.org/)
* [API ドキュメント（解説書）](https://www.svgmap.org/wiki/index.php?title=%E8%A7%A3%E8%AA%AC%E6%9B%B8)
* [デモ](https://svgmap.org/devinfo/devkddi/lvl0.1/demos/demo0.html)
* [デモ (GitHub Pages)](https://svgmap.github.io/svgMapDemo/) [(ソース)](https://github.com/svgmap/svgMapDemo)

## Modular SVGMap.js について

このリポジトリには、SVGMapLv0.1 を置き換えるモジュール化された SVGMap.js が含まれています。
2022年5月に SVGMapLv0.1_r18module.js として開発が始まり、2024年8月にメインストリームとなりました。

## クイックスタート

JSTS を読み込み、ESM モジュールをインポートすることで SVGMap を使用できます。以下は、地図を表示するための最小限の構成例です。

```html
<!DOCTYPE html>
<html>
<head>
  <title>SVGMap クイックスタート</title>
  <style>
    #mapcanvas { width: 100%; height: 500px; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <div id="mapcanvas"></div>

  <!-- 必須ライブラリ -->
  <script src="https://unpkg.com/jsts@1.6.1/dist/jsts.min.js"></script>
  
  <script type="module">
    import { svgMap } from 'https://cdn.jsdelivr.net/gh/svgmap/svgmapjs@latest/SVGMapLv0.1_r18module.js';
    
    // 地図の初期化
    window.svgMap = svgMap;
    // 例: svgMap.init('mapcanvas', ...);
  </script>
</body>
</html>
```

より詳細な使い方や API リファレンスについては、[API ドキュメント（解説書）](https://www.svgmap.org/wiki/index.php?title=%E8%A7%A3%E8%AA%AC%E6%9B%B8) を参照してください。

## 貢献とフィードバック

皆様からのフィードバックや貢献を歓迎しています！

- **バグ報告や機能リクエスト:** GitHub の [Issue](https://github.com/svgmap/svgmapjs/issues) を作成してください。
- **コードでの貢献:** 開発環境のセットアップやテストの実行手順については、[CONTRIBUTING_ja.md](CONTRIBUTING_ja.md) をご覧ください。

## ライセンス

このプロジェクトは現在、MPL-2.0 ライセンスの下で提供されています。

**ライセンスの更新履歴:**

2025年4月7日、商業利用を含むより広範な利用を可能にするため、貢献者の合意によりライセンスが GPLv3 から MPLv2 に変更されました。詳細は [LICENSE](LICENSE) または [MPL 2.0](https://www.mozilla.org/en-US/MPL/2.0/) を参照してください。
