import test from 'ava'
import Roots from 'roots-mini'
import path from 'path'
import fs from 'fs'
import Records from '..'
import rimraf from 'rimraf'

const fixturesPath = path.join(__dirname, 'fixtures')

test.cb('loads data correctly', (t) => {
  compileAndCheck({
    test: t,
    fixture: 'data',
    config: { test: { data: { result: 'true' } } },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out, 'true')
      cb()
    }
  })
})

test.cb('loads a file correctly', (t) => {
  compileAndCheck({
    test: t,
    fixture: 'data',
    config: { test: { file: 'fixtures/testFile.json' } },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out, 'true')
      cb()
    }
  })
})

test.cb('loads a url correctly', (t) => {
  compileAndCheck({
    test: t,
    fixture: 'data',
    config: { test: { url: 'http://api.bycarrot.com/staff' } },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out, 'true')
      cb()
    }
  })
})

test.cb('transform option works', (t) => {
  compileAndCheck({
    test: t,
    fixture: 'data',
    config: {
      test: {
        data: { result: true },
        transform: (data) => { return { result: false } }
      }
    },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out, 'false')
      cb()
    }
  })
})

//
// Utilities
//

function configProject (fixturePath, recordsConfig) {
  const projectPath = path.join(fixturesPath, fixturePath)
  const project = new Roots({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'app.js')] },
    plugins: [new Records(recordsConfig)]
  })
  return [projectPath, project]
}

function compileProject (project, t, cb) {
  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', cb)
  project.compile()
}

function compileAndCheck (opts) {
  const [projectPath, project] = configProject(opts.fixture, opts.config)
  const publicPath = path.join(projectPath, 'public')
  compileProject(project, opts.test, (data) => {
    opts.verify(data, publicPath, () => { rimraf(publicPath, opts.test.end) })
  })
}
