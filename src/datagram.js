const dgram = require('dgram')
const Promise = require('pinkie-promise')
const tools = require('./tools')

module.exports = (options = {}) => new Promise((resolve, reject) => {
  const socket = dgram.createSocket(options.socket || {})
  let closed = false

  socket.once('error', (err) => {
    socket.removeAllListeners('error')
    socket.removeAllListeners('listening')
    reject(err)
  })

  socket.once('listening', () => {
    const facade = tools.mixEventEmitter(socket, {
      address: socket.address.bind(socket),
      send: (msg, port, address) => new Promise((resolve, reject) => {
        if (closed) {
          return reject(new Error('socket is closed'))
        }
        socket.send(msg, 0, msg.length, port, address, (err) => {
          if (err) {
            return reject(err)
          }
          resolve(facade)
        })
      }),
      close: () => new Promise((resolve) => {
        // consider the socket as unusable from now on
        closed = true
        socket.once('close', () => resolve(facade))
        socket.close()
      })
    })

    socket.setBroadcast(options.broadcast || false)

    socket.removeAllListeners('error')
    socket.removeAllListeners('listening')

    resolve(facade)
  })

  socket.bind(options.bind || {})
})
