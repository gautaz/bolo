module.exports = (events = { emit: () => undefined }) => {
  const dict = {}

  return {
    set: (key, datum) => {
      dict[key] = datum
      events.emit('set', key, datum)
    },
    remove: (key) => {
      if (dict.hasOwnProperty(key)) {
        delete dict[key]
        events.emit('remove', key)
      }
    },
    map: (fn) => Object.keys(dict).map(fn),
    mapData: (fn) => Object.keys(dict).map((k) => fn(dict[k])),
    get: (key) => dict[key]
  }
}
