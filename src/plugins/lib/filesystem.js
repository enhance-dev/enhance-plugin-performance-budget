const { readdirSync, statSync } = require('fs')
const { join } = require('path')

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

module.exports = {
  getAllFiles,
}
