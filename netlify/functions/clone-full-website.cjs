const axios = require('axios');
const cheerio = require('cheerio');
const archiver = require('archiver');
const path = require('path');
const { URL } = require('url');
const { fetchWithCloudflare } = require('./cloudflare-helper.cjs');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body);
    let url = body.url?.trim();
    const maxPages = Math.min(body.maxPages || 10, 50); // Limit to 50 pages max
    const maxDepth = Math.min(body.maxDepth || 2, 5); // Limit depth to 5

    if (!url) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    const urlObj = new URL(url);
    const baseHost = urlObj.host;
    const baseUrl = `${urlObj.protocol}//${baseHost}`;

    console.log(`Starting clone of ${baseUrl} with maxPages=${maxPages}, maxDepth=${maxDepth}`);

    // Storage for all downloaded content
    const pages = new Set();
    const visitedUrls = new Set();
    const assets = new Map(); // URL -> Buffer
    const assetTypes = new Map(); // URL -> content-type

    // First, try to discover pages from sitemap (helps with React/SPA sites)
    console.log('Checking for sitemap.xml...');
    const sitemapUrls = await fetchSitemap(baseUrl, baseHost, maxPages);

    if (sitemapUrls.size > 0) {
      console.log(`Found ${sitemapUrls.size} URLs from sitemap`);
      for (const sitemapUrl of sitemapUrls) {
        if (pages.size < maxPages) {
          pages.add(sitemapUrl);
          visitedUrls.add(sitemapUrl);
        }
      }
    }

    // Also crawl website to find pages not in sitemap
    await crawlWebsite(url, baseHost, pages, visitedUrls, maxPages, maxDepth, 0);

    console.log(`Found ${pages.size} pages to clone`);
    console.log(`Pages found: ${Array.from(pages).join(', ')}`);

    // Download all pages and collect assets with progress logging
    const pageData = new Map();
    let pageCount = 0;

    for (const pageUrl of pages) {
      try {
        pageCount++;
        console.log(`Downloading page ${pageCount}/${pages.size}: ${pageUrl}`);

        const { html, pageAssets } = await downloadPageWithAssets(pageUrl, baseUrl, baseHost);
        pageData.set(pageUrl, html);

        // Collect all assets
        for (const [assetUrl, assetInfo] of pageAssets) {
          if (!assets.has(assetUrl)) {
            assets.set(assetUrl, assetInfo.buffer);
            assetTypes.set(assetUrl, assetInfo.type);
          }
        }

        console.log(`Page ${pageCount} done: ${pageAssets.size} assets collected`);
      } catch (error) {
        console.error(`Failed to download page ${pageUrl}:`, error.message);
      }
    }

    console.log(`Downloaded ${pageData.size} pages and ${assets.size} assets. Creating ZIP...`);

    // Create ZIP file with minimal compression for speed
    const archive = archiver('zip', {
      zlib: { level: 1 } // Fastest compression
    });

    const chunks = [];
    let finalized = false;

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => { finalized = true; });
    archive.on('error', (err) => { throw err; });

    // Add pages to ZIP
    console.log(`Adding ${pageData.size} pages to ZIP...`);
    for (const [pageUrl, html] of pageData) {
      const relativePath = urlToPath(pageUrl, baseUrl);
      archive.append(html, { name: relativePath });
    }

    // Add assets to ZIP
    console.log(`Adding ${assets.size} assets to ZIP...`);
    for (const [assetUrl, buffer] of assets) {
      const relativePath = urlToPath(assetUrl, baseUrl);
      archive.append(buffer, { name: relativePath });
    }

    // Add simple README
    const readme = `Cloned: ${baseHost} - ${new Date().toISOString()}\nPages: ${pageData.size} | Assets: ${assets.size}\n\nOpen index.html in your browser.`;
    archive.append(readme, { name: 'README.txt' });

    console.log('Finalizing ZIP...');

    // Finalize and wait with timeout (reduced for production)
    const finalizePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('ZIP finalize timeout')), 5000);
      archive.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });
      archive.finalize();
    });

    await finalizePromise;

    const zipBuffer = Buffer.concat(chunks);
    console.log(`ZIP created: ${(zipBuffer.length / 1024).toFixed(2)} KB`);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${baseHost}-clone.zip"`
      },
      body: zipBuffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Clone error:', error);
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'An error occurred while cloning the website'
      })
    };
  }
};

