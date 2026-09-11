import './globals.css'

export const metadata = {
  title: 'SVGMap 本家Container + 追加レイヤー',
  description: 'SVGMap本家資産をNext.jsからそのまま配信するホスト',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  )
}
