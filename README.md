# Bolo

[![Build Status](https://travis-ci.org/gautaz/bolo.svg?branch=master)](https://travis-ci.org/gautaz/bolo)
[![Coverage Status](https://coveralls.io/repos/github/gautaz/bolo/badge.svg?branch=master)](https://coveralls.io/github/gautaz/bolo?branch=master)

![bolo logo](bolo.jpg)

Bolo is intended to provide a distributed key-value store for Node.js without relying on any external resources (a.k.a. [etcd](https://coreos.com/etcd/), [consul](https://www.consul.io/) and co).

Bolo should work with [Node.js](https://nodejs.org) 5, 4 and 0.12 (and probably earlier revisions).

As bolognese sauce, it tends to drip so do not use it for critical applications.

Bolo relies on UDP datagrams to ensure the communication between its nodes. Node's announcement is operated through UDP broadcasting (it's dripping, you can use VLANs to put the sauce in a bottle).

Bolo does not secure its communication (it's dripping again). If this is a concern, securing the network layer is strongly advised (VPN or whatever).

## Key concepts

Each bolo node manages its own copy of the key/value store.

On start a node will announce itself by broadcasting (the default announcement port is 60105 - for bolos) and other bolo nodes will add it to their list of peers and reply by sending it their own key/value bindings.

Each node distinguishes its own key/value bindings from other nodes' bindings. A node is responsible for its bindings.

Bolo is not designed to handle conflicting key/value bindings but if a conflict occurs between two nodes, bolo will behave this way:

1. a bolo node will always trust is own bindings before referring to others
2. the last declared binding always wins if no local binding is found

## First steps

Get the *bolo* module by issuing:

```bash
npm install bolo
```

The following code samples rely on [ES6](http://www.ecma-international.org/ecma-262/6.0/index.html).

Bolo API relies on promises, in order to get a bolo node, simply issue:

```javascript
const bolo = require('bolo')

bolo().then((node) => {
  // do something with node
}).catch((error) {
  // the node creation failed, handle the Error instance
})
```

To declare a new binding:

```javascript
node.set('key', 'value' || { thing: 'whatever as long as it remains the same after a JSON.parse(JSON.stringify(thing))')
  .then((node) => {
    // ...
  })
  .catch((error) => {
    // failed to set the binding, handle the Error instance
  })
```

To get a binding:

```javascript
node.get('key').then((value) => {
  // do something with the value
}).catch((error) => {
  // failed to get the binding, handle the Error instance
})
```

For a full communication scenario, see [this example](example/monoprocess.js).

## API

### Getting a node instance

Calling:

```javascript
bolo(options)
```

will return a [Promise][2] that resolves to a node instance or rejects with an [Error][1].

You can pass the following options:

```javascript
{
  log: noLog,
  announce: {
    address: '0.0.0.0',
    port: 60105
  },
  bind: {
    address: '0.0.0.0'
    port: 0
  }
}
```

By default no logging is operated but you can provide an alternate logger providing the `debug`, `info`, `warn` and `error` methods, these methods should accept a string as their first argument.

By default the node will announce itself on all available interfaces on the port 60105 and also talk to other nodes on all interfaces on a random port.

### Setting a key/value binding

A `key` can only be expressed as a string but the only requisite for a value is that `JSON.parse(JSON.stringify(value))` deep equals `value`.

You can set a binding with:

```javascript
node.set(key, value)
```

This will return a [Promise][2] which will resolve to the node on success (to possibly chain calls) or reject with an [Error][1].

### Removing a binding for a key

Removing a binding is as simple as:

```javascript
node.remove(key)
```

Again a node-resolving [Promise][2] is returned.

### Getting a value from a key

You can get a value by calling:

```javascript
node.get(key, options)
```

This method will return a [Promise][2] resolving to the value bound to the `key` (or possibly reject).

The options are:

```javascript
{
  timeout: 1000, // will wait 1000ms and then reject
  askInterval: 100 // will ask all peers for the key each 100ms
}
```

By default, none of these options are set which means that:

- the `get` will block indefinitely if the binding for the asked `key` is not already set and not set by anyone later
- the node will not ask its peers for the binding on a regular basis to alleviate any UDP datagrams loss (like a lost `set` message)

> The askInterval option is only needed if you cannot rely on the network and some UDP packets are lost from time to time.

### Closing the node

If the node **and its own bindings** are not needed anymore, the node can be closed:

```javascript
node.close()
```

The call will return a [Promise][2] resolving with the node.

Beware that the node will ask all its peers to remove its own bindings.

The node will reject all later set/remove calls.
The node cannot be *re-activated* or whatever else, you will have to create a new node.

### Events

The node provides the following methods from an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter):

- `on`
- `once`
- `removeAllListeners`
- `removeListener`
- `setMaxListeners`

Two events can be listened on:

- `'error'` with the error as the first argument of the listener
- `'close'` when the node has been successfully closed

Getting an error generally means that something bad is happening on the network side and it is often preferable to close and re-create the whole node.

## Naming

Bolo was initially named after the excellent [polo][3] package from Mathias Buus.

As I wanted to use this kind of service discovery in a [Docker](https://www.docker.com/) environment, I stumbled on [this Docker multicast issue]( https://github.com/docker/docker/issues/3043).
I had another [issue](https://github.com/mafintosh/polo/issues/28) while trying to test case an application using [polo][3] with [mocha](https://github.com/mochajs/mocha).
Lastly I also wanted the service to handle any kind of data, not just getting services information by name.

So I needed a [polo][3] like thing operating discovery by broadcasting hence the name *bolo*.

I know *bolo* has several other [quite interesting meanings](https://en.wikipedia.org/wiki/Bolo), so why this bolognese picture?
This is because *bolo* is as ugly as a plate of spaghetti bolognese (but is it so ugly after all?) and is also the french abbreviation for bolognese (my apologies for being french).

[1]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error
[2]: https://promisesaplus.com/
[3]: https://github.com/mafintosh/polo
