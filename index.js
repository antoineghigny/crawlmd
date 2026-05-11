#!/usr/bin/env node

const { PlaywrightCrawler } = require('crawlee');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

chromium.use(stealth);
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).use(gfm);

// ── Extraction helpers ──

function extractContent(html, url) {
  const doc = new JSDOM(html, { url }).window.document;
  const reader = new Readability(doc);
  const article = reader.parse();
  return article ? { title: article.title, content: article.content } : null;
}

function fullPageToMarkdown(html, url) {
  const doc = new JSDOM(html, { url }).window.document;
  const title = doc.title || (doc.querySelector('h1')?.textContent?.trim()?.slice(0, 80)) || url;
  // Remove script/style to reduce noise
  for (const s of doc.querySelectorAll('script, style, noscript, iframe, svg')) s.remove();
  const body = doc.body || doc.documentElement;
  const md = turndown.turndown(body.innerHTML);
  return { title, content: md };
}

const EXTRACT_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\+32|0)[\d\s\.\/\-]{7,14}/g,
  address: /\d{1,4}\s+[A-Za-zÀ-ÿ\s]+(?:straat|steenweg|weg|laan|baan|lei|singel|dreef|rue|avenue|boulevard|place|chaussée|chemin|allée|square|impasse|sentier|route|quai|clos|parc|passage)\s*[A-Za-zÀ-ÿ\s\-]+/gi,
  social: /(?:facebook|instagram|linkedin|twitter|youtube|tiktok|pinterest)\.com\/[a-zA-Z0-9._-]+/gi,
};

function extractStructuredData(text) {
  const result = {};
  for (const [key, pattern] of Object.entries(EXTRACT_PATTERNS)) {
    const matches = [...new Set((text.match(pattern) || []).map(m => m.trim()))];
    if (matches.length) result[key] = matches;
  }
  return result;
}

async function downloadImg(src, imgDir) {
  try {
    const name = path.basename(new URL(src).pathname).split('?')[0];
    if (!name || !name.includes('.')) return null;
    const target = path.join(imgDir, name);
    if (fs.existsSync(target)) return name;
    const res = await fetch(src);
    if (!res.ok) return null;
    await pipeline(res.body, createWriteStream(target));
    return name;
  } catch (e) { return null; }
}

// ── Crawler ──

async function runCrawl(targetUrl, options = {}) {
  const maxPages = options.maxPages || 50;
  const bundle = options.bundle ?? true;
  const fullContent = options.full ?? false;
  const extract = options.extract ?? false;
  const outputDir = options.output || null;

  const url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
  const domain = url.hostname;
  const outDir = outputDir || path.join(process.cwd(), 'output', domain.replace(/\./g, '_'));
  const mdDir = path.join(outDir, 'markdown');
  const imgDir = path.join(outDir, 'images');

  for (const d of [mdDir, imgDir]) fs.mkdirSync(d, { recursive: true });

  const bundlePath = path.join(outDir, `${domain}_bundle.md`);
  const extractPath = path.join(outDir, `${domain}_extracted.json`);

  const allExtracted = [];

  if (bundle) {
    fs.writeFileSync(bundlePath, `# ${domain}\n\nCrawl date: ${new Date().toISOString()}\n\n---\n\n`);
  }

  const results = [];

  const crawler = new PlaywrightCrawler({
    launchContext: { launcher: chromium },
    browserPoolOptions: { useFingerprints: true },
    maxRequestsPerCrawl: maxPages,
    maxConcurrency: 5,
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(`🕵️  ${request.url}`);
      await page.waitForTimeout(Math.random() * 500 + 200);

      const html = await page.content();
      const pageText = await page.evaluate(() => document.body.innerText || '');

      // Content extraction
      let article;
      if (fullContent) {
        article = fullPageToMarkdown(html, request.url);
      } else {
        article = extractContent(html, request.url);
      }
      if (!article) return;

      const md = turndown.turndown(article.content);
      const header = `# ${article.title}\n\nURL: ${request.url}\n\n`;
      const content = header + md + '\n\n---\n\n';

      if (bundle) {
        fs.appendFileSync(bundlePath, content);
      } else {
        const safeName = request.url.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 100) + '.md';
        fs.writeFileSync(path.join(mdDir, safeName), content);
      }

      // Image harvesting
      const imgs = await page.evaluate(() =>
        [...new Set(Array.from(document.querySelectorAll('img')).map(i => i.src).filter(s => s.startsWith('http')))]
      );
      for (const s of imgs) await downloadImg(s, imgDir);

      // Structured data extraction
      if (extract) {
        const data = extractStructuredData(pageText);
        data._url = request.url;
        data._title = article.title;
        allExtracted.push(data);
      }

      results.push({ url: request.url, title: article.title });

      await enqueueLinks({
        strategy: 'same-domain',
        transformRequestFunction: (req) => {
          if (req.url.match(/\.(jpg|jpeg|png|gif|pdf|zip|svg|mp4|webp|css|js|json|xml)$/i)) return false;
          return req;
        }
      });
    }
  });

  await crawler.run([url.href]);

  // Save extraction results
  if (extract && allExtracted.length) {
    const merged = { _domain: domain, _crawlDate: new Date().toISOString(), _pages: allExtracted.length };
    // Merge all extracted contacts across pages
    for (const key of Object.keys(EXTRACT_PATTERNS)) {
      const vals = [...new Set(allExtracted.flatMap(p => p[key] || []))];
      if (vals.length) merged[key] = vals;
    }
    // Per-page breakdown
    merged._pages = allExtracted;
    fs.writeFileSync(extractPath, JSON.stringify(merged, null, 2));
  }

  return {
    outDir,
    results,
    bundlePath: bundle ? bundlePath : null,
    extractPath: (extract && allExtracted.length) ? extractPath : null,
  };
}

