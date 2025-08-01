/**
 * Sitemap Scan
 *
 * This script can be run directly from the command line OR
 * imported as a module into other Node.js projects.
 *
 * Command-Line Usage:
 * node sitemap-scan.js example.com --urls
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
            await axios.head(sitemapUrl, { headers: { 'User-Agent': 'Sitemap-Scan/1.0' } });
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
 * @param {string} sitemapUrl - The URL of the sitemap to parse.
 * @returns {Promise<{subSitemaps: string[], contentUrls: string[]}>} An object containing arrays of sub-sitemaps and content URLs.
 */
async function parseSitemap(sitemapUrl) {
    console.log(`🔎 Parsing ${sitemapUrl}...`);
    let subSitemaps = [];
    let contentUrls = [];

    try {
        const response = await axios.get(sitemapUrl, { headers: { 'User-Agent': 'Sitemap-Scan/1.0' } });
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        if (result.sitemapindex && result.sitemapindex.sitemap) {
            const sitemapLocations = result.sitemapindex.sitemap.map(entry => entry.loc[0]);
            subSitemaps.push(...sitemapLocations);

            for (const location of sitemapLocations) {
                const nestedResult = await parseSitemap(location);
                subSitemaps.push(...nestedResult.subSitemaps);
                contentUrls.push(...nestedResult.contentUrls);
            }
        }

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
 * A function to be used when this file is imported as a library.
 * It finds and returns all content URLs from a domain's sitemap.
 * @param {string} domain - The domain to scan.
 * @returns {Promise<string[]>} A flat array of all content URLs.
 */
async function getLinks(domain) {
    const mainSitemapUrl = await findMainSitemap(domain);
    if (!mainSitemapUrl) {
        return [];
    }
    const { contentUrls } = await parseSitemap(mainSitemapUrl);
    return contentUrls;
}

// --- Command-Line Execution ---

/**
 * The main function to orchestrate the sitemap finding and parsing process for CLI use.
 */
async function cliMain() {
    const domain = process.argv[2];
    const argument = process.argv[3]; // --main, --subs, or --urls

    if (!domain || !argument) {
        console.error('❌ Please provide a domain and an argument.');
        console.log('Usage: node sitemap-scan.js example.com [--main|--subs|--urls]');
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

// This is the key: It checks if the script is being run directly.
// If so, it runs the command-line interface logic.
// If it's being imported (`require`d), this block is skipped.
if (require.main === module) {
    cliMain().catch(console.error);
}

// Export the functions you want to make available to other scripts.
module.exports = {
    findMainSitemap,
    parseSitemap,
    getLinks
};
