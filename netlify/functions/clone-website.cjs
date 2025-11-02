const axios = require('axios');
const cheerio = require('cheerio');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
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
    const embedImages = body.embedImages !== false; // Default to true

    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    // Validate URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Fetch the website
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000,
      maxRedirects: 5
    });

    // Parse HTML with Cheerio
    const $ = cheerio.load(response.data);

    // Get page title
    const title = $('title').text() || 'Cloned Website';

    // Add meta tag to help with CORS
    $('head').prepend('<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">');

    // Add base tag to help with relative URLs
    const urlObj = new URL(url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    if (!$('base').length) {
      $('head').prepend(`<base href="${baseUrl}/">`);
    }

    // Process CSS - inline external stylesheets
    await inlineCSS($, url);

    // Process images - embed as base64 or use absolute URLs
    if (embedImages) {
      await embedImagesAsBase64($, url);
    } else {
      processImages($, url);
    }

    // Process scripts - inline critical scripts
    await inlineScripts($, url);

    // Update all relative URLs to absolute
    updateURLs($, url);

    // Get the processed HTML
    const clonedHTML = $.html();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        html: clonedHTML,
        title: title,
        size: clonedHTML.length,
        url: url
      })
    };

  } catch (error) {
    console.error('Clone error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.response ? `Failed to fetch website: ${error.message}` : `An error occurred: ${error.message}`
      })
    };
  }
};

// Helper function to inline CSS
async function inlineCSS($, baseURL) {
  const links = $('link[rel="stylesheet"]');

  for (let i = 0; i < links.length; i++) {
    const link = $(links[i]);
    const href = link.attr('href');

    if (href) {
      try {
        const cssURL = new URL(href, baseURL).href;
        const cssResponse = await axios.get(cssURL, { timeout: 10000 });

        if (cssResponse.status === 200) {
          const style = `<style>${cssResponse.data}</style>`;
          link.replaceWith(style);
        }
      } catch (error) {
        console.log(`Failed to fetch CSS: ${error.message}`);
        // Keep the original link tag
      }
    }
  }
}

// Helper function to embed images as base64
async function embedImagesAsBase64($, baseURL) {
  const images = $('img');
  const imagePromises = [];

  for (let i = 0; i < images.length; i++) {
    const $img = $(images[i]);
    const src = $img.attr('src');

    if (src && !src.startsWith('data:')) {
      imagePromises.push(
        (async () => {
          try {
            const imageURL = new URL(src, baseURL).href;
            const response = await axios.get(imageURL, {
              responseType: 'arraybuffer',
              timeout: 15000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });

            const contentType = response.headers['content-type'] || 'image/png';
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            $img.attr('src', `data:${contentType};base64,${base64}`);
            $img.removeAttr('srcset'); // Remove srcset to avoid conflicts
          } catch (error) {
            console.log(`Failed to embed image ${src}: ${error.message}`);
            // Fallback to absolute URL
            try {
              const absoluteURL = new URL(src, baseURL).href;
              $img.attr('src', absoluteURL);
            } catch (e) {
              // Keep original
            }
          }
        })()
      );
    }
  }

  await Promise.all(imagePromises);
}

// Helper function to process images (fallback without embedding)
function processImages($, baseURL) {
  $('img').each((i, img) => {
    const $img = $(img);
    const src = $img.attr('src');

    if (src) {
      try {
        const absoluteURL = new URL(src, baseURL).href;
        $img.attr('src', absoluteURL);
      } catch (e) {
        // Keep original
      }
    }

    // Handle srcset attribute
    const srcset = $img.attr('srcset');
    if (srcset) {
      const newSrcset = srcset.split(',').map(item => {
        const parts = item.trim().split(/\s+/);
        if (parts.length > 0) {
          try {
            const newURL = new URL(parts[0], baseURL).href;
            return parts.length > 1 ? `${newURL} ${parts.slice(1).join(' ')}` : newURL;
          } catch (e) {
            return item;
          }
        }
        return item;
      }).join(', ');
      $img.attr('srcset', newSrcset);
    }
  });
}

