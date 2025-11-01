import json
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import re

def handler(event, context):
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    }

    # Handle preflight request
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }

    try:
        # Parse request body
        body = json.loads(event['body'])
        url = body.get('url', '').strip()

        if not url:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'URL is required'})
            }

        # Validate URL
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        # Fetch the website
        response = requests.get(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout=30,
            allow_redirects=True
        )
        response.raise_for_status()

        # Parse HTML
        soup = BeautifulSoup(response.content, 'html.parser')

        # Get page title
        title = soup.title.string if soup.title else 'Cloned Website'

        # Process and inline CSS
        inline_css(soup, url)

        # Process images - convert to base64 or update URLs
        process_images(soup, url)

        # Process scripts
        process_scripts(soup, url)

        # Update all relative URLs to absolute
        update_urls(soup, url)

        # Get the processed HTML
        cloned_html = str(soup)

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'html': cloned_html,
                'title': title,
                'size': len(cloned_html),
                'url': url
            })
        }

    except requests.exceptions.RequestException as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': f'Failed to fetch website: {str(e)}'
            })
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': f'An error occurred: {str(e)}'
            })
        }


def inline_css(soup, base_url):
    """Fetch and inline external CSS files"""
    for link in soup.find_all('link', rel='stylesheet'):
        href = link.get('href')
        if href:
            try:
                css_url = urljoin(base_url, href)
                css_response = requests.get(css_url, timeout=10)
                if css_response.status_code == 200:
                    # Create a new style tag with the CSS content
                    style_tag = soup.new_tag('style')
                    style_tag.string = css_response.text
                    link.replace_with(style_tag)
            except Exception as e:
                print(f"Failed to fetch CSS: {e}")
                # Keep the original link tag


def process_images(soup, base_url):
    """Update image URLs to absolute URLs"""
    for img in soup.find_all('img'):
        src = img.get('src')
        if src:
            absolute_url = urljoin(base_url, src)
            img['src'] = absolute_url

        # Handle srcset attribute
        srcset = img.get('srcset')
        if srcset:
            new_srcset = []
            for item in srcset.split(','):
                parts = item.strip().split()
                if parts:
                    new_url = urljoin(base_url, parts[0])
                    new_srcset.append(f"{new_url} {' '.join(parts[1:])}" if len(parts) > 1 else new_url)
            img['srcset'] = ', '.join(new_srcset)


def process_scripts(soup, base_url):
    """Update script URLs to absolute URLs"""
    for script in soup.find_all('script'):
        src = script.get('src')
        if src:
            absolute_url = urljoin(base_url, src)
            script['src'] = absolute_url


def update_urls(soup, base_url):
    """Update all relative URLs to absolute URLs"""
    # Update anchor tags
    for a in soup.find_all('a', href=True):
        a['href'] = urljoin(base_url, a['href'])

    # Update forms
    for form in soup.find_all('form', action=True):
        form['action'] = urljoin(base_url, form['action'])

    # Update iframes
    for iframe in soup.find_all('iframe', src=True):
        iframe['src'] = urljoin(base_url, iframe['src'])

    # Update video sources
    for video in soup.find_all('video'):
        if video.get('src'):
            video['src'] = urljoin(base_url, video['src'])
        for source in video.find_all('source'):
            if source.get('src'):
                source['src'] = urljoin(base_url, source['src'])

    # Update audio sources
    for audio in soup.find_all('audio'):
        if audio.get('src'):
            audio['src'] = urljoin(base_url, audio['src'])
        for source in audio.find_all('source'):
            if source.get('src'):
                source['src'] = urljoin(base_url, source['src'])
