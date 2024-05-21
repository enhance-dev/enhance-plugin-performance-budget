const Table = require('cli-table3')
const c = require('@colors/colors/safe')
const { filesize } = require('filesize')

const tableStyle = {
  chars: {
    bottom: '',
    'bottom-left': '',
    'bottom-mid': '',
    'bottom-right': '',
    left: '',
    'left-mid': '',
    mid: '',
    middle: '',
    'mid-mid': '',
    right: '',
    'right-mid': '',
    top: '',
    'top-left': '',
    'top-mid': '',
    'top-right': '',
  },
  style: { head: [ 'bold', 'white' ] },
}


function printTable (routes, threshold) {
  const table = new Table({
    head: [ 'Route', 'JS Size', 'Delta' ],
    ...tableStyle,
  })
  for (const r of routes) {
    let fileSize = filesize(r.size, { base: 2, standard: 'jedec' })
    let delta = filesize(r.delta, { base: 2, standard: 'jedec' })
    table.push([
      c.bold(r.route),
      r.size >= threshold ? c.red(fileSize) : r.size >= (threshold * .8) ? c.yellow(fileSize) : c.cyan(fileSize),
      r.delta < 0 ? c.red(delta) : r.delta > 0 ? c.green(`+${delta}`) : c.cyan(delta),
    ])
  }

  return `\n${table.toString()}`
}

module.exports = {
  printTable,
}