// Fetch and parse sitemap.xml to discover URLs (helps with React/SPA sites)
async function fetchSitemap(baseUrl, baseHost, maxPages) {
  const discoveredUrls = new Set();
  const sitemapUrls = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
    `${baseUrl}/sitemaps/sitemap.xml`
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      console.log(`Checking sitemap: ${sitemapUrl}`);
      const response = await axios.get(sitemapUrl, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (response.status === 200 && response.data) {
        const $ = cheerio.load(response.data, { xmlMode: true });

        // Check if it's a sitemap index (contains other sitemaps)
        const sitemapRefs = $('sitemap > loc');
        if (sitemapRefs.length > 0) {
          console.log(`Found sitemap index with ${sitemapRefs.length} child sitemaps`);

          // Fetch child sitemaps (limit to first 3 to save time)
          const childSitemaps = [];
          sitemapRefs.slice(0, 3).each((i, elem) => {
            childSitemaps.push($(elem).text().trim());
          });

          for (const childUrl of childSitemaps) {
            try {
              const childResponse = await axios.get(childUrl, {
                timeout: 5000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });

              if (childResponse.status === 200) {
                const child$ = cheerio.load(childResponse.data, { xmlMode: true });
                child$('url > loc').each((i, elem) => {
                  const pageUrl = child$(elem).text().trim();
                  if (pageUrl && discoveredUrls.size < maxPages) {
                    try {
                      const urlObj = new URL(pageUrl);
                      if (urlObj.host === baseHost) {
                        discoveredUrls.add(pageUrl);
                      }
                    } catch (e) {}
                  }
                });
              }
            } catch (childErr) {
              console.log(`Failed to fetch child sitemap: ${childUrl}`);
            }
          }
        }

        // Parse regular sitemap URLs
        $('url > loc').each((i, elem) => {
          const pageUrl = $(elem).text().trim();
          if (pageUrl && discoveredUrls.size < maxPages) {
            try {
              const urlObj = new URL(pageUrl);
              if (urlObj.host === baseHost) {
                discoveredUrls.add(pageUrl);
              }
            } catch (e) {}
          }
        });

        if (discoveredUrls.size > 0) {
          console.log(`Sitemap found! Discovered ${discoveredUrls.size} URLs from ${sitemapUrl}`);
          break; // Found a valid sitemap, stop checking others
        }
      }
    } catch (error) {
      // Sitemap not found at this location, try next
      console.log(`No sitemap at ${sitemapUrl}`);
    }
  }

  return discoveredUrls;
}

