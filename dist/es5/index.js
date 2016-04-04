'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var Promise = require('pinkie-promise');
var EventEmitter = require('events');
var inspect = require('util').inspect;
var store = require('./store');
var tools = require('./tools');
var announcer = require('./announcer');

var c2s = tools.cnx2str;

module.exports = function () {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  return Promise.all([announcer({ log: options.log || tools.noLog, bind: options.announce }), require('./datagram')({ socket: { type: 'udp4' }, bind: options.bind || {} })]).then(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2);

    var announcer = _ref2[0];
    var bolo = _ref2[1];
    return new Promise(function (resolve, reject) {
      options.bind = options.bind || {};

      var closed = false;

      var log = options.log || tools.noLog;
      var peerEvents = new EventEmitter();
      var events = new EventEmitter();

      var peers = store(peerEvents);
      var myData = store(events);
      var theirData = store(events);

      var peerUrl = function peerUrl(peer) {
        return 'udp://' + peer.address + ':' + peer.port;
      };

      var facade = {
        close: function close() {
          closed = true;
          return Promise.all(peers.mapData(function (peer) {
            return bolo.send(JSON.stringify({
              bolo: 'quit',
              quit: (options.bind.address ? [options.bind.address] : tools.externalAddresses().map(function (a) {
                return a.address;
              })).map(function (address) {
                return peerUrl({ address: address, port: bolo.address().port });
              }),
              remove: myData.map(function (key) {
                return key;
              })
            }), peer.port, peer.address).catch(function (error) {
              return log.warn('failed to quit from ' + inspect(peer) + ' (' + error + ')');
            });
          })).then(function () {
            return Promise.all([announcer.close().catch(function (err) {
              return log.warn('failed to close announcer (' + err + ')');
            }), bolo.close().catch(function (err) {
              return log.warn('failed to close (' + err + ')');
            })]);
          }).then(function () {
            return events.emit('close');
          }).then(function () {
            return facade;
          });
        },

        set: function set(key, datum) {
          if (closed) {
            Promise.reject(new Error('closed'));
          }
          myData.set(key, datum);
          return Promise.all(peers.mapData(function (peer) {
            return bolo.send(JSON.stringify({
              bolo: 'set',
              set: [{ key: key, datum: datum }]
            }), peer.port, peer.address).catch(function (err) {
              return log.warn('failed to set ' + key + ' on ' + inspect(peer) + ' (' + err + ')');
            });
          })).then(function () {
            return facade;
          });
        },

        remove: function remove(key) {
          var cb = arguments.length <= 1 || arguments[1] === undefined ? function () {
            return undefined;
          } : arguments[1];

          if (closed) {
            Promise.reject(new Error('closed'));
          }
          myData.remove(key);
          return Promise.all(peers.mapData(function (peer) {
            return bolo.send(JSON.stringify({
              bolo: 'remove',
              remove: [key]
            }), peer.port, peer.address).catch(function (err) {
              return log.warn('failed to remove ' + key + ' from ' + inspect(peer) + ' (' + err + ')');
            });
          })).then(function () {
            return facade;
          });
        },

        get: function get(key) {
          var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
          return new Promise(function (resolve, reject) {
            var timeout = null;
            var askInterval = null;
            var stored = myData.get(key) || theirData.get(key);
            var resolver = function resolver(k, d) {
              if (k === key) {
                clearTimeout(timeout);
                clearInterval(askInterval);
                resolve(d);
              }
            };

            if (typeof stored !== 'undefined') {
              return resolve(stored);
            }

            if (options.timeout) {
              timeout = setTimeout(function () {
                facade.removeListener('set', resolver);
                reject(new Error(key + ' was not found'));
              }, options.timeout);
            }

            if (options.askInterval) {
              askInterval = setInterval(function () {
                peers.mapData(function (peer) {
                  return bolo.send(JSON.stringify({
                    bolo: 'ask',
                    ask: [key]
                  }), peer.port, peer.address).catch(function (error) {
                    return log.warn('failed to ask for ' + key + ' (' + error + ')');
                  });
                });
              }, options.askInterval);
            }

            facade.on('set', resolver);
          });
        }
      };

      var checkPeer = function checkPeer(peer) {
        var url = peerUrl(peer);
        if (!peers.get(url)) {
          peers.set(url, peer);
        }
      };

      var messageHandler = {
        quit: function quit(message, rinfo) {
          message.quit.forEach(peers.remove);
          message.remove.forEach(theirData.remove);
        },

        set: function set(message, rinfo) {
          checkPeer(rinfo);
          message.set.map(function (_ref3) {
            var key = _ref3.key;
            var datum = _ref3.datum;
            return theirData.set(key, datum);
          });
        },

        remove: function remove(message, rinfo) {
          checkPeer(rinfo);
          message.set.map(function (key) {
            return theirData.remove(key);
          });
        },

        ask: function ask(message, rinfo) {
          var foundData = message.ask.map(function (key) {
            return { key: key, datum: myData.get(key) };
          }).filter(function (_ref4) {
            var key = _ref4.key;
            var datum = _ref4.datum;
            return typeof datum !== 'undefined';
          });

          checkPeer(rinfo);
          if (foundData.length) {
            bolo.send(JSON.stringify({
              bolo: 'set',
              set: foundData
            }, rinfo.port, rinfo.address)).catch(function (error) {
              return log.warn('failed to reply on demand for ' + message.ask + ' (' + error + ')');
            });
          }
        }
      };

      log.info('listening on ' + bolo.address().address + ':' + bolo.address().port);

      tools.mixEventEmitter(events, facade);

      peerEvents.on('set', function (peerUrl, peer) {
        log.info('new peer ' + peerUrl + ' ' + inspect(peer));
        bolo.send(JSON.stringify({
          bolo: 'set',
          set: myData.map(function (key) {
            return { key: key, datum: myData.get(key) };
          })
        }), peer.port, peer.address).then(function () {
          return log.debug('[bolo] own data sent to ' + c2s(peer));
        }).catch(function (err) {
          return log.warn('failed to send own data to ' + c2s(peer) + ' (' + err + ')');
        });
      });

      announcer.on('peer', function (peer) {
        peers.set(peerUrl(peer), peer);
      });
      announcer.on('error', events.emit.bind(events, 'error'));
      announcer.on('close', function () {
        log.info('announcer closed');
      });

      bolo.on('error', events.emit.bind(events, 'error'));
      bolo.on('message', function (msg, rinfo) {
        log.debug('[bolo] received ' + msg.toString() + ' from ' + c2s(rinfo));
        try {
          var message = JSON.parse(msg);
          messageHandler[message.bolo](message, rinfo);
        } catch (error) {
          log.warn('malformed message (' + msg.toString() + ') from ' + rinfo.address + ':' + rinfo.port + ' (' + error + ')');
        }
      });
      bolo.on('close', function () {
        log.info('closed');
      });

      announcer.announce({
        address: options.bind.address,
        port: bolo.address().port
      }).then(function () {
        return resolve(facade);
      }, reject);
    });
  });
};