// ── MCP Server ──

async function runMcpServer() {
  const server = new Server({ name: 'crawlmd', version: '2.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
      name: 'crawl_site',
      description: 'Recursively crawl a website and convert it to LLM-ready Markdown.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The starting URL' },
          maxPages: { type: 'number', default: 10 },
          bundle: { type: 'boolean', default: true, description: 'Output as single markdown file' },
          full: { type: 'boolean', default: false, description: 'Save full page (not just article body)' },
          extract: { type: 'boolean', default: false, description: 'Extract emails, phones, addresses' },
          output: { type: 'string', default: '', description: 'Custom output directory' },
        },
        required: ['url']
      }
    }]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'crawl_site') {
      const { outDir, bundlePath, extractPath } = await runCrawl(request.params.arguments.url, {
        maxPages: request.params.arguments.maxPages || 10,
        bundle: request.params.arguments.bundle !== false,
        full: request.params.arguments.full || false,
        extract: request.params.arguments.extract || false,
        output: request.params.arguments.output || null,
      });
      const content = bundlePath ? fs.readFileSync(bundlePath, 'utf-8') : `Crawl finished. Files in ${outDir}`;
      return { content: [{ type: 'text', text: content }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ── Entry ──

const args = process.argv.slice(2);

if (args.includes('--mcp')) {
  runMcpServer().catch(console.error);
} else if (args.length > 0) {
  const url = args.find(a => !a.startsWith('--'));
  if (!url) {
    console.log('Usage: crawlmd <url> [--bundle] [--full] [--extract] [--output <dir>] [--mcp]');
    process.exit(1);
  }
  const bundle = args.includes('--bundle');
  const full = args.includes('--full');
  const extract = args.includes('--extract');
  const outputIdx = args.indexOf('--output');
  const output = outputIdx >= 0 && outputIdx + 1 < args.length ? args[outputIdx + 1] : null;

  const maxPagesIdx = args.indexOf('--max-pages');
  const maxPages = maxPagesIdx >= 0 && maxPagesIdx + 1 < args.length ? parseInt(args[maxPagesIdx + 1]) : 50;

  console.error(`🕷️  Crawling ${url}${full ? ' [full]' : ''}${extract ? ' [extract]' : ''}${output ? ` → ${output}` : ''}`);
  runCrawl(url, { maxPages, bundle, full, extract, output }).then((r) => {
    console.log(`\n✅ Done: ${r.outDir}`);
    console.log(`   ${r.results.length} pages`);
    if (r.bundlePath) console.log(`   📄 ${r.bundlePath}`);
    if (r.extractPath) console.log(`   📊 ${r.extractPath}`);
  }).catch(console.error);
} else {
  console.log(`
\x1b[36m🕷️  Crawlmd v2 - Web-to-Markdown\x1b[0m

Usage:
  npx crawlmd <url>                        # Article mode (Readability)
  npx crawlmd <url> --bundle               # Single markdown file

Options:
  --full            Save entire page (nav, footer, CTAs included)
  --extract         Extract emails, phones, addresses, social links
  --output <dir>    Custom output directory
  --max-pages <n>   Page limit (default 50)
  --mcp             Run as MCP server (for Claude/Cursor)
  `);
}
