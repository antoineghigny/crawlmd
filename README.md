# 🕷️ Crawlmd

> **Surgical website-to-markdown crawler for LLM context. Features AI Agent (MCP) support, stealth bypass, and automated image harvesting.**

[![Built for AI](https://img.shields.io/badge/Built%20for-AI--Context-blueviolet)](#) 
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green)](#)
[![Stealth Engine](https://img.shields.io/badge/Engine-Playwright%20Stealth-orange)](#)

**Crawlmd** is a high-performance recursive crawler designed to transform entire websites into clean, LLM-ready datasets. It is built to be used by both humans (CLI) and AI agents (MCP).

---

## 🌟 Key Highlights
* **🕵️ Stealth Bypass:** Built-in stealth engine to evade anti-bot detections (Cloudflare, etc.).
* **📝 Surgical Extraction:** Uses **Mozilla Readability** to extract only the core content, ignoring navbars and ads.
* **📸 Image Harvesting:** Downloads physical image files locally for multimodal AI models.
* **🤖 MCP Ready:** Use it as a tool directly inside **Claude Desktop**, **Cursor**, or **Claude Code**.
* **📦 Bundle Mode:** Option to merge an entire site into a **single Markdown file** for easier LLM ingestion.

---

## 🚀 Quick Start

### CLI Usage
Turn any domain into a structured Markdown library in seconds.

```bash
npx crawlmd https://example.com --bundle
```

### 🤖 AI Agent Integration (MCP)
To use Crawlmd as a tool in **Claude Desktop**, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "crawlmd": {
      "command": "npx",
      "args": ["-y", "crawlmd", "--mcp"]
    }
  }
}
```

---

## 📂 Repository Structure
```text
├── index.js          # Hybrid CLI/MCP logic
├── package.json      # Binary & dependencies
└── output/           # Scraped data
    └── domain_name/
        ├── markdown/ # Individual .md files
        ├── images/   # Actual image assets
        └── bundle.md # One-file-to-rule-them-all (with --bundle)
```

---

## 🧠 Core Principles
1. **Surgical Signal:** Target only the core article content to maximize signal-to-noise ratio for RAG.
2. **Agent-First:** Native MCP support allows AI agents to "browse" and "crawl" sites on their own.
3. **Local Sovereignty:** Total ownership of text and image data.

---

<p align="center">Built for the AI-First Era by Antoine Ghigny</p>
