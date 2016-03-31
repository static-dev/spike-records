# roots-mini-records

[![npm](http://img.shields.io/npm/v/roots-mini-records.svg?style=flat)](https://badge.fury.io/js/roots-mini-records) [![tests](http://img.shields.io/travis/carrot/roots-mini-records/master.svg?style=flat)](https://travis-ci.org/carrot/roots-mini-records) [![dependencies](http://img.shields.io/gemnasium/carrot/roots-mini-records.svg?style=flat)](https://david-dm.org/carrot/roots-mini-records)

remote data -> static templates

> **Note:** This project is in early development, and versioning is a little different. [Read this](http://markup.im/#q4_cRZ1Q) for more details.

### Why should you care?

Static is the best, but sometimes you need to fetch data from a remote source which makes things not so static. Roots mini records is a little webpack plugin intended for use with [roots-mini](https://github.com/carrot/roots-mini) which allows you to make locals pulled from a JSON file or url returning JSON available as static locals in your jade templates.

### Installation

Install into your project with `npm i roots-mini-records -S`.

Then load it up as a plugin in `app.js` like this:

```js
import records from 'roots-mini-records'

export default {
  plugins: [records({ test: { file: 'data.json' } })]
}
```

### Usage

The records plugin accepts an object, and each key in the object should contain another object as it's value, with either a `file`, `url`, or `data` property. For example:

```js
records({
  one: { file: 'data.json' },
  two: { url: 'http://api.carrotcreative.com/staff' },
  three: { data: { foo: 'bar' } }
})
```

Whatever data source you provide, it will be resolved and added to your jade templates as `locals[key]`. So for example, if you were trying to access `three` in your templates, you could access it with `locals.three.foo`, and it would return `'bar'`.

Now let's get into some more details for each of the data types.

#### File

`file` accepts a file path, either absolute or relative to your roots project's root. So for the example above, it would resolve to `/path/to/project/data.json`.

### Url

`url` accepts either a string or an object. If provided with a string, it will make a request to the provided url and parse the result as JSON, then return it as a local. If you need to modify this behavior, you can pass in an object instead. The object is passed through directly to [rest.js](https://github.com/cujojs/rest), their docs for acceptable values for this object [can be found here](https://github.com/cujojs/rest/blob/master/docs/interfaces.md#common-request-properties). These options allow modification of the method, headers, params, request entity, etc. and should cover any additional needs.

### Data

The most straightforward of the options, this will just pass the data right through to the locals. Also if you provide a A+ compliant promise for a value, it will be resolved and passed in to the template.

### License & Contributing

- Details on the license [can be found here](LICENSE.md)
- Details on running tests and contributing [can be found here](contributing.md)
