# PageLock

A powerful website cloning tool that allows you to download and save any website for offline viewing. Clone single pages or entire websites with all their assets (HTML, CSS, JavaScript, images).

## Features

- **Single Page Clone** - Download any webpage as a standalone HTML file
- **Full Website Clone** - Clone entire websites with multiple pages as ZIP archives
- **Cloudflare Bypass** - Automatically bypasses Cloudflare protection using cloudscraper
- **Asset Download** - Downloads ALL assets including:
  - CSS stylesheets
  - JavaScript files
  - Images (JPG, PNG, GIF, SVG, WebP)
  - Fonts
  - Other resources
- **Offline Ready** - Cloned websites work completely offline
- **Dark Theme UI** - Modern dark interface with orange accents
- **Configurable Crawling** - Control max pages and crawl depth
- **Fast Performance** - Optimized for speed with parallel downloads

## Technology Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Axios** - HTTP client

### Backend
- **Netlify Functions** - Serverless functions
- **Node.js** - Runtime
- **Cheerio** - HTML parsing
- **Cloudscraper** - Cloudflare bypass
- **Archiver** - ZIP file creation

## Installation

### Prerequisites
- Node.js 18+ and npm
- Git

### Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd PageLock
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to the URL shown in the terminal (usually http://localhost:8888)

## Usage

### Single Page Clone

1. Enter the website URL you want to clone
2. Select **"Single Page"** mode
3. Click **"Clone Website"**
4. Download the generated HTML file
5. Open the file in your browser - it works offline!

### Full Website Clone

1. Enter the website URL
2. Select **"Full Website"** mode
3. Configure options:
   - **Max Pages**: Maximum number of pages to download (1-50)
   - **Max Depth**: How deep to crawl from the starting page (1-5)
4. Click **"Clone Website"**
5. Download the ZIP file
6. Extract and open `index.html` in your browser

### Advanced Settings

- **Max Pages**: Controls how many pages to download
  - Useful for limiting the size of large websites
  - Default: 15 pages

- **Max Depth**: Controls crawl depth
  - Depth 1: Only the starting page
  - Depth 2: Starting page + all linked pages
  - Depth 3: Starting page + linked pages + pages they link to
  - Default: 2 levels

## Project Structure

```
PageLock/
├── netlify/
│   └── functions/
│       ├── clone-website.cjs          # Single page cloner
│       ├── clone-full-website.cjs     # Multi-page cloner
│       └── cloudflare-helper.cjs      # Cloudflare bypass helper
├── src/
│   ├── App.jsx                        # Main React component
│   ├── main.jsx                       # React entry point
│   └── index.css                      # Global styles
├── public/                            # Static assets
├── dist/                              # Build output
├── netlify.toml                       # Netlify configuration
├── package.json                       # Dependencies
├── vite.config.js                     # Vite configuration
├── tailwind.config.js                 # Tailwind configuration
└── README.md                          # This file
```

## Development

### Available Scripts

- `npm run dev` - Start development server with Netlify Dev
- `npm run dev:vite` - Start Vite dev server only
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Build for Production

```bash
npm run build
```

This creates an optimized build in the `dist/` directory.

## Deployment

### Netlify Deployment

1. Push your code to GitHub
2. Go to [Netlify](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your GitHub repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
6. Click "Deploy site"

Your site will be live at `https://your-site-name.netlify.app`

## How It Works

### Single Page Cloning

1. Fetches the target webpage using cloudscraper (bypasses Cloudflare)
2. Parses HTML with Cheerio
3. Embeds images as base64 data URLs
4. Inlines external CSS stylesheets
5. Converts all URLs to absolute paths
6. Returns a standalone HTML file

### Full Website Cloning

1. **Crawling**: Starts at the target URL and discovers all internal links
2. **Asset Collection**: Downloads each page and collects:
   - All CSS files
   - All JavaScript files
   - All images
   - Other assets
3. **Processing**: Updates all internal links to work offline
4. **Packaging**: Creates a ZIP archive with all files organized by path
5. **Download**: Sends the ZIP to the user

### Cloudflare Bypass

Uses the `cloudscraper` library which:
- Solves JavaScript challenges automatically
- Handles cookie-based protection
- Mimics real browser behavior
- Falls back to regular requests if bypass isn't needed

## Limitations

- **Single Page Applications (SPAs)**: Sites built with React/Vue/Angular may not have HTML links to crawl. Use single page mode for these.
- **Dynamic Content**: JavaScript-generated content may not be fully captured
- **Authentication**: Cannot clone pages behind login walls
- **Rate Limiting**: Some sites may block rapid requests
- **Large Sites**: Very large websites may timeout (30 second limit)

## Troubleshooting

### Clone Failed / Timeout Error

- Try reducing "Max Pages" setting
- Try reducing "Max Depth" to 1
- Some websites have protection that can't be bypassed

### No Images in Cloned Site

- Check if images are loaded via JavaScript
- Try using "Single Page" mode instead

### CORS Errors

- This is normal for some external resources
- The main site content should still work

## SEO & Branding

### SEO Optimization

PageLock includes comprehensive SEO optimization:

- **Meta Tags**: Title, description, keywords for search engines
- **Open Graph**: Facebook and social media sharing optimization
- **Twitter Cards**: Twitter-specific metadata
- **Robots.txt**: Search engine crawling instructions
- **Sitemap.xml**: XML sitemap for better indexing
- **Canonical URLs**: Prevent duplicate content issues
- **Semantic HTML**: Proper heading structure and ARIA labels

### Favicon & Icons

The project includes a custom favicon with PageLock branding (orange lock with page icon):

- **SVG Favicon**: Modern browsers (scalable, small file size)
- **PNG Favicons**: Legacy browser support (16x16, 32x32)
- **Apple Touch Icon**: iOS devices (180x180)
- **Android Chrome Icons**: PWA support (192x192, 512x512)
- **PWA Manifest**: Progressive Web App configuration

To generate PNG versions of the favicon, see `public/FAVICON_INSTRUCTIONS.md`

### Customizing Branding

To customize the branding:

1. **Change Colors**: Update `tailwind.config.js` and `theme-color` meta tag
2. **Update Favicon**: Replace `public/favicon.svg` and regenerate PNGs
3. **Modify SEO**: Edit meta tags in `index.html`
4. **Update Manifest**: Edit `public/manifest.json`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- Built with React and Vite
- Powered by Netlify Functions
- Cloudflare bypass using cloudscraper
- HTML parsing with Cheerio

## Support

For issues or questions, please open an issue on GitHub.

---

Made with ❤️ by Tboye
