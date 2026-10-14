import assert from 'node:assert/strict'
import { installOkayamaPropertyView, OKAYAMA_PROPERTY_VIEW } from './okayama-property-view.js'

function fakeMap() {
  const calls = []
  return {
    calls,
    getLayer(id) {
      return { classList: { contains: (name) => name === '岡山大学' && id === 'okayama' } }
    },
    setShowPoiProperty(handler, id) { calls.push({ handler, id }) },
  }
}

const custom = () => {}
const svgmap = fakeMap()
installOkayamaPropertyView(svgmap)
svgmap.setShowPoiProperty(custom, 'okayama')
svgmap.setShowPoiProperty(custom, 'upstream')
svgmap.setShowPoiProperty(custom)
assert.equal(OKAYAMA_PROPERTY_VIEW, 'svgmap')
assert.deepEqual(svgmap.calls, [
  { handler: null, id: 'okayama' },
  { handler: custom, id: 'upstream' },
  { handler: custom, id: undefined },
])

const restored = fakeMap()
installOkayamaPropertyView(restored, 'custom')
restored.setShowPoiProperty(custom, 'okayama')
assert.deepEqual(restored.calls, [{ handler: custom, id: 'okayama' }])
assert.throws(() => installOkayamaPropertyView(fakeMap(), 'invalid'))
console.log('Okayama property view routing passed')
