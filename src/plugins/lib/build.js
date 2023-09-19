const { mkdirSync, writeFileSync } = require('fs')
const { dirname } = require('path')
const { buildSync } = require('esbuild')

function buildRoute (route, base, source) {
  const cleanRouteName = route.replace('$', '_')
  let combinedSrc = `${base}/.enhance/budget${cleanRouteName !== '/' ? `${cleanRouteName}.mjs` : `/index.mjs`}`
  mkdirSync(dirname(combinedSrc), { recursive: true })
  writeFileSync(combinedSrc, source)
  let builtSrc = `${base}/.enhance/budget${cleanRouteName !== '/' ? `${cleanRouteName}-out.js` : `/index-out.js`}`

  buildSync({
    entryPoints: [ combinedSrc ],
    bundle: true,
    outfile: builtSrc,
  })
  return builtSrc
}

module.exports = {
  buildRoute
}