// Helper function to inline scripts
async function inlineScripts($, baseURL) {
  const scripts = $('script[src]');
  const scriptPromises = [];

  for (let i = 0; i < scripts.length; i++) {
    const $script = $(scripts[i]);
    const src = $script.attr('src');

    if (src) {
      scriptPromises.push(
        (async () => {
          try {
            const scriptURL = new URL(src, baseURL).href;

            // Skip external CDN scripts if they're too large or from different domains
            const scriptHost = new URL(scriptURL).host;
            const baseHost = new URL(baseURL).host;

            // Only inline scripts from the same domain
            if (scriptHost === baseHost) {
              const response = await axios.get(scriptURL, {
                timeout: 10000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });

              if (response.status === 200 && response.data) {
                const newScript = `<script>${response.data}</script>`;
                $script.replaceWith(newScript);
                return;
              }
            }

            // Fallback to absolute URL for cross-domain scripts
            const absoluteURL = new URL(src, baseURL).href;
            $script.attr('src', absoluteURL);
          } catch (error) {
            console.log(`Failed to inline script ${src}: ${error.message}`);
            // Keep the script tag with absolute URL
            try {
              const absoluteURL = new URL(src, baseURL).href;
              $script.attr('src', absoluteURL);
            } catch (e) {
              // Keep original
            }
          }
        })()
      );
    }
  }

  await Promise.all(scriptPromises);
}

// Helper function to process scripts (fallback)
function processScripts($, baseURL) {
  $('script[src]').each((i, script) => {
    const $script = $(script);
    const src = $script.attr('src');

    if (src) {
      try {
        const absoluteURL = new URL(src, baseURL).href;
        $script.attr('src', absoluteURL);
      } catch (e) {
        // Keep original
      }
    }
  });
}

// Helper function to update all URLs
function updateURLs($, baseURL) {
  // Update anchor tags
  $('a[href]').each((i, a) => {
    const $a = $(a);
    const href = $a.attr('href');

    if (href && !href.startsWith('#')) {
      try {
        const absoluteURL = new URL(href, baseURL).href;
        $a.attr('href', absoluteURL);
      } catch (e) {
        // Keep original if URL parsing fails
      }
    }
  });

  // Update forms
  $('form[action]').each((i, form) => {
    const $form = $(form);
    const action = $form.attr('action');

    if (action) {
      try {
        const absoluteURL = new URL(action, baseURL).href;
        $form.attr('action', absoluteURL);
      } catch (e) {
        // Keep original
      }
    }
  });

  // Update iframes
  $('iframe[src]').each((i, iframe) => {
    const $iframe = $(iframe);
    const src = $iframe.attr('src');

    if (src) {
      try {
        const absoluteURL = new URL(src, baseURL).href;
        $iframe.attr('src', absoluteURL);
      } catch (e) {
        // Keep original
      }
    }
  });

  // Update video sources
  $('video').each((i, video) => {
    const $video = $(video);
    const src = $video.attr('src');

    if (src) {
      try {
        const absoluteURL = new URL(src, baseURL).href;
        $video.attr('src', absoluteURL);
      } catch (e) {
        // Keep original
      }
    }

    $video.find('source[src]').each((j, source) => {
      const $source = $(source);
      const srcAttr = $source.attr('src');

      if (srcAttr) {
        try {
          const absoluteURL = new URL(srcAttr, baseURL).href;
          $source.attr('src', absoluteURL);
        } catch (e) {
          // Keep original
        }
      }
    });
  });

  // Update audio sources
  $('audio').each((i, audio) => {
    const $audio = $(audio);
    const src = $audio.attr('src');

    if (src) {
      try {
        const absoluteURL = new URL(src, baseURL).href;
        $audio.attr('src', absoluteURL);
      } catch (e) {
        // Keep original
      }
    }

    $audio.find('source[src]').each((j, source) => {
      const $source = $(source);
      const srcAttr = $source.attr('src');

      if (srcAttr) {
        try {
          const absoluteURL = new URL(srcAttr, baseURL).href;
          $source.attr('src', absoluteURL);
        } catch (e) {
          // Keep original
        }
      }
    });
  });

  // Update link tags (non-stylesheet)
  $('link[href]:not([rel="stylesheet"])').each((i, link) => {
    const $link = $(link);
    const href = $link.attr('href');

    if (href) {
      try {
        const absoluteURL = new URL(href, baseURL).href;
        $link.attr('href', absoluteURL);
      } catch (e) {
        // Keep original
      }
    }
  });
}
