import keys from 'when/keys'
import node from 'when/node'
import rest from 'rest'
import fs from 'fs'
import R from 'ramda'

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
        .then(mergeIntoLocals.bind(this, compiler))
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
