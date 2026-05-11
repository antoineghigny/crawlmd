# 🕷️ Crawlmd

> **Recursive website-to-markdown crawler. Readability article extraction OR full-page capture, contact harvesting, stealth bypass, and image download.**

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green)](#)
[![Stealth Engine](https://img.shields.io/badge/Engine-Playwright%20Stealth-orange)](#)

Crawlmd is a recursive crawler that turns websites into clean, LLM-ready markdown. Works as CLI or MCP tool.

---

## Quick Start

```bash
# Article mode (Readability — strips nav/ads, keeps core content)
npx crawlmd https://example.com --bundle

# Full page mode (preserves navigation, footer, CTAs, everything)
npx crawlmd https://example.com --bundle --full

# Extract contact info (emails, phones, addresses, social links)
npx crawlmd https://example.com --bundle --extract --full

# Custom output directory
npx crawlmd https://example.com --output ./my-data
```

### MCP (for Claude Desktop / Cursor)

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

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--bundle` | off | Single markdown file with all pages |
| `--full` | off | Capture entire page (not just Readability article) |
| `--extract` | off | Extract emails, phones, addresses, social links |
| `--output <dir>` | `output/domain/` | Custom output directory |
| `--max-pages <n>` | 50 | Page crawl limit |
| `--mcp` | off | Run as MCP server |

## Output

```
output/example.com/
├── markdown/              # Individual .md files (when --bundle off)
├── images/                # Downloaded images
├── example.com_bundle.md  # All pages combined (when --bundle on)
└── example.com_extracted.json  # Contact info (when --extract on)
```

### Extracted JSON example

```json
{
  "_domain": "example.com",
  "email": ["info@example.com", "contact@example.com"],
  "phone": ["+32 477 12 34 56"],
  "address": ["22 Grand Place, 1400 Nivelles"],
  "social": ["facebook.com/example"]
}
```

---

## Build

```bash
git clone https://github.com/antoineghigny/crawlmd
cd crawlmd
npm install
npx playwright install chromium
```

---

## License

MIT — Antoine Ghigny
