const EventEmitter = require('events')
const tools = require('./tools')

const c2s = tools.cnx2str
const ensureBindingOptions = (options = {}) => {
  options.port = options.port || 60105
  return options
}

module.exports = (options = {}) => require('./datagram')({
  log: options.log || tools.noLog,
  socket: { type: 'udp4', reuseAddr: true },
  bind: ensureBindingOptions(options.bind),
  broadcast: true
}).then((announcer) => {
  const log = options.log || tools.noLog
  const events = new EventEmitter()
  const ownAnnouncements = {}

  announcer.on('error', events.emit.bind(events, 'error'))
  announcer.on('message', (msg, rinfo) => {
    log.debug(`[announcer] ${msg.toString()} announced by ${c2s(rinfo)}`)
    try {
      const message = JSON.parse(msg)
      if (message.bolo !== 'announce') {
        log.warn(`discarding ${msg.toString()} from ${c2s(rinfo)} (not an announcement)`)
        return
      }
      if (!(message.announce && message.announce.address && message.announce.port)) {
        log.warn(`discarding ${msg.toString()} from ${c2s(rinfo)} (incomplete announcement)`)
        return
      }
      if (message.announce.address !== rinfo.address) {
        log.warn(`discarding ${msg.toString()} from ${c2s(rinfo)} (invalid announcement)`)
        return
      }
      if (Object.keys(ownAnnouncements).filter(
          (address) => message.announce.address === address && ownAnnouncements[address].indexOf(message.announce.port) > -1
        ).length) {
        log.debug(`[announcer] discarding ${msg.toString()} from ${c2s(rinfo)} (own announcement)`)
        return
      }
      log.debug(`[announcer] new peer: ${msg.toString()}`)
      events.emit('peer', message.announce)
    } catch (error) {
      log.warn(`malformed announcement (${msg.toString()}) from ${c2s(rinfo)} (${error})`)
    }
  })
  announcer.on('close', () => {
    announcer.removeAllListeners('message')
    events.emit('close')
  })

  return tools.mixEventEmitter(events, {
    announce: (bolo = {}) => (bolo.port ? Promise.resolve() : Promise.reject(
      new Error('cannot announce a bolo instance without at least its port number')
    )).then(() => Promise.all(
      (bolo.address ? [ bolo ] : tools.externalAddresses()).map(
        (a) => [a.address, tools.broadcastAddress(a.address, a.netmask)]
      ).filter(options.broadcastFilter || (() => true)).map(([a, b]) => {
        ownAnnouncements[a] = ownAnnouncements[a] ? ownAnnouncements[a].push(bolo.port) : [bolo.port]
        return [a, b]
      }).map(([a, b]) => {
        log.info(`announcing ${a}:${bolo.port} on ${b}:${announcer.address().port}`)
        return [a, b]
      }).map(([a, b]) => announcer.send(JSON.stringify({
        bolo: 'announce',
        announce: {
          address: a,
          port: bolo.port
        }
      }), announcer.address().port, b))
    )),
    close: announcer.close
  })
})
