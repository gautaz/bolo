'use strict';

module.exports = function () {
  var events = arguments.length <= 0 || arguments[0] === undefined ? { emit: function emit() {
      return undefined;
    } } : arguments[0];

  var dict = {};

  return {
    set: function set(key, datum) {
      dict[key] = datum;
      events.emit('set', key, datum);
    },
    remove: function remove(key) {
      if (dict.hasOwnProperty(key)) {
        delete dict[key];
        events.emit('remove', key);
      }
    },
    map: function map(fn) {
      return Object.keys(dict).map(fn);
    },
    mapData: function mapData(fn) {
      return Object.keys(dict).map(function (k) {
        return fn(dict[k]);
      });
    },
    get: function get(key) {
      return dict[key];
    }
  };
};