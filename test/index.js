const test = require('ava')
const Spike = require('spike-core')
const path = require('path')
const fs = require('fs')
const Records = require('..')
const rimraf = require('rimraf')
const htmlStandards = require('reshape-standard')

const fixturesPath = path.join(__dirname, 'fixtures')

test('loads data correctly', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'data',
    locals,
    config: { addDataTo: locals, test: { data: { success: 'true' } } },
    verify: (_, publicPath) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>true</p>')
    }
  })
})

test('loads a file correctly', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'data',
    locals: locals,
    config: { addDataTo: locals, test: { file: '../testFile.json' } },
    verify: (_, publicPath) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>true</p>')
    }
  })
})

test('loads a url correctly', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'data',
    locals: locals,
    config: { addDataTo: locals, test: { url: 'http://api.bycarrot.com/v3/staff' } },
    verify: (_, publicPath) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>true</p>')
    }
  })
})

test('loads a graphql endpoint correctly', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'graphql',
    locals: locals,
    config: {
      addDataTo: locals,
      test: {
        graphql: {
          url: 'https://api.graph.cool/simple/v1/cizz44m7pmezz016487cxed19',
          query: '{ allPosts { description } }'
        }
      }
    },
    verify: (_, publicPath) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.regex(out, /test/)
    }
  })
})

test('transform option works', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'data',
    locals: locals,
    config: {
      addDataTo: locals,
      test: {
        data: { success: true },
        transform: (data) => { return { success: false } }
      }
    },
    verify: (_, publicPath) => {
      const out = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      t.is(out.trim(), '<p>false</p>')
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
    },
    locals
  })

  project.on('warning', t.end)
  project.on('compile', t.end)
  project.on('error', (err) => {
    t.is(err.toString(), 'Error: missing template.path')
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
    },
    locals
  })

  project.on('warning', t.end)
  project.on('compile', t.end)
  project.on('error', (err) => {
    t.is(err.toString(), 'Error: missing template.output')
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
      template: { path: 'template.sgr', output: () => { return 'wow.html' } }
    },
    locals
  })

  project.on('warning', t.end)
  project.on('compile', t.end)
  project.on('error', (err) => {
    t.is(err.toString(), 'Error: template data is not an array')
    t.end()
  })

  project.compile()
})

test('single template works with "path" and "template" params', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'template',
    locals: locals,
    config: {
      addDataTo: locals,
      posts: {
        data: [{ title: 'wow' }, { title: 'amaze' }],
        template: {
          path: 'template.sgr',
          output: (item) => `posts/${item.title}.html`
        }
      }
    },
    verify: (_, publicPath) => {
      const index = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      const wow = fs.readFileSync(path.join(publicPath, 'posts/wow.html'), 'utf8')
      const amaze = fs.readFileSync(path.join(publicPath, 'posts/amaze.html'), 'utf8')
      t.is(index.trim(), '<p>2</p>')
      t.is(wow.trim(), '<p>wow</p>')
      t.is(amaze.trim(), '<p>amaze</p>')
    }
  })
})

test('single template works with "transform" param', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'template',
    locals: locals,
    config: {
      addDataTo: locals,
      posts: {
        data: { response: [{ title: 'wow' }, { title: 'amaze' }] },
        template: {
          transform: (data) => data.response,
          path: 'template.sgr',
          output: (item) => `posts/${item.title}.html`
        }
      }
    },
    verify: (_, publicPath) => {
      const index = fs.readFileSync(path.join(publicPath, 'index.html'), 'utf8')
      const wow = fs.readFileSync(path.join(publicPath, 'posts/wow.html'), 'utf8')
      const amaze = fs.readFileSync(path.join(publicPath, 'posts/amaze.html'), 'utf8')
      t.is(index.trim(), '<p>undefined</p>') // bc the transform is not global
      t.is(wow.trim(), '<p>wow</p>')
      t.is(amaze.trim(), '<p>amaze</p>')
    }
  })
})

test('template resolves include/layouts from its own path', (t) => {
  const locals = {}
  return compileAndCheck({
    fixture: 'tpl_resolve',
    locals: locals,
    config: {
      addDataTo: locals,
      posts: {
        data: { response: [{ title: 'wow' }] },
        template: {
          transform: (data) => data.response,
          path: 'templates/tpl.sgr',
          output: (item) => `posts/${item.title}.html`
        }
      }
    },
    verify: (_, publicPath) => {
      const wow = fs.readFileSync(path.join(publicPath, 'posts/wow.html'), 'utf8')
      t.is(wow.trim(), '<p>layout</p>\n<p>template</p>')
    }
  })
})

//
// Utilities
//

/**
 * Given a fixture, records config, and locals, set up a spike project instance
 * and return the instance and project path for compilation.
 * @param  {String} fixturePath - path to the text fixture project
 * @param  {Object} recordsConfig - config to be passed to record plugin
 * @param  {Object} locals - locals to be passed to views
 * @return {Object} projectPath (str) and project (Spike instance)
 */
function configProject (fixturePath, recordsConfig, locals) {
  const projectPath = path.join(fixturesPath, fixturePath)
  const project = new Spike({
    root: projectPath,
    entry: { main: path.join(projectPath, 'app.js') },
    matchers: { html: '*(**/)*.sgr' },
    reshape: htmlStandards({ locals: () => { return locals } }),
    ignore: ['template.sgr'],
    plugins: [new Records(recordsConfig)]
  })
  return { projectPath, project }
}

/**
 * Given a spike project instance, compile it, and return a promise for the
 * results.
 * @param  {Spike} project - spike project instance
 * @return {Promise} promise for a compiled project
 */
function compileProject (project) {
  return new Promise((resolve, reject) => {
    project.on('error', reject)
    project.on('warning', reject)
    project.on('compile', resolve)
    project.compile()
  })
}

/**
 * Compile a spike project and offer a callback hook to run your tests on the
 * results of the project.
 * @param {Object} opts - configuration object
 * @param {String} opts.fixture - name of the project folder inside /fixtures
 * @param {Object} opts.locals - object to be passed to view engine
 * @param {Object} opts.config - config object for records plugin
 * @param {Function} opts.verify - callback for when the project has compiled,
 * passes webpack compile result data and the project's public path
 * @return {Promise} promise for completed compiled project
 */
function compileAndCheck (opts) {
  const {projectPath, project} = configProject(opts.fixture, opts.config, opts.locals)
  const publicPath = path.join(projectPath, 'public')
  return compileProject(project)
    .then((data) => opts.verify(data, publicPath))
    .then(() => rimrafPromise(publicPath))
}

function rimrafPromise (dir) {
  return new Promise((resolve, reject) => {
    rimraf(dir, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}
