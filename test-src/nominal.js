/* global describe, it */

/* FOR NOW:
 * - it would be better to use directy ../src/index but babel-istanbul fails on it
 * - babel-istanbul fails to clearly analyze es6 code coverage
 */
const bolo = require('../index')
const Promise = require('pinkie-promise')
const chai = require('chai')
const expect = chai.expect

const log = (prefix) => ({
  debug: (...args) => console.log('debug', prefix, ...args),
  info: (...args) => console.log('info', prefix, ...args),
  warn: (...args) => console.log('warn', prefix, ...args),
  error: (...args) => console.log('error', prefix, ...args)
})
log('used')

chai.use(require('chai-as-promised'))

describe('nominal', () => {
  it('gets a store and closes it', () => bolo().then(bolo.close))

  it(
    'gets two stores, ensures they share data and closes them',
    () => Promise.all([bolo(), bolo()])
      .then(([storeA, storeB]) => Promise.all([storeA.set('keyA', 'valueA'), storeB.set('keyB', 'valueB')]))
      .then(([storeA, storeB]) => Promise.all([
        storeA,
        storeB,
        expect(storeA.get('keyB')).to.eventually.equal('valueB'),
        expect(storeB.get('keyA')).to.eventually.equal('valueA')
      ])).then(([storeA, storeB]) => Promise.all([storeA.close(), storeB.close()]))
  )
})