// Crawl website to find all pages
async function crawlWebsite(url, baseHost, pages, visitedUrls, maxPages, maxDepth, currentDepth) {
  if (visitedUrls.has(url) || pages.size >= maxPages || currentDepth > maxDepth) {
    return;
  }

  visitedUrls.add(url);

  try {
    const urlObj = new URL(url);

    // Only crawl pages from the same host
    if (urlObj.host !== baseHost) {
      return;
    }

    // Skip non-HTML resources
    const ext = path.extname(urlObj.pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.gif', '.css', '.js', '.pdf', '.zip'].includes(ext)) {
      return;
    }

    pages.add(url);

    // Try cloudscraper first to bypass Cloudflare (reduced timeout for speed)
    let response;
    try {
      response = await fetchWithCloudflare(url, { timeout: 7000 });
    } catch (cfError) {
      console.log(`Cloudscraper failed for ${url}, trying axios...`);
      // Fallback to regular axios
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 7000,
        maxRedirects: 3
      });
      response = { data: response.data, status: response.status };
    }

    const $ = cheerio.load(response.data);

    // Find all links
    const links = [];
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          const absoluteUrl = new URL(href, url).href;
          const linkUrlObj = new URL(absoluteUrl);
          // Only add links from same host
          if (linkUrlObj.host === baseHost) {
            links.push(absoluteUrl);
          }
        } catch (e) {
          // Invalid URL
        }
      }
    });

    console.log(`Found ${links.length} links on ${url} (depth ${currentDepth}/${maxDepth})`);
    if (links.length > 0) {
      console.log(`Sample links: ${links.slice(0, 5).join(', ')}`);
    }

    // Recursively crawl found links
    for (const link of links) {
      if (pages.size < maxPages && currentDepth < maxDepth) {
        await crawlWebsite(link, baseHost, pages, visitedUrls, maxPages, maxDepth, currentDepth + 1);
      }
    }

  } catch (error) {
    console.log(`Failed to crawl ${url}: ${error.message}`);
  }
}

