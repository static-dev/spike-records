import test from 'ava'
import Roots from 'roots-mini'
import path from 'path'
import fs from 'fs'
import Records from '..'
import rimraf from 'rimraf'

const fixturesPath = path.join(__dirname, 'fixtures')

test.cb('loads data correctly', (t) => {
  const projectPath = path.join(fixturesPath, 'data')
  const project = new Roots({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'app.js')] },
    plugins: [new Records({ test: { data: { result: 'true' } } })]
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', (data) => {
    const out = fs.readFileSync(path.join(projectPath, 'public/index.html'), 'utf8')
    t.is(out, 'true')
    rimraf(path.join(projectPath, 'public'), t.end)
  })

  project.compile()
})

test.cb('loads a file correctly', (t) => {
  const projectPath = path.join(fixturesPath, 'data')
  const project = new Roots({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'app.js')] },
    plugins: [new Records({ test: { file: 'fixtures/testFile.json' } })]
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', (data) => {
    const out = fs.readFileSync(path.join(projectPath, 'public/index.html'), 'utf8')
    t.is(out, 'true')
    rimraf(path.join(projectPath, 'public'), t.end)
  })

  project.compile()
})

test.cb('loads a url correctly', (t) => {
  const projectPath = path.join(fixturesPath, 'data')
  const project = new Roots({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'app.js')] },
    plugins: [new Records({ test: { url: 'http://api.bycarrot.com/staff' } })]
  })

  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', (data) => {
    const out = fs.readFileSync(path.join(projectPath, 'public/index.html'), 'utf8')
    t.is(out, 'true')
    rimraf(path.join(projectPath, 'public'), t.end)
  })

  project.compile()
})
