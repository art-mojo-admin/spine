import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const markdownText = "Support Agent Guide\n\n## Handling Tickets\n1. New tickets appear"

const html = generateHTML(markdownText, [
  StarterKit,
  Markdown
])
console.log(html)
