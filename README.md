# Sitemap Scan

A simple and efficient command-line tool to find the main sitemap, discover all nested sub-sitemaps, and extract every content URL from a domain.

## Installation

You can install this tool globally via npm:

```bash
npm install -g sitemap-scan
```
Or run it directly without installing using npx:

```bash
npx sitemap-scan example.com --urls
```
Usage
The command requires a domain and an argument specifying what information to retrieve.

Command Format:

```bash
find-sitemap-urls <domain> [--main|--subs|--urls]
```
Examples
1. Get the main sitemap URL:

```bash
find-sitemap-urls example.com --main
```

2. Get all sub-sitemap URLs:

```bash
find-sitemap-urls example.com --subs
```

3. Get all final content URLs:

```bash
find-sitemap-urls example.com --urls
```
