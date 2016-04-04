# Bolo

![bolo logo](bolo.jpg)

Bolo is intended to provide a distributed key-value store for Node.js without relying on any external resources (a.k.a. [etcd](https://coreos.com/etcd/), [consul](https://www.consul.io/) and co).

Bolo should work on [Node.js](https://nodejs.org) 5, 4 and 0.12 (and probably earlier revisions).

As bolognese sauce, it tends to drip so do not use it for critical applications.

Bolo relies on UDP datagrams to ensure the communication between its nodes. Node's announcement is operated through UDP broadcasting (it's dripping, you can use VLANs to put the sauce in a bottle).

Bolo does not secure its communication (it's dripping again). If this is a concern, securing the network layer is strongly advised (VPN or whatever).

## Key concepts

Each bolo node manages its own copy of the key/value store.

On start a node will announce itself by broadcasting (the default announcement port is 60105 - for bolos) and other bolo nodes will add it to their list of peers and reply by sending it their own key/value bindings.

Each node distinguishes its own key/value bindings from other nodes' bindings. A node is responsible for its bindings.

Bolo is not designed to handle conflicting key/value bindings but if a conflict occurs between two nodes, bolo will behave this way:

- a bolo node will always trust is own bindings before referring to others
- the last declared binding always wins

## First steps

The following code samples rely on ES2015.

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

TODO
