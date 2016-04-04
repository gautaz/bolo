'use strict';

var os = require('os');

var dottedToInt = function dottedToInt(a) {
  return a.split('.').map(function (d) {
    return parseInt(d, 10);
  });
};
var defaultMask = function defaultMask(a) {
  return [255, a[0] < 128 ? 0 : 255, a[0] < 192 ? 0 : 255, a[0] < 224 ? 0 : 255];
};

module.exports = {
  noLog: { debug: function debug() {
      return undefined;
    }, info: function info() {
      return undefined;
    }, warn: function warn() {
      return undefined;
    }, error: function error() {
      return undefined;
    } },

  cnx2str: function cnx2str(connection) {
    return connection.address + ':' + connection.port;
  },

  mixEventEmitter: function mixEventEmitter(ee, mix) {
    ['on', 'once', 'removeAllListeners', 'removeListener', 'setMaxListeners'].forEach(function (method) {
      mix[method] = function () {
        ee[method].apply(ee, arguments);
        return mix;
      };
    });
    return mix;
  },

  externalAddresses: function externalAddresses() {
    var interfaces = os.networkInterfaces();
    return Object.keys(interfaces).map(function (k) {
      return interfaces[k].filter(function (a) {
        return !a.internal && a.family === 'IPv4';
      });
    }).reduce(function (l, r) {
      return l.concat(r);
    }, []);
  },

  broadcastAddress: function broadcastAddress(address, mask) {
    var a = dottedToInt(address);
    var m = mask && dottedToInt(mask) || defaultMask(a);
    var b = a.map(function (v, i) {
      return v | 255 & ~m[i];
    });
    return b.join('.');
  }
};