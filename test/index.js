import example from '../lib/example'
import test from 'ava'

test('example exports correctly', (t) => {
  t.is(example, 'wow es6!')
})
