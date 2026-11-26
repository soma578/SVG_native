import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inOkayama, loadOkayamaBoundary, parseTile } from './aed-navi-data.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('AED tile parser rejects malformed rows and keeps the published hours', () => {
  const valid = ['123', '6', '10', '34.65', '133.90', '1', '1', '1', '0', '09001700',
    '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '00000000', '1', '5133', '513365', '51336549'].join('\t')
  const result = parseTile(`${valid}\ninvalid\trow`)
  assert.equal(result.length, 1)
  assert.deepEqual([result[0].id, result[0].lat, result[0].lng, result[0].hours[0]], [123, 34.65, 133.9, '09001700'])
})

test('Okayama municipal boundaries exclude adjacent prefectures', () => {
  const boundary = loadOkayamaBoundary(root)
  assert.equal(inOkayama(34.6507, 133.9159, boundary), true) // 岡山大学病院
  assert.equal(inOkayama(34.69, 135.20, boundary), false) // 神戸市
})
