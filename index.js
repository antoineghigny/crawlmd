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

// --- Configuration ---
chromium.use(stealth);
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).use(gfm);

const extractContent = (html, url) => {
    const doc = new JSDOM(html, { url }).window.document;
    const reader = new Readability(doc);
    const article = reader.parse();
    return article ? { title: article.title, content: article.content } : null;
};

const downloadImg = async (src, imgDir) => {
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
};

// --- Crawler Logic ---
async function runCrawl(targetUrl, options = { maxPages: 50, bundle: false }) {
    const url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    const domain = url.hostname;
    const outDir = path.join(process.cwd(), 'output', domain.replace(/\./g, '_'));
    const mdDir = path.join(outDir, 'markdown');
    const imgDir = path.join(outDir, 'images');

    [mdDir, imgDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

    const bundlePath = path.join(outDir, `${domain}_bundle.md`);
    if (options.bundle) fs.writeFileSync(bundlePath, `# Bundle for ${domain}\n\nGenerated on ${new Date().toISOString()}\n\n---\n\n`);

    const results = [];

    const crawler = new PlaywrightCrawler({
        launchContext: { launcher: chromium },
        browserPoolOptions: { useFingerprints: true },
        maxRequestsPerCrawl: options.maxPages,
        maxConcurrency: 5,
        async requestHandler({ request, page, enqueueLinks, log }) {
            log.info(`🕵️  Exploring: ${request.url}`);
            await page.waitForTimeout(Math.random() * 500 + 200);

            const html = await page.content();
            const article = extractContent(html, request.url);
            if (!article) return;

            const md = turndown.turndown(article.content);
            const content = `# ${article.title}\n\nURL: ${request.url}\n\n${md}\n\n---\n\n`;

            if (options.bundle) {
                fs.appendFileSync(bundlePath, content);
            } else {
                const fileName = request.url.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 100) + '.md';
                fs.writeFileSync(path.join(mdDir, fileName), content);
            }

            const imgs = await page.evaluate(() => Array.from(document.querySelectorAll('img')).map(i => i.src).filter(s => s.startsWith('http')));
            for (const s of [...new Set(imgs)]) await downloadImg(s, imgDir);

            results.push({ url: request.url, title: article.title });

            await enqueueLinks({
                strategy: 'same-domain',
                transformRequestFunction: (req) => {
                    if (req.url.match(/\.(jpg|jpeg|png|gif|pdf|zip|svg|mp4|webp)$/i)) return false;
                    return req;
                }
            });
        }
    });

    await crawler.run([url.href]);
    return { outDir, results, bundlePath: options.bundle ? bundlePath : null };
}

// --- MCP Server Mode ---
async function runMcpServer() {
    const server = new Server({ name: 'crawlmd', version: '1.0.0' }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [{
            name: 'crawl_site',
            description: 'Recursively crawl a website and convert it to LLM-ready Markdown.',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The starting URL' },
                    maxPages: { type: 'number', description: 'Limit of pages to crawl', default: 10 },
                    bundle: { type: 'boolean', description: 'Output everything in one single file', default: true }
                },
                required: ['url']
            }
        }]
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        if (request.params.name === 'crawl_site') {
            const { outDir, bundlePath } = await runCrawl(request.params.arguments.url, { 
                maxPages: request.params.arguments.maxPages || 10,
                bundle: request.params.arguments.bundle !== false
            });
            const content = bundlePath ? fs.readFileSync(bundlePath, 'utf-8') : `Crawl finished. Files in ${outDir}`;
            return { content: [{ type: 'text', text: content }] };
        }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

// --- Main Entry point ---
const args = process.argv.slice(2);
if (args.includes('--mcp')) {
    runMcpServer().catch(console.error);
} else if (args.length > 0) {
    const bundle = args.includes('--bundle');
    const url = args.find(a => !a.startsWith('--'));
    runCrawl(url, { maxPages: 50, bundle }).catch(console.error);
} else {
    console.log(`
\x1b[36m🕷️  Crawlmd - Surgical Web-to-Markdown\x1b[0m

Usage CLI:
  npx crawlmd <url>           # Standard crawl
  npx crawlmd <url> --bundle  # One single big Markdown file

Usage MCP (for Claude/Cursor):
  npx crawlmd --mcp
    `);
}
