import keys from 'when/keys'
import node from 'when/node'
import rest from 'rest'
import fs from 'fs'

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
        .then((res) => {
          compiler.options.locals = Object.assign(compiler.options.locals, res)
        })
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
