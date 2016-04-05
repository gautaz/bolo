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

describe('on close', () => {
  it('rejects a pending get', () => bolo().then((store) => Promise.all([
    expect(store.get('unknown')).to.be.rejected,
    wait(50).then(store.close)
  ])))
})
