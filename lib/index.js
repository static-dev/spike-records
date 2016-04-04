import W from 'when'
import keys from 'when/keys'
import node from 'when/node'
import rest from 'rest'
import fs from 'fs'
import path from 'path'
import R from 'ramda'
import jade from 'jade'

// this needs to be a function that returns a function
export default class Records {
  constructor (opts) {
    this.opts = opts
  }

  apply (compiler) {
    compiler.plugin('run', (compilation, done) => {
      const tasks = {}

      for (const k in this.opts) {
        if (this.opts[k].data) { tasks[k] = renderData(this.opts[k]) }
        if (this.opts[k].file) { tasks[k] = renderFile(this.opts[k]) }
        if (this.opts[k].url) { tasks[k] = renderUrl(this.opts[k]) }
      }

      keys.all(tasks)
        .then(R.mapObjIndexed(transformData.bind(this)))
        .tap(mergeIntoLocals.bind(this, compiler))
        .then(R.mapObjIndexed(writeTemplates.bind(this, compiler)))
        .done(() => { done() }, done)
    })
  }
}

function renderData (obj) {
  return obj.data
}

function renderFile (obj) {
  return node.call(fs.readFile.bind(fs), obj.file, 'utf8')
    .then((content) => { return JSON.parse(content) })
}

function renderUrl (obj) {
  return rest(obj.url).then((res) => { return JSON.parse(res.entity) })
}

function transformData (data, k) {
  if (!this.opts[k].transform) { return data }
  return this.opts[k].transform(data)
}

function mergeIntoLocals (compiler, data) {
  compiler.options.locals = Object.assign(compiler.options.locals, data)
}

function writeTemplates (compiler, _data, k) {
  const tpl = this.opts[k].template
  const root = compiler.options.context

  if (!tpl) { return _data }
  if (!tpl.path || !tpl.out) { throw new Error('missing template property') }

  node.call(fs.readFile.bind(fs), path.join(root, tpl.path, 'utf8'))
    .then((jadeTpl) => {
      const data = tpl.transform ? tpl.transform(_data) : _data
      if (!Array.isArray(data)) { throw new Error('data is not an array') }

      return W.map(data, (item) => {
        const locals = Object.assign(compiler.options.locals, { item: item })
        const rendered = jade.render(jadeTpl, locals)
        const outPath = path.join(root, tpl.out(item))
        return node.call(fs.writeFile.bind(fs), outPath, rendered)
      })
    })
}
