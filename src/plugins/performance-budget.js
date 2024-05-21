const { readFileSync } = require('fs')
const { join, parse } = require('path')
const { getAllFiles } = require('./lib/filesystem')
const { printTable } = require('./lib/console')
const { readRoute } = require('./lib/network')
const { buildRoute } = require('./lib/build')

let JS_PAYLOAD_SIZE = null

var oldSizes = {}

function getAllRoutes (files, base) {
  return files.map(file => {
    let routeStr = parse(file.replace(base, ''))
    let root = routeStr.dir !== routeStr.root ? routeStr.dir : ''
    let name = routeStr.name !== 'index' ? routeStr.name : ''
    return `${root}/${name}`
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
    const size = await calculateScriptTagSizes(scriptTags, base, route)
    return {
      route,
      size,
      delta: calculateDelta(route, size),
    }
  }))
  return payload
}

async function calculateScriptTagSizes (scriptTags, base, route) {
  let scriptSrcArray = []
  if (scriptTags) {
    // loop through all the routes script tags
    for (let tag of scriptTags) {
      let src = tag.match(/src=(["'])(.*?)\1/)
      // <script src=""/>
      if (src) {
        let scriptPath = src[2]
        // <script src="/_public"/>
        if (scriptPath.startsWith('/_public')) {
          let localScript = (readFileSync(scriptPath.replace('/_public', `${base}/public`))).toString()
          scriptSrcArray.push(localScript)
        }
        // <script src="http(s)://"/>
        else if (scriptPath.startsWith('https:') || scriptPath.startsWith('http:')) {
          let data = await readRoute(scriptPath)
          scriptSrcArray.push(data.toString())
        }
      }
      // <script><script>
      else {
        let matches = tag.match(/<script[^>]*>(.*?)<\/script>/s)
        let type = tag.match(/type=(["'])(.*?)\1/)
        if (!type || (type[2] && type[2].toLowerCase() !== 'application/json')) {
          let code = matches[1].replace(/\/_public\//g, `${base}/public/`).trim()
          scriptSrcArray.push(code)
        }
      }
    }
  }

  let builtSrc = buildRoute(route, base, scriptSrcArray.join('\n'))
  return (readFileSync(builtSrc)).toString().length
}

function saveSizes (sizes) {
  for (let r of sizes) {
    oldSizes[r.route] = r.size
  }
}

async function reportOnJavaScriptPayloadSize (inventory) {
  console.log('\n\nPerformance Budget')
  let base = inventory.inv._project.cwd
  let pages = join(base, 'app', 'pages')
  let files = getAllFiles(pages)
  let routes = getAllRoutes(files, pages)
  let sizes = await calculateJavaScriptPayloadSize(routes, base)
  saveSizes(sizes)
  console.table(printTable(sizes, JS_PAYLOAD_SIZE))
}

module.exports = {
  sandbox: {
    async start ({ inventory }) {
      await reportOnJavaScriptPayloadSize(inventory)
    },
    async watcher ({ filename, inventory }) {
      let base = join(inventory.inv._project.cwd, '.enhance', 'budget')
      if (!filename.startsWith(base)) {
        await reportOnJavaScriptPayloadSize(inventory)
      }
    },
  },
  set: {
    env ({ arc }) {
      let budget = arc['performance-budget']
      if (budget) {
        let payloadRow = budget.find(row => row[0] === 'payload-size')
        JS_PAYLOAD_SIZE = payloadRow && payloadRow[1]
        return {
          JS_PAYLOAD_SIZE,
        }
      }
    },
  },
}
