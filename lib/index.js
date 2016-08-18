const W = require('when')
const keys = require('when/keys')
const node = require('when/node')
const rest = require('rest')
const fs = require('fs')
const path = require('path')
const R = require('ramda')
const reshape = require('reshape')
const mkdirp = require('mkdirp')
const loader = require('reshape-loader')

// this needs to be a function that returns a function
module.exports = class Records {
  constructor (opts) {
    this.opts = opts
  }

  apply (compiler) {
    compiler.plugin('run', run.bind(this, compiler))
    compiler.plugin('watch-run', run.bind(this, compiler))
  }
}

function run (compiler, compilation, done) {
  const tasks = {}

  for (const k in this.opts) {
    if (this.opts[k].data) { tasks[k] = renderData(this.opts[k]) }
    if (this.opts[k].url) { tasks[k] = renderUrl(this.opts[k]) }
    if (this.opts[k].file) {
      tasks[k] = renderFile(compiler.options.context, this.opts[k])
    }
  }

  keys.all(tasks)
    .then(R.mapObjIndexed(transformData.bind(this)))
    .tap(mergeIntoLocals.bind(this))
    .then(R.mapObjIndexed(writeTemplates.bind(this, compiler)))
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

function writeTemplates (compiler, _data, k) {
  const tpl = this.opts[k].template
  const root = compiler.options.context
  const publicPath = compiler.options.output.path

  if (!tpl) { return _data }
  if (!tpl.path) { throw 'missing template.path' } // eslint-disable-line
  if (!tpl.output) { throw 'missing template.output' } // eslint-disable-line

  const data = tpl.transform ? tpl.transform(_data) : _data
  if (!Array.isArray(data)) { throw 'template data is not an array' } // eslint-disable-line

  node.call(fs.readFile.bind(fs), path.join(root, tpl.path), 'utf8')
    .then((template) => {
      return W.map(data, (item) => {
        this.opts.addDataTo = Object.assign(this.opts.addDataTo, {
          item: item,
          filename: path.join(root, tpl.path)
        })

        const outPath = path.join(publicPath, tpl.output(item))
        const mockContext = { resourcePath: outPath, addDependency: (x) => x }
        const options = loader.parseOptions.call(mockContext, compiler.options.reshape, {})

        return reshape(options)
          .process(template)
          .then(((locals, res) => {
            const rendered = res.output(locals)
            mkdirp.sync(path.dirname(outPath))
            return node.call(fs.writeFile.bind(fs), outPath, rendered)
          }).bind(null, Object.assign({}, options.locals)))
      })
    })
}
