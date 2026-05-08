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

const targetUrl = process.argv[2];
if (!targetUrl) {
    console.log('\x1b[36m%s\x1b[0m', '🕷️  Usage: npx crawlmd <url>');
    process.exit(1);
}

let url;
try {
    url = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
} catch (e) {
    console.error('❌ Invalid URL.');
    process.exit(1);
}

const domain = url.hostname;
const outDir = path.join(process.cwd(), 'output', domain.replace(/\./g, '_'));
const mdDir = path.join(outDir, 'markdown');
const imgDir = path.join(outDir, 'images');

[mdDir, imgDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

chromium.use(stealth);
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' }).use(gfm);

const extractContent = (html, url) => {
    const doc = new JSDOM(html, { url }).window.document;
    const reader = new Readability(doc);
    const article = reader.parse();
    return article ? { title: article.title, content: article.content } : null;
};

const downloadImg = async (src) => {
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

const crawler = new PlaywrightCrawler({
    launchContext: { launcher: chromium },
    browserPoolOptions: { useFingerprints: true },
    maxRequestsPerCrawl: 100,
    maxConcurrency: 5,
    
    async requestHandler({ request, page, enqueueLinks, log }) {
        log.info(`🕵️  Exploring: ${request.url}`);
        await page.waitForTimeout(Math.random() * 800 + 400);

        const html = await page.content();
        const article = extractContent(html, request.url);
        
        if (!article) return;

        const md = turndown.turndown(article.content);
        const fileName = request.url.replace(/[^a-z0-9]/gi, '_').toLowerCase().slice(0, 100) + '.md';
        fs.writeFileSync(path.join(mdDir, fileName), `# ${article.title}\n\nURL: ${request.url}\n\n${md}`);

        const imgs = await page.evaluate(() => Array.from(document.querySelectorAll('img')).map(i => i.src).filter(s => s.startsWith('http')));
        let downloaded = 0;
        for (const s of [...new Set(imgs)]) if (await downloadImg(s)) downloaded++;
        
        log.info(`📸  Saved ${downloaded} images.`);

        await enqueueLinks({
            strategy: 'same-domain',
            transformRequestFunction: (req) => {
                if (req.url.match(/\.(jpg|jpeg|png|gif|pdf|zip|svg|mp4|webp)$/i)) return false;
                if (req.url.includes('replytocom') || req.url.includes('#')) return false;
                return req;
            }
        });
    }
});

(async () => {
    console.log(`\n\x1b[32m🚀 Crawlmd starting on ${url.href}\x1b[0m\n`);
    await crawler.run([url.href]);
    console.log(`\n\x1b[32m✨ Done! Data stored in: output/${domain}\x1b[0m`);
})();
