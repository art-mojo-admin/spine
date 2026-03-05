import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <body>
      <script type="module">
        import { Editor } from 'https://esm.sh/@tiptap/core@3.0.0';
        import StarterKit from 'https://esm.sh/@tiptap/starter-kit@3.0.0';
        import { Markdown } from 'https://esm.sh/tiptap-markdown@0.9.0';

        const editor = new Editor({
          element: document.createElement('div'),
          extensions: [StarterKit, Markdown],
          content: 'Support Agent Guide\\n\\n## Handling Tickets\\n1. New tickets appear',
        });
        
        window.output = editor.getHTML();
      </script>
    </body>
    </html>
  `);
  
  await page.waitForFunction('window.output !== undefined');
  const html = await page.evaluate(() => window.output);
  console.log(html);
  await browser.close();
})();
