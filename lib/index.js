const W = require('when')
const keys = require('when/keys')
const node = require('when/node')
const rest = require('rest')
const fs = require('fs')
const path = require('path')
const reshape = require('reshape')
const loader = require('reshape-loader')

// this needs to be a function that returns a function
module.exports = class Records {
  constructor (opts) {
    this.opts = opts
  }

  apply (compiler) {
    compiler.plugin('run', run.bind(this, compiler))
    compiler.plugin('watch-run', run.bind(this, compiler))

    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('normal-module-loader', (loaderContext) => {
        this.loaderContext = loaderContext
      })
    })

    compiler.plugin('emit', (compilation, done) => {
      keys.map(this._locals, writeTemplates.bind(this, compilation, compiler))
        .done(() => { done() }, done)
    })
  }
}

function run (compiler, compilation, done) {
  const tasks = {}
  const templates = []

  for (const k in this.opts) {
    if (this.opts[k].data) { tasks[k] = renderData(this.opts[k]) }
    if (this.opts[k].url) { tasks[k] = renderUrl(this.opts[k]) }
    if (this.opts[k].file) {
      tasks[k] = renderFile(compiler.options.context, this.opts[k])
    }
    if (this.opts[k].template && Object.keys(this.opts[k].template).length) {
      templates.push(this.opts[k].template.path)
    }
  }

  // templates need to be ignored as they often contain extra variables
  templates.map((t) => {
    const ignorePath = path.join(compiler.options.context, t)
    compiler.options.spike.ignore.push(ignorePath)
  })

  keys.all(tasks)
    .then((tasks) => keys.map(tasks, transformData.bind(this)))
    .tap(mergeIntoLocals.bind(this))
    .then((locals) => { this._locals = locals })
    .done(() => { done() }, done)
}

function renderData (obj) {
  return obj.data
}

function renderFile (root, obj) {
  return node.call(fs.readFile.bind(fs), path.join(root, obj.file), 'utf8')
    .then((content) => { return JSON.parse(content) })
}

function renderUrl (obj) {
  return rest(obj.url).then((res) => { return JSON.parse(res.entity) })
}

function transformData (data, k) {
  if (!this.opts[k].transform) { return data }
  return this.opts[k].transform(data)
}

function mergeIntoLocals (data) {
  this.opts.addDataTo = Object.assign(this.opts.addDataTo, data)
}

function writeTemplates (compilation, compiler, _data, k) {
  const tpl = this.opts[k].template
  const root = compiler.options.context

  if (!tpl) { return _data }
  if (!tpl.path) { throw 'missing template.path' } // eslint-disable-line
  if (!tpl.output) { throw 'missing template.output' } // eslint-disable-line

  const data = tpl.transform ? tpl.transform(_data) : _data
  if (!Array.isArray(data)) { throw 'template data is not an array' } // eslint-disable-line

  return node.call(fs.readFile.bind(fs), path.join(root, tpl.path), 'utf8')
    .then((template) => {
      return W.map(data, (item) => {
        Object.assign(this.opts.addDataTo, {
          item: item,
          filename: path.join(root, tpl.path)
        })

        const options = loader.parseOptions.call(this.loaderContext, compiler.options.reshape, {})

        return reshape(options)
          .process(template)
          .then(((locals, res) => {
            const rendered = res.output(locals)
            compilation.assets[tpl.output(item)] = {
              source: () => rendered,
              size: () => rendered.length
            }
          }).bind(null, Object.assign({}, options.locals)))
      })
    })
}
