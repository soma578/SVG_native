import Script from 'next/script'

export default function HomePage() {
  return (
    <main>
      <img
        id="centerSight"
        alt=""
        width="1"
        height="1"
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
      />
      <div id="mapcanvas" data-src="/svgmapAppLayers/Container.svg" />
      <div id="controller" />
      <div id="layerlist" />
      <div id="layerList" />
      <div id="layerSpecificUI" />
      <div id="initLayerSpecificUI" />
      <Script src="/svgmap-bootstrap.js" type="module" strategy="afterInteractive" />
    </main>
  )
}