// Download a page and all its assets
async function downloadPageWithAssets(url, baseUrl, baseHost) {
  // Try cloudscraper first to bypass Cloudflare (reduced timeout for production)
  let response;
  try {
    response = await fetchWithCloudflare(url, { timeout: 8000 });
  } catch (cfError) {
    console.log(`Cloudscraper failed for ${url}, trying axios...`);
    // Fallback to regular axios
    response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    response = { data: response.data, status: response.status };
  }

  const $ = cheerio.load(response.data);
  const pageAssets = new Map();

  // Download CSS files in parallel
  const cssLinks = $('link[rel="stylesheet"]');
  const cssPromises = [];

  cssLinks.each((i, elem) => {
    const link = $(elem);
    const href = link.attr('href');

    if (href && !href.startsWith('data:')) {
      cssPromises.push(
        (async () => {
          try {
            const cssUrl = new URL(href, url).href;
            const cssResponse = await axios.get(cssUrl, {
              timeout: 5000, // Reduced for faster response
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (cssResponse.status === 200) {
              pageAssets.set(cssUrl, {
                buffer: Buffer.from(cssResponse.data),
                type: 'text/css'
              });

              const localPath = urlToPath(cssUrl, baseUrl);
              link.attr('href', localPath);
            }
          } catch (error) {
            console.log(`Failed to download CSS: ${href}`);
          }
        })()
      );
    }
  });

  // Download JavaScript files in parallel
  const scripts = $('script[src]');
  const jsPromises = [];

  scripts.each((i, elem) => {
    const script = $(elem);
    const src = script.attr('src');

    if (src && !src.startsWith('data:')) {
      jsPromises.push(
        (async () => {
          try {
            const jsUrl = new URL(src, url).href;
            const jsResponse = await axios.get(jsUrl, {
              timeout: 5000, // Reduced for faster response
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (jsResponse.status === 200) {
              pageAssets.set(jsUrl, {
                buffer: Buffer.from(jsResponse.data),
                type: 'application/javascript'
              });

              const localPath = urlToPath(jsUrl, baseUrl);
              script.attr('src', localPath);
            }
          } catch (error) {
            console.log(`Failed to download JS: ${src}`);
          }
        })()
      );
    }
  });

  // Download images in parallel
  const images = $('img[src]');
  const imagePromises = [];

  images.each((i, elem) => {
    const img = $(elem);
    const src = img.attr('src');

    if (src && !src.startsWith('data:')) {
      imagePromises.push(
        (async () => {
          try {
            const imgUrl = new URL(src, url).href;
            const imgResponse = await axios.get(imgUrl, {
              responseType: 'arraybuffer',
              timeout: 5000, // Reduced for faster response
              maxContentLength: 10 * 1024 * 1024, // Max 10MB per image
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            if (imgResponse.status === 200) {
              pageAssets.set(imgUrl, {
                buffer: Buffer.from(imgResponse.data),
                type: imgResponse.headers['content-type'] || 'image/png'
              });

              const localPath = urlToPath(imgUrl, baseUrl);
              img.attr('src', localPath);
              img.removeAttr('srcset');
            }
          } catch (error) {
            console.log(`Failed to download image: ${src}`);
          }
        })()
      );
    }
  });

  // Wait for all downloads to complete in parallel
  await Promise.all([...cssPromises, ...jsPromises, ...imagePromises]);

  console.log(`Downloaded ${pageAssets.size} assets for ${url}: ${cssPromises.length} CSS, ${jsPromises.length} JS, ${imagePromises.length} images`);

  // Skip icon downloads to save time

  // Fix internal links
  $('a[href]').each((i, a) => {
    const $a = $(a);
    const href = $a.attr('href');

    if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('javascript:')) {
      try {
        const absoluteUrl = new URL(href, url);

        // If it's an internal link, make it point to local file
        if (absoluteUrl.host === baseHost) {
          const localPath = urlToPath(absoluteUrl.href, baseUrl);
          $a.attr('href', localPath);
        }
        // Keep external links as absolute
      } catch (e) {
        // Invalid URL, keep as is
      }
    }
  });

  return {
    html: $.html(),
    pageAssets
  };
}

// Process CSS to download fonts and background images
async function processCSS(cssContent, cssUrl, pageAssets, baseHost) {
  // Find all url() references in CSS
  const urlPattern = /url\(['"]?([^'")\s]+)['"]?\)/gi;
  let match;
  const replacements = [];

  while ((match = urlPattern.exec(cssContent)) !== null) {
    const resourceUrl = match[1];

    if (!resourceUrl.startsWith('data:')) {
      try {
        const absoluteUrl = new URL(resourceUrl, cssUrl).href;
        const urlObj = new URL(absoluteUrl);

        // Download the resource (font, image, etc.)
        const response = await axios.get(absoluteUrl, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (response.status === 200) {
          pageAssets.set(absoluteUrl, {
            buffer: Buffer.from(response.data),
            type: response.headers['content-type']
          });

          // Calculate relative path
          const localPath = urlToPath(absoluteUrl, `${urlObj.protocol}//${baseHost}`);
          replacements.push({
            original: match[0],
            replacement: `url('${localPath}')`
          });
        }
      } catch (error) {
        console.log(`Failed to download CSS resource ${resourceUrl}`);
      }
    }
  }

  // Apply all replacements
  for (const repl of replacements) {
    cssContent = cssContent.replace(repl.original, repl.replacement);
  }

  return cssContent;
}

// Convert URL to local file path
function urlToPath(url, baseUrl) {
  try {
    const urlObj = new URL(url);
    const baseUrlObj = new URL(baseUrl);

    // Get pathname
    let pathname = urlObj.pathname;

    // Handle root path
    if (pathname === '/' || pathname === '') {
      return 'index.html';
    }

    // If path ends with /, it's a directory - add index.html
    if (pathname.endsWith('/')) {
      pathname += 'index.html';
    }

    // If no extension and looks like a page, add .html
    const ext = path.extname(pathname);
    if (!ext && !pathname.includes('.')) {
      // Check if it's not an asset type path
      if (!pathname.match(/\/(css|js|images?|assets?|static|fonts?|media)\//)) {
        pathname += '.html';
      }
    }

    // Remove leading slash and return
    pathname = pathname.substring(1);

    // Handle external CDN/different domain resources
    if (urlObj.host !== baseUrlObj.host) {
      // Create a folder for external resources
      const hostFolder = urlObj.host.replace(/[^a-z0-9]/gi, '_');
      return `external/${hostFolder}/${pathname}`;
    }

    return pathname || 'index.html';
  } catch (e) {
    console.error(`Error converting URL to path: ${url}`, e.message);
    return 'index.html';
  }
}
