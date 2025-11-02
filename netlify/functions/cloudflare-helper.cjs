// Cloudflare bypass helper using cloudscraper
const cloudscraper = require('cloudscraper');

// Fetch URL using cloudscraper to bypass Cloudflare
async function fetchWithCloudflare(url, options = {}) {
  const timeout = options.timeout || 30000;

  console.log(`Cloudscraper fetching: ${url}`);

  try {
    const response = await cloudscraper({
      uri: url,
      method: 'GET',
      timeout: timeout,
      resolveWithFullResponse: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      }
    });

    console.log(`Cloudscraper successfully fetched: ${url} (status: ${response.statusCode})`);

    return {
      status: response.statusCode,
      data: response.body,
      headers: response.headers
    };

  } catch (error) {
    console.error(`Cloudscraper error for ${url}:`, error.message);
    throw error;
  }
}

// Fetch with POST method if needed
async function fetchWithCloudflarePOST(url, data, options = {}) {
  const timeout = options.timeout || 30000;

  console.log(`Cloudscraper POST to: ${url}`);

  try {
    const response = await cloudscraper({
      uri: url,
      method: 'POST',
      body: data,
      json: true,
      timeout: timeout,
      resolveWithFullResponse: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/json'
      }
    });

    return {
      status: response.statusCode,
      data: response.body,
      headers: response.headers
    };

  } catch (error) {
    console.error(`Cloudscraper POST error for ${url}:`, error.message);
    throw error;
  }
}

module.exports = {
  fetchWithCloudflare,
  fetchWithCloudflarePOST
};
