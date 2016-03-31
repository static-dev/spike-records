import test from 'ava'
import Roots from 'roots-mini'
import path from 'path'
import Records from '..'

const fixturesPath = path.join(__dirname, 'fixtures')

test.cb('loads data correctly', (t) => {
  const projectPath = path.join(fixturesPath, 'data')
  const project = new Roots({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'app.js')] },
    plugins: [new Records({ test: { foo: 'bar' } })]
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', (data) => {
    // console.log(data)
    t.end()
  })

  project.compile()
})
