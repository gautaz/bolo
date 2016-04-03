const os = require('os')
const inspect = require('util').inspect

const dottedToInt = (a) => a.split('.').map((d) => parseInt(d, 10))
const defaultMask = (a) => [ 255, a[0] < 128 ? 0 : 255, a[0] < 192 ? 0 : 255, a[0] < 224 ? 0 : 255 ]

module.exports = {
  spy: (thing) => {
    console.log(inspect(thing))
    return thing
  },

  noLog: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },

  cnx2str: (connection) => `${connection.address}:${connection.port}`,

  mixEventEmitter: (ee, mix) => {
    ['on', 'once', 'removeAllListeners', 'removeListener', 'setMaxListeners'].forEach((method) => {
      mix[method] = (...args) => {
        ee[method](...args)
        return mix
      }
    })
    return mix
  },

  externalAddresses: () => {
    const interfaces = os.networkInterfaces()
    return Object.keys(interfaces).map((k) => interfaces[k].filter((a) => !a.internal && a.family === 'IPv4')).reduce((l, r) => l.concat(r), [])
  },

  broadcastAddress: function (address, mask) {
    const a = dottedToInt(address)
    const m = mask && dottedToInt(mask) || defaultMask(a)
    const b = a.map((v, i) => v | 255 & ~m[i])
    return b.join('.')
  }
}
