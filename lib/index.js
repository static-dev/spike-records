const W = require('when')
const keys = require('when/keys')
const node = require('when/node')
const rest = require('rest')
const fs = require('fs')
const path = require('path')
const reshape = require('reshape')
const loader = require('reshape-loader')
const SpikeUtil = require('spike-util')
const bindAll = require('es6bindall')

// A spike plugin is a webpack plugin. This source will be much easier to
// navigate if you have an understanding of how webpack plugins work!
// https://webpack.js.org/development/how-to-write-a-plugin/
module.exports = class Records {
  constructor (opts) {
    this.opts = opts
    // We need to bind the apply method so that it has access to `this.opts` as
    // set above. Otherwise, `this` is set to webpack's compiler instance.
    bindAll(this, ['apply'])
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)

    // As soon as we can, we want to resolve the data from its sources. The
    // run hook is a perfect place to do this, it's early and async-compatible.
    this.util.runAll(compiler, run.bind(this, compiler))

    // When rendering templates, reshape setting can use the loader context to
    // determine, for example, the currently processed file's name. As such, we
    // need a copy of the loader context for when we render them.
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('normal-module-loader', (loaderContext) => {
        this.loaderContext = loaderContext
      })
    })

    // As the other templates are being written, we write out single page
    // templates as well.
    compiler.plugin('emit', (compilation, done) => {
      keys.map(this._locals, writeTemplates.bind(this, compilation, compiler))
        .done(() => { done() }, done)
    })
  }
}

/**
 * The main "run" function is responsible for resolving the data and placing it
 * on the addDataTo object. It also has some setup steps for template rendering.
 * @param  {Compiler} compiler - webpack compiler instance
 * @param  {Compilation} compilation - webpack compilation instance
 * @param  {Function} done - callback for when we're finished
 */
function run (compiler, compilation, done) {
  const tasks = {}
  const spikeOpts = this.util.getSpikeOptions()

  // First, we go through each of the keys in the plugin's options and resolve
  // the data as necessary. Data from files or urls will return promises. We
  // place all resolved data and promised into a "tasks" object with their
  // appropriate keys. Promises still need to be resolved at this point.
  for (const k in this.opts) {
    if (this.opts[k].data) { tasks[k] = renderData(this.opts[k]) }
    if (this.opts[k].url) { tasks[k] = renderUrl(this.opts[k]) }
    if (this.opts[k].graphql) { tasks[k] = renderGraphql(this.opts[k]) }
    if (this.opts[k].file) {
      tasks[k] = renderFile(compiler.options.context, this.opts[k])
    }

    // Here, we check to see if the user has provided a single-view template,
    // and if so, add its path to spike's ignores. This is because templates
    // render separately with special variables through this plugin and
    // shouldn't be processed as normal views by spike.
    const tpl = this.opts[k].template
    if (tpl && Object.keys(tpl).length) {
      spikeOpts.ignore.push(path.join(compiler.options.context, tpl.path))
    }
  }

  // Here's where the magic happens. First we use the when/keys utility to go
  // through our "tasks" object and resolve all the promises. More info here:
  // https://github.com/cujojs/when/blob/master/docs/api.md#whenkeys-all
  keys.all(tasks)
    // Then we go through each of they keys again, applying the user-provided
    // transform function to each one, if it exists.
    .then((tasks) => keys.map(tasks, transformData.bind(this)))
    // After this, we add the fully resolved and transformed data to the
    // addDataTo object, so it can be made available in views.
    .tap(mergeIntoLocals.bind(this))
    // Then we save the locals on a class property for templates to use. We will
    // need this in a later webpack hook when we're writing templates.
    .then((locals) => { this._locals = locals })
    // And finally, tell webpack we're done with our business here
    .done(() => { done() }, done)
}

// Below are the methods we use to resolve data from each type. Very
// straightforward, really.
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

function renderGraphql (obj) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, obj.graphql.headers)

  return rest({
    path: obj.graphql.url,
    entity: JSON.stringify({
      query: obj.graphql.query,
      variables: obj.graphql.variables
    }),
    headers
  }).then((res) => { return JSON.parse(res.entity) })
}

/**
  * If the user provided a transform function for a given data source, run the
  * function and return the transformed data. Otherwise, return the data as it
  * exists inititally.
 * @param  {Object} data - data as resolved from user-provided data source
 * @param  {String} k - key associated with the data
 * @return {Object} Modified or original data
 */
function transformData (data, k) {
  if (!this.opts[k].transform) { return data }
  return this.opts[k].transform(data)
}

/**
 * Given an object of resolved data, add it to the `addDataTo` object.
 * @param  {Object} data - data resolved by the plugin
 */
function mergeIntoLocals (data) {
  this.opts.addDataTo = Object.assign(this.opts.addDataTo, data)
}

/**
 * Single page templates are a complicated business. Since they need to be
 * parsed with a custom set of locals, they cannot be rendered purely through
 * webpack's pipeline, unless we required a function wrapper for the locals
 * object like spike-collections does. As such, we render them manually, but in
 * a way that exactly replicates the way they are rendered through the reshape
 * loader webpack uses internally.
 *
 * When called in the webpack emit hook above, it per key -- that is, if the
 * user has specified:
 *
 * { test: { url: 'http://example.com' }, test2: { file: './foo.json' } }
 *
 * This method will get the 'test' and 'test2' keys along with their resolved
 * data from the data sources specified.
 *
 * @param  {Compilation} compilation - webpack compilation instance
 * @param  {Compiler} compiler - webpack compiler instance
 * @param  {Object} _data - resolved data for the user-given key
 * @param  {String} k - key name for the data
 * @return {Promise} promise for written templates
 */
function writeTemplates (compilation, compiler, _data, k) {
  const tpl = this.opts[k].template
  const root = compiler.options.context

  // If the template option doesn't exist or is malformed, we return or error.
  if (!tpl) { return _data }
  if (!tpl.path) { throw new Error('missing template.path') }
  if (!tpl.output) { throw new Error('missing template.output') }

  // If there is also a template transform function, we run that here
  const data = tpl.transform ? tpl.transform(_data) : _data
  // We must ensure that template data is an array to render each item
  if (!Array.isArray(data)) { throw new Error('template data is not an array') }

  // First we read the template file
  return node.call(fs.readFile.bind(fs), path.join(root, tpl.path), 'utf8')
    .then((template) => {
      // Now we go through each item in the data array to render a template
      return W.map(data, (item) => {
        // The template gets all the default locals as well as an "item" prop
        // that contains the data specific to the template, and a filename
        const newLocals = Object.assign({}, this.opts.addDataTo, {
          item,
          filename: path.join(root, tpl.path)
        })

        // We need to precisely replicate the way reshape is set up internally
        // in order to render the template correctly, so we run the reshape
        // loader's options parsing with the real loader context and the user's
        // reshape options from the config
        const options = loader.parseOptions.call(this.loaderContext, this.util.getSpikeOptions().reshape, {})

        // And finally, we run reshape to generate the template!
        return reshape(options)
          .process(template)
          .then((res) => {
            const rendered = res.output(newLocals)
            // And then add the generated template to webpack's output assets
            compilation.assets[tpl.output(item)] = {
              source: () => rendered,
              size: () => rendered.length
            }
          })
      })
    })
}
