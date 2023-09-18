const { readdirSync, statSync, readFileSync } = require('fs')
const { join, parse } = require('path')
const Table = require('cli-table3')
const c = require('@colors/colors/safe')
const http = require('http')
const https = require('https')
const { filesize } = require('filesize')
let JS_PAYLOAD_SIZE = null

var oldSizes = {}
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

function getAllFiles (dirPath, arrayOfFiles) {
  let files = readdirSync(dirPath)

  arrayOfFiles = arrayOfFiles || []

  files.forEach(function (file) {
    if (statSync(join(dirPath, file)).isDirectory()) {
      arrayOfFiles = getAllFiles(join(dirPath, file), arrayOfFiles)
    }
    else {
      arrayOfFiles.push(join(dirPath, file))
    }
  })

  return arrayOfFiles
}

function printTable (routes) {
  const table = new Table({
    head: [ 'Route', 'JS Size', 'Delta' ],
    ...tableStyle,
  })
  for (const r of routes) {
    let fileSize = filesize(r.size, { base: 2, standard: 'jedec' })
    let delta = filesize(r.delta, { base: 2, standard: 'jedec' })
    table.push([
      c.bold(r.route),
      r.size >= JS_PAYLOAD_SIZE ? c.red(fileSize) : r.size >= (JS_PAYLOAD_SIZE * .8) ? c.yellow(fileSize) : c.cyan(fileSize),
      r.delta < 0 ? c.red(delta) : r.delta > 0 ? c.green(delta) : c.cyan(delta),
    ])
  }

  return `\n${table.toString()}`
}

function getAllRoutes (files, base) {
  return files.map(file => {
    let routeStr = parse(file.replace(base, ''))
    let root = routeStr.dir !== routeStr.root ? routeStr.dir : ''
    let name = routeStr.name !== 'index' ? routeStr.name : ''
    return `${root}/${name}`
  })
}

async function readRoute (route) {
  const url = new URL(route)
  const client = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = client.request(url, (res) => {
      let responseBody = ''
      res.on('data', (chunk) => {
        responseBody += chunk
      })
      res.on('end', () => {
        resolve(responseBody)
      })
    })
    req.on('error', (err) => {
      reject(err)
    })
    req.end()
  })
}

function calculateDelta (route, size) {
  if (oldSizes && oldSizes[route]) {
    return size - oldSizes[route]
  }
  else {
    return 0
  }
}

async function calculateJavaScriptPayloadSize (routes, base) {
  let payload = Promise.all(routes.map(async route => {
    const data = await readRoute(`http://localhost:3333${route}`)
    const scriptTags = data.match(/<script[\s\S]*?>[\s\S]*?<\/script>/gi)
    const size = await calculateScriptTagSizes(scriptTags, base)
    return {
      route,
      size,
      delta: calculateDelta(route, size)
    }
  }))
  return payload
}

async function calculateScriptTagSizes (scriptTags, base) {
  let size = 0
  for (let tag of scriptTags) {
    let src = tag.match(/src=(["'])(.*?)\1/)
    if (src) {
      let scriptPath = src[2]
      if (scriptPath.startsWith('/_public')) {
        size += (readFileSync(scriptPath.replace('/_public', `${base}/public`))).toString().length
      }
      else if (scriptPath.startsWith('https:') || scriptPath.startsWith('http:')) {
        let data = await readRoute(scriptPath)
        size += data.toString().length
      }
    }
    else {
      let matches = tag.match(/<script[^>]*>(.*?)<\/script>/s)
      size += matches[1] ? matches[1].trim().length : tag.length
    }
  }

  return size
}

function saveSizes (sizes) {
  for (let r of sizes) {
    oldSizes[r.route] = r.size
  }
}

async function reportOnJavaScriptPayloadSize (inventory) {
  console.log('\n\nPerformance Budget')
  let base = inventory.inv._project.cwd
  let pages = join(inventory.inv._project.cwd, 'app', 'pages')
  let files = getAllFiles(pages)
  let routes = getAllRoutes(files, pages)
  let sizes = await calculateJavaScriptPayloadSize(routes, base)
  saveSizes(sizes)
  console.table(printTable(sizes))
}

module.exports = {
  sandbox: {
    async start ({ inventory }) {
      await reportOnJavaScriptPayloadSize(inventory)
    },
    async watcher ({ inventory }) {
      await reportOnJavaScriptPayloadSize(inventory)
    },
  },
  set: {
    env ({ arc }) {
      let budget = arc['performance-budget']
      if (budget) {
        let payloadRow = budget.find(row => row[0] === 'payload-size')
        JS_PAYLOAD_SIZE = payloadRow && payloadRow[1]
        return {
          JS_PAYLOAD_SIZE
        }
      }
    }
  }
}
