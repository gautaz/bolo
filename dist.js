var nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10)

module.exports = nodeMajor < 4 ? 'es5' : nodeMajor < 5 ? 'node4' : 'node5'

if (!module.parent) {
  console.log(module.exports)
}
