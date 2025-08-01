/**
 * Sitemap URL Finder
 *
 * Description:
 * This script is designed to find and extract URLs from a domain's sitemap.
 * It can identify the main sitemap, discover any nested sub-sitemaps, and
 * retrieve all the final content URLs. You can control the output using
 * command-line arguments.
 *
 * Prerequisites:
 * - Node.js
 * - npm packages: axios, xml2js
 *
 * How to run:
 * 1. Save this script as `sitemap-finder.js`.
 * 2. In your terminal, run: `npm install axios xml2js`
 *
 * 3. Execute the script with a domain and an argument:
 * - To get the main sitemap URL:
 * `node sitemap-finder.js example.com --main`
 *
 * - To get all sub-sitemap URLs:
 * `node sitemap-finder.js example.com --subs`
 *
 * - To get all content URLs:
 * `node sitemap-finder.js example.com --urls`
 */

const axios = require('axios');
const xml2js = require('xml2js');

/**
 * Tries to find a valid sitemap URL for a given domain by checking common paths.
 * @param {string} domain - The domain to search for a sitemap.
 * @returns {Promise<string|null>} The URL of the main sitemap, or null if not found.
 */
async function findMainSitemap(domain) {
    const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
    const origin = new URL(baseUrl).origin;

    console.log(`🔎 Searching for a sitemap on ${origin}...`);

    // Common sitemap paths to check
    const sitemapPaths = [
        '/sitemap.xml',
        '/sitemap_index.xml',
        '/wp-sitemap.xml',
        '/sitemap-index.xml',
        '/sitemap.xml.gz',
    ];

    for (const sitemapPath of sitemapPaths) {
        const sitemapUrl = `${origin}${sitemapPath}`;
        try {
            // Use a HEAD request to check for existence without downloading the body
            await axios.head(sitemapUrl, { headers: { 'User-Agent': 'Sitemap-Finder/1.0' } });
            console.log(`✅ Found main sitemap at: ${sitemapUrl}`);
            return sitemapUrl;
        } catch (error) {
            // Path doesn't exist, so we continue to the next one
        }
    }

    console.log(`❌ Could not find a sitemap for ${domain}.`);
    return null;
}

/**
 * Fetches and recursively parses a sitemap or sitemap index.
 * This function collects both sub-sitemap URLs and final content URLs.
 * @param {string} sitemapUrl - The URL of the sitemap to parse.
 * @returns {Promise<{subSitemaps: string[], contentUrls: string[]}>} An object containing arrays of sub-sitemaps and content URLs.
 */
async function parseSitemap(sitemapUrl) {
    console.log(`🔎 Parsing ${sitemapUrl}...`);
    let subSitemaps = [];
    let contentUrls = [];

    try {
        const response = await axios.get(sitemapUrl, { headers: { 'User-Agent': 'Sitemap-Finder/1.0' } });
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        // Check if it's a sitemap index file
        if (result.sitemapindex && result.sitemapindex.sitemap) {
            const sitemapLocations = result.sitemapindex.sitemap.map(entry => entry.loc[0]);
            subSitemaps.push(...sitemapLocations); // Add found sitemaps to the list

            // Recursively parse the sub-sitemaps
            for (const location of sitemapLocations) {
                const nestedResult = await parseSitemap(location);
                subSitemaps.push(...nestedResult.subSitemaps);
                contentUrls.push(...nestedResult.contentUrls);
            }
        }

        // Check if it's a regular sitemap with URLs
        if (result.urlset && result.urlset.url) {
            const urls = result.urlset.url.map(entry => entry.loc[0]);
            contentUrls.push(...urls);
        }
    } catch (error) {
        console.error(`❌ An error occurred with sitemap: ${sitemapUrl}`, error.message);
    }

    return { subSitemaps, contentUrls };
}


/**
 * The main function to orchestrate the sitemap finding and parsing process.
 */
async function main() {
    const domain = process.argv[2];
    const argument = process.argv[3]; // --main, --subs, or --urls

    if (!domain || !argument) {
        console.error('❌ Please provide a domain and an argument.');
        console.log('Usage: node sitemap-finder.js example.com [--main|--subs|--urls]');
        process.exit(1);
    }

    const mainSitemapUrl = await findMainSitemap(domain);
    if (!mainSitemapUrl) {
        process.exit(1);
    }

    if (argument === '--main') {
        console.log('\nMain Sitemap URL:');
        console.log(mainSitemapUrl);
        return;
    }

    const { subSitemaps, contentUrls } = await parseSitemap(mainSitemapUrl);

    if (argument === '--subs') {
        if (subSitemaps.length > 0) {
            console.log(`\nFound ${subSitemaps.length} Sub-Sitemap URLs:`);
            subSitemaps.forEach(url => console.log(url));
        } else {
            console.log('\nNo sub-sitemaps found.');
        }
        return;
    }

    if (argument === '--urls') {
        if (contentUrls.length > 0) {
            console.log(`\nFound ${contentUrls.length} Content URLs:`);
            contentUrls.forEach(url => console.log(url));
        } else {
            console.log('\nNo content URLs found in the sitemap(s).');
        }
        return;
    }

    console.error(`❌ Invalid argument: ${argument}. Please use --main, --subs, or --urls.`);
    process.exit(1);
}

main().catch(console.error);
