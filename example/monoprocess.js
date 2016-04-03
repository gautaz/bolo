'use strict'

var Promise = require('pinkie-promise')
var inspect = require('util').inspect
var bolo = require('../index')

var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

var logger = function (prefix) {
  return {
    debug: console.log.bind(console, 'debug', prefix),
    info: console.log.bind(console, 'info', prefix),
    warn: console.log.bind(console, 'warn', prefix),
    error: console.log.bind(console, 'error', prefix)
  }
}

var storeA, storeB

bolo({ log: logger('A') }).then((bolo) => {
  storeA = bolo
  storeA.on('set', (key, datum) => console.log(`A just received ${inspect(datum)} for ${key}`))
  storeA.on('remove', (key) => console.log(`${key} was removed from A`))
  storeA.on('close', () => process.exit(0))
  return wait(500)
}).then(() => bolo({ log: logger('B') })).then((bolo) => {
  storeB = bolo
  storeB.on('set', (key, datum) => console.log(`B just received ${inspect(datum)} for ${key}`))
  storeB.on('remove', (key) => console.log(`${key} was removed from B`))
  storeB.on('close', () => storeA.close())
  return wait(500)
}).then(() => {
  storeA.set('test', { test: true })
  return wait(500)
}).then(() => {
  storeA.close()
  return wait(500)
}).then(() => {
  storeB.close()
}).catch((error) => {
  console.log(error.stack ? error.stack : error)
  process.exit(1)
})
