# 🕷️ Crawlmd

> **Surgical website-to-markdown crawler for LLM context. Features anti-bot stealth bypass, content extraction via Mozilla Readability, and automated image harvesting.**

[![Built for AI](https://img.shields.io/badge/Built%20for-AI--Context-blueviolet)](#) 
[![Stealth Engine](https://img.shields.io/badge/Engine-Playwright%20Stealth-orange)](#)
[![Mozilla Readability](https://img.shields.io/badge/Extraction-Mozilla%20Readability-green)](#)

**Crawlmd** is a high-performance, recursive crawler designed to transform entire websites into clean, LLM-ready datasets. It bypasses **403 Forbidden errors**, eliminates **DOM noise**, and **downloads physical image files** locally for multimodal RAG and fine-tuning.

---

## 🌟 Key Highlights
* **🕵️ Stealth Bypass:** Uses Playwright Stealth to mimic human behavior and evade Cloudflare, DataDome, and advanced WAFs.
* **📝 Surgical Extraction:** Powered by **Mozilla Readability** (the engine behind Firefox Reader View) to identify and extract the core article content while discarding navbars, ads, and footers.
* **📸 Local Harvesting:** Automatically downloads and stores image assets locally, ensuring your AI models have access to full multimodal context.
* **🚀 Zero-Config CLI:** No Docker or complex infrastructure required. Run it anywhere with a single command.

---

## 🚀 Quick Start
Turn any domain into a structured Markdown library in seconds.

| Command | Action |
| :--- | :--- |
| `npx crawlmd <url>` | Recursive crawl & markdown generation. |

### Installation
```bash
# Install dependencies
npm install

# Setup browser
npx playwright install chromium
```

### Usage
```bash
node index.js https://www.remauto.be
```

---

## 📂 Repository Structure
```text
├── index.js          # Unified crawler logic (Readability + Stealth)
├── package.json      # Binary definitions & dependencies
└── output/           # Scraped data (Auto-generated)
    └── domain_name/
        ├── markdown/ # Clean .md files for LLM training
        └── images/   # Actual image assets (.jpg, .png, .webp)
```

---

## 🧠 Core Principles
1. **Surgical Content:** Only extract what matters. Using the Readability algorithm ensures the highest signal-to-noise ratio for your LLM context.
2. **Stealth by Default:** Adaptive delays and browser fingerprinting to respect rate limits and bypass detection.
3. **Data Sovereignty:** Local storage of text and images for permanent, offline access to your datasets.

---

## 🛡️ Why Crawlmd?
Mainstream tools like Firecrawl are powerful but heavy. **Crawlmd** provides a surgical, lightweight alternative that prioritizes content quality and multimodal data (images) without the need for Docker or API keys. It is the definitive "Gitingest" equivalent for the broader web.

---

<p align="center">Built by Antoine Ghigny</p>
