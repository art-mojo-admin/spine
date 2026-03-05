import fs from 'fs'
const pkg = JSON.parse(fs.readFileSync('./node_modules/tiptap-markdown/package.json'))
console.log('Version:', pkg.version)
const readme = fs.readFileSync('./node_modules/tiptap-markdown/README.md', 'utf8')
console.log(readme.substring(0, 1000))
