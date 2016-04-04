/* global describe, it */

/* FOR NOW:
 * - it would be better to use directy ../src/index but babel-istanbul fails on it
 * - babel-istanbul fails to clearly analyze es6 code coverage
 */
const bolo = require('../index')
const Promise = require('pinkie-promise')
const chai = require('chai')
const expect = chai.expect

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

chai.use(require('chai-as-promised'))

describe('nominal', () => {
  it('gets a store and closes it', () => bolo().then(bolo.close))

  it(
    'accesses its own data then removes the data',
    () => bolo()
      .then((store) => store.set('key', 'value'))
      .then((store) => Promise.all([
        store,
        expect(store.get('key')).to.eventually.equal('value')
      ])).then(([store]) => store.remove('key'))
      .then((store) => store.close)
  )

  it(
    'gets two stores, ensures they share data then closes them',
    () => Promise.all([bolo(), bolo()])
      .then(([storeA, storeB]) => Promise.all([storeA.set('keyA', 'valueA'), storeB.set('keyB', 'valueB')]))
      .then(([storeA, storeB]) => Promise.all([
        storeA,
        storeB,
        expect(storeA.get('keyB')).to.eventually.equal('valueB'),
        expect(storeB.get('keyA')).to.eventually.equal('valueA')
      ])).then(([storeA, storeB]) => Promise.all([storeA.remove('keyA'), storeB.remove('keyB'), wait(50)]))
      .then(([storeA, storeB]) => Promise.all([
        storeA,
        storeB,
        expect(storeA.get('keyB', { timeout: 50 })).to.be.rejected,
        expect(storeB.get('keyA', { timeout: 50 })).to.be.rejected
      ])).then(([storeA, storeB]) => Promise.all([storeA.close(), storeB.close()]))
  )
})
