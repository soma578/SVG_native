// Deployment setting for layers in the 岡山大学 group.
// Change only this value to 'custom' to restore their existing detail cards.
export const OKAYAMA_PROPERTY_VIEW = 'svgmap'

export function installOkayamaPropertyView(svgMap, mode = OKAYAMA_PROPERTY_VIEW) {
  if (mode !== 'svgmap' && mode !== 'custom') throw new Error(`Unsupported property view: ${mode}`)
  const original = svgMap.setShowPoiProperty.bind(svgMap)
  svgMap.setShowPoiProperty = (handler, layerId) => {
    const layer = layerId ? svgMap.getLayer(layerId) : null
    const okayama = layer?.classList?.contains('岡山大学')
      || layer?.getAttribute?.('class')?.split(/\s+/).includes('岡山大学')
    if (okayama && handler && mode === 'svgmap') {
      // Keep the layer's custom code intact; without its override SVGMap uses
      // the host's safe property/content table (based on the upstream demo).
      return original(null, layerId)
    }
    return original(handler, layerId)
  }
}
