# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language Preference

**请使用中文与我对话。** Please communicate with me in Chinese for all responses, explanations, and discussions about this project.

## Project Overview

Feishu Shadow is a TypeScript-based web crawler that extracts content from Feishu (飞书) documents and converts them to Word (.docx) format. It uses Puppeteer for browser automation to handle dynamic content loading and API interception.

## Build and Run Commands

```bash
# Install dependencies
npm install

# Run the crawler (uses hardcoded test URL in src/index.ts)
npm start
```

Note: The URL is currently hardcoded in `src/index.ts`. Modify the `url` variable to crawl different documents.

## Architecture

The codebase uses a modular class-based architecture with centralized configuration:

**Entry Point (`src/index.ts`)**: Hardcoded test URL and invokes the main crawler function.

**Core Crawler (`src/crawler/index.ts`)**: Orchestrates the crawling workflow:
1. Validates URL
2. Checks cache for previously crawled content
3. Launches Puppeteer browser
4. Intercepts network requests to capture Feishu API responses
5. Navigates to document and triggers content loading (scrolling, expanding)
6. Extracts content using ContentExtractor
7. Generates Word document using WordProcessor
8. Saves cache for future use

**Configuration (`src/config/index.ts`)**: Centralized configuration for:
- Browser settings (headless mode, viewport, user agent)
- Crawl parameters (timeouts, selectors, scroll config)
- Parallel processing limits
- Cache settings (directory, expiry time)
- File output paths

**Utilities (`src/utils/`)**: Specialized modules:
- `browser-manager.ts`: Puppeteer browser lifecycle management
- `content-extractor.ts`: Extracts structured content from Feishu pages
- `word-processor.ts`: Generates Word documents from extracted content
- `cache-manager.ts`: Handles content caching to avoid re-crawling
- `parallel-processor.ts`: Manages parallel task execution
- `error-handler.ts`: Centralized error handling
- `markdown-processor.ts`: Markdown generation utilities
- `http.ts`: URL validation

**Type Definitions (`src/types/index.ts`)**: TypeScript interfaces for CrawlerConfig.

## Key Implementation Details

- Uses Puppeteer in non-headless mode (`headless: false`) for debugging
- Intercepts Feishu API responses to extract document data directly from network traffic
- Implements intelligent scrolling to trigger lazy-loaded content
- Automatically expands collapsible sections using configured selectors
- Caches extracted content for 24 hours to avoid redundant crawling
- Outputs Word documents to `out/{document-title}/` directory
- Supports parallel processing with configurable concurrency limits

## Output

Generated files are saved to `out/{document-title}/`:
- `{document-title}.docx` - Word document with extracted content
- Cache files stored in `cache/` directory
