'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

const EventEmitter = require('events');
const tools = require('./tools');

const c2s = tools.cnx2str;
const ensureBindingOptions = function () {
  let options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  options.port = options.port || 60105;
  return options;
};

module.exports = function () {
  let options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  return require('./datagram')({
    socket: { type: 'udp4', reuseAddr: true },
    bind: ensureBindingOptions(options.bind),
    broadcast: true
  }).then(announcer => {
    const log = options.log || tools.noLog;
    const events = new EventEmitter();
    const ownAnnouncements = {};

    announcer.on('error', events.emit.bind(events, 'error'));
    announcer.on('message', (msg, rinfo) => {
      log.debug(`[announcer] ${ msg.toString() } announced by ${ c2s(rinfo) }`);
      try {
        const message = JSON.parse(msg);
        if (message.bolo !== 'announce') {
          log.warn(`discarding ${ msg.toString() } from ${ c2s(rinfo) } (not an announcement)`);
          return;
        }
        if (!(message.announce && message.announce.address && message.announce.port)) {
          log.warn(`discarding ${ msg.toString() } from ${ c2s(rinfo) } (incomplete announcement)`);
          return;
        }
        if (message.announce.address !== rinfo.address) {
          log.warn(`discarding ${ msg.toString() } from ${ c2s(rinfo) } (invalid announcement)`);
          return;
        }
        if (Object.keys(ownAnnouncements).filter(address => message.announce.address === address && ownAnnouncements[address].indexOf(message.announce.port) > -1).length) {
          log.debug(`[announcer] discarding ${ msg.toString() } from ${ c2s(rinfo) } (own announcement)`);
          return;
        }
        log.debug(`[announcer] new peer: ${ msg.toString() }`);
        events.emit('peer', message.announce);
      } catch (error) {
        log.warn(`malformed announcement (${ msg.toString() }) from ${ c2s(rinfo) } (${ error })`);
      }
    });
    announcer.on('close', () => {
      announcer.removeAllListeners('message');
      events.emit('close');
    });

    return tools.mixEventEmitter(events, {
      announce: function () {
        let bolo = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
        return (bolo.port ? Promise.resolve() : Promise.reject(new Error('cannot announce a bolo instance without at least its port number'))).then(() => Promise.all((bolo.address ? [bolo] : tools.externalAddresses()).map(a => [a.address, tools.broadcastAddress(a.address, a.netmask)]).filter(options.broadcastFilter || (() => true)).map(_ref => {
          var _ref2 = _slicedToArray(_ref, 2);

          let a = _ref2[0];
          let b = _ref2[1];

          ownAnnouncements[a] = ownAnnouncements[a] ? ownAnnouncements[a].push(bolo.port) : [bolo.port];
          return [a, b];
        }).map(_ref3 => {
          var _ref4 = _slicedToArray(_ref3, 2);

          let a = _ref4[0];
          let b = _ref4[1];

          log.info(`announcing ${ a }:${ bolo.port } on ${ b }:${ announcer.address().port }`);
          return [a, b];
        }).map(_ref5 => {
          var _ref6 = _slicedToArray(_ref5, 2);

          let a = _ref6[0];
          let b = _ref6[1];
          return announcer.send(JSON.stringify({
            bolo: 'announce',
            announce: {
              address: a,
              port: bolo.port
            }
          }), announcer.address().port, b);
        })));
      },
      close: announcer.close
    });
  });
};