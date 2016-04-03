'use strict'

var nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10)
module.exports = nodeMajor < 4 ? require('./dist/es5') : nodeMajor < 5 ? require('./dist/node4') : require('./dist/node5')
