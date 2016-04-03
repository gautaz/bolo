// keep this file compatible with node 0.x
'use strict'

var Promise = require('pinkie-promise')
var inspect = require('util').inspect
var bolo = require('../index')

var wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms) }) }

var logger = function (prefix) {
  return {
    debug: console.log.bind(console, 'debug', prefix),
    info: console.log.bind(console, 'info', prefix),
    warn: console.log.bind(console, 'warn', prefix),
    error: console.log.bind(console, 'error', prefix)
  }
}

var storeA, storeB

bolo({ log: logger('A') }).then(function (bolo) {
  storeA = bolo
  storeA.on('set', function (key, datum) { console.log('A just received', inspect(datum), 'for', key) })
  storeA.on('remove', function (key) { console.log(key, 'was removed from A') })
  storeA.on('close', function () { process.exit(0) })
  return wait(500)
}).then(function () { return bolo({ log: logger('B') }) }).then(function (bolo) {
  storeB = bolo
  storeB.on('set', function (key, datum) { console.log('B just received', inspect(datum), 'for', key) })
  storeB.on('remove', function (key) { console.log(key, 'was removed from B') })
  storeB.on('close', function () { storeA.close() })
  return wait(500)
}).then(function () {
  storeA.set('test', { test: true })
  return wait(500)
}).then(function () {
  storeA.close()
  return wait(500)
}).then(function () {
  storeB.close()
}).catch(function (error) {
  console.log(error.stack ? error.stack : error)
  process.exit(1)
})
