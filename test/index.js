const test = require('ava')
const Spike = require('spike-core')
const path = require('path')
const fs = require('fs')
const Records = require('..')
const rimraf = require('rimraf')
const exp = require('posthtml-exp')

const fixturesPath = path.join(__dirname, 'fixtures')

test.cb('loads data correctly', (t) => {
  const locals = {}
  compileAndCheck({
    test: t,
    fixture: 'data',
    locals: locals,
    config: { addDataTo: locals, test: { data: { result: 'true' } } },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>true</p>')
      cb()
    }
  })
})

test.cb('loads a file correctly', (t) => {
  const locals = {}
  compileAndCheck({
    test: t,
    fixture: 'data',
    locals: locals,
    config: { addDataTo: locals, test: { file: '../testFile.json' } },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>true</p>')
      cb()
    }
  })
})

test.cb('loads a url correctly', (t) => {
  const locals = {}
  compileAndCheck({
    test: t,
    fixture: 'data',
    locals: locals,
    config: { addDataTo: locals, test: { url: 'http://api.bycarrot.com/staff' } },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>true</p>')
      cb()
    }
  })
})

test.cb('transform option works', (t) => {
  const locals = {}
  compileAndCheck({
    test: t,
    fixture: 'data',
    locals: locals,
    config: {
      addDataTo: locals,
      test: {
        data: { result: true },
        transform: (data) => { return { result: false } }
      }
    },
    verify: (_, publicPath, cb) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>false</p>')
      cb()
    }
  })
})

test.cb('single template errors with no "path" param', (t) => {
  const locals = {}
  const {project} = configProject('template', {
    addDataTo: locals,
    posts: {
      data: [{ title: 'wow' }, { title: 'amaze' }],
      template: {}
    }, locals
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
  const locals = {}
  const {project} = configProject('template', {
    addDataTo: locals,
    posts: {
      data: [{ title: 'wow' }, { title: 'amaze' }],
      template: { path: 'foo' }
    }, locals
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
  const locals = {}
  const {project} = configProject('template', {
    addDataTo: locals,
    posts: {
      data: 'foo',
      template: { path: 'template.jade', output: () => { return 'wow.html' } }
    }, locals
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
  const locals = {}
  compileAndCheck({
    test: t,
    fixture: 'template',
    locals: locals,
    config: {
      addDataTo: locals,
      posts: {
        data: [{ title: 'wow' }, { title: 'amaze' }],
        template: {
          path: 'template.html',
          output: (item) => `posts/${item.title}.html`
        }
      }
    },
    verify: (_, publicPath, cb) => {
      const index = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      const wow = fs.readFileSync(path.join(publicPath, 'posts/wow.html'), 'utf8')
      const amaze = fs.readFileSync(path.join(publicPath, 'posts/amaze.html'), 'utf8')
      t.is(index.trim(), '<p>2</p>')
      t.is(wow.trim(), '<p>wow</p>')
      t.is(amaze.trim(), '<p>amaze</p>')
      cb()
    }
  })
})

test.cb('single template works with "transform" param', (t) => {
  const locals = {}
  compileAndCheck({
    test: t,
    fixture: 'template',
    locals: locals,
    config: {
      addDataTo: locals,
      posts: {
        data: { response: [{ title: 'wow' }, { title: 'amaze' }] },
        template: {
          transform: (data) => data.response,
          path: 'template.html',
          output: (item) => `posts/${item.title}.html`
        }
      }
    },
    verify: (_, publicPath, cb) => {
      const index = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      const wow = fs.readFileSync(path.join(publicPath, 'posts/wow.html'), 'utf8')
      const amaze = fs.readFileSync(path.join(publicPath, 'posts/amaze.html'), 'utf8')
      t.is(index.trim(), '<p></p>') // bc the transform is not global
      t.is(wow.trim(), '<p>wow</p>')
      t.is(amaze.trim(), '<p>amaze</p>')
      cb()
    }
  })
})

//
// Utilities
//

function configProject (fixturePath, recordsConfig, locals) {
  const projectPath = path.join(fixturesPath, fixturePath)
  const project = new Spike({
    root: projectPath,
    entry: { main: [path.join(projectPath, 'app.js')] },
    posthtml: { plugins: [exp({ locals })] },
    ignore: ['template.html'],
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
  const {projectPath, project} = configProject(opts.fixture, opts.config, opts.locals)
  const publicPath = path.join(projectPath, 'public')
  compileProject(project, opts.test, (data) => {
    opts.verify(data, publicPath, () => { rimraf(publicPath, opts.test.end) })
  })
}
