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

test.cb('single template errors with no "path" param', (t) => {
  const {project} = configProject('template', {
    posts: {
      data: [{ title: 'wow' }, { title: 'amaze' }],
      template: {}
    }
  })

  project.on('warning', t.end)
  project.on('compile', t.end)
  project.on('error', (err) => {
    t.is(err.message, 'missing template.path')
    t.end()
  })

  project.compile()
})

test.cb('single template errors with no "output" param', (t) => {
  const {project} = configProject('template', {
    posts: {
      data: [{ title: 'wow' }, { title: 'amaze' }],
      template: { path: 'foo' }
    }
  })

  project.on('warning', t.end)
  project.on('compile', t.end)
  project.on('error', (err) => {
    t.is(err.message, 'missing template.output')
    t.end()
  })

  project.compile()
})

test.cb('single template errors with non-array data', (t) => {
  const {project} = configProject('template', {
    posts: {
      data: 'foo',
      template: { path: 'template.jade', output: () => { return 'wow.html' } }
    }
  })

  project.on('warning', t.end)
  project.on('compile', t.end)
  project.on('error', (err) => {
    t.is(err.message, 'template data is not an array')
    t.end()
  })

  project.compile()
})

test.cb('single template works with "path" and "template" params', (t) => {
  compileAndCheck({
    test: t,
    fixture: 'template',
    config: {
      posts: {
        data: [{ title: 'wow' }, { title: 'amaze' }],
        template: {
          path: 'template.jade',
          output: (item) => `posts/${item.title}.html`
        }
      }
    },
    verify: (_, publicPath, cb) => {
      const index = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      const wow = fs.readFileSync(path.join(publicPath, 'posts/wow.html'), 'utf8')
      const amaze = fs.readFileSync(path.join(publicPath, 'posts/amaze.html'), 'utf8')
      t.is(index, '2')
      t.is(wow, 'wow')
      t.is(amaze, 'amaze')
      cb()
    }
  })
})

test.cb('single template works with "transform" param', (t) => {
  compileAndCheck({
    test: t,
    fixture: 'template',
    config: {
      posts: {
        data: { response: [{ title: 'wow' }, { title: 'amaze' }] },
        template: {
          transform: (data) => data.response,
          path: 'template.jade',
          output: (item) => `posts/${item.title}.html`
        }
      }
    },
    verify: (_, publicPath, cb) => {
      const index = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      const wow = fs.readFileSync(path.join(publicPath, 'posts/wow.html'), 'utf8')
      const amaze = fs.readFileSync(path.join(publicPath, 'posts/amaze.html'), 'utf8')
      t.is(index, '') // because the transform is not global
      t.is(wow, 'wow')
      t.is(amaze, 'amaze')
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
  return { projectPath: projectPath, project: project }
}

function compileProject (project, t, cb) {
  project.on('error', t.end)
  project.on('warning', t.end)
  project.on('compile', cb)
  project.compile()
}

function compileAndCheck (opts) {
  const {projectPath, project} = configProject(opts.fixture, opts.config)
  const publicPath = path.join(projectPath, 'public')
  compileProject(project, opts.test, (data) => {
    opts.verify(data, publicPath, () => { rimraf(publicPath, opts.test.end) })
  })
}
