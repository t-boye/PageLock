import { useState } from 'react'
import axios from 'axios'

function App() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [cloneMode, setCloneMode] = useState('single') // 'single' or 'full'
  const [maxPages, setMaxPages] = useState(15)
  const [maxDepth, setMaxDepth] = useState(2)

  const handleClone = async (e) => {
    e.preventDefault()

    if (!url.trim()) {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setDownloadUrl(null)

    try {
      if (cloneMode === 'single') {
        // Single page clone
        const response = await axios.post('/.netlify/functions/clone-website', {
          url: url.trim(),
          embedImages: true
        })

        setResult(response.data)

        // Create a blob and download URL for the cloned content
        if (response.data.html) {
          const blob = new Blob([response.data.html], { type: 'text/html' })
          const blobUrl = window.URL.createObjectURL(blob)
          setDownloadUrl(blobUrl)
        }
      } else {
        // Full website clone
        const response = await axios.post('/.netlify/functions/clone-full-website', {
          url: url.trim(),
          maxPages: maxPages,
          maxDepth: maxDepth
        }, {
          responseType: 'blob',
          timeout: 120000 // 2 minutes timeout for full website
        })

        // Create download URL for ZIP file
        const blobUrl = window.URL.createObjectURL(response.data)
        setDownloadUrl(blobUrl)

        const urlObj = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`)
        setResult({
          success: true,
          title: urlObj.host,
          isZip: true,
          fileName: `${urlObj.host}.zip`
        })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clone website. Please try again.')
      console.error('Clone error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (downloadUrl && result) {
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = result.isZip ? result.fileName : 'cloned-website.html'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-orange-500 mb-4 drop-shadow-lg">
            PageLock
          </h1>
          <p className="text-xl text-gray-300">
            Clone any website with a single click
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-3xl mx-auto bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleClone} className="space-y-6">
            {/* Input Section */}
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-orange-400 mb-2">
                Website URL
              </label>
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition text-gray-200 placeholder-gray-500"
                disabled={loading}
              />
              <p className="mt-2 text-sm text-gray-400">
                Enter the full URL of the website you want to clone
              </p>
            </div>

            {/* Clone Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-orange-400 mb-3">
                Clone Mode
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setCloneMode('single')}
                  className={`p-4 border-2 rounded-lg transition ${
                    cloneMode === 'single'
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-600 hover:border-gray-500 bg-gray-900'
                  }`}
                  disabled={loading}
                >
                  <div className="flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-200">Single Page</h3>
                  <p className="text-xs text-gray-400 mt-1">Clone one page as HTML</p>
                </button>

                <button
                  type="button"
                  onClick={() => setCloneMode('full')}
                  className={`p-4 border-2 rounded-lg transition ${
                    cloneMode === 'full'
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-600 hover:border-gray-500 bg-gray-900'
                  }`}
                  disabled={loading}
                >
                  <div className="flex items-center justify-center mb-2">
                    <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-medium text-gray-200">Full Website</h3>
                  <p className="text-xs text-gray-400 mt-1">Clone all pages as ZIP</p>
                </button>
              </div>
            </div>

            {/* Advanced Options for Full Website Clone */}
            {cloneMode === 'full' && (
              <div className="bg-gray-900 border border-gray-700 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-medium text-orange-400">Advanced Options</h3>

                <div>
                  <label htmlFor="maxPages" className="block text-sm text-gray-300 mb-1">
                    Max Pages: <span className="text-orange-500 font-semibold">{maxPages}</span>
                  </label>
                  <input
                    type="range"
                    id="maxPages"
                    min="5"
                    max="50"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    className="w-full accent-orange-500"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-400 mt-1">Maximum number of pages to clone</p>
                </div>

                <div>
                  <label htmlFor="maxDepth" className="block text-sm text-gray-300 mb-1">
                    Max Depth: <span className="text-orange-500 font-semibold">{maxDepth}</span>
                  </label>
                  <input
                    type="range"
                    id="maxDepth"
                    min="1"
                    max="5"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="w-full accent-orange-500"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-400 mt-1">How deep to follow links (1 = homepage only)</p>
                </div>
              </div>
            )}

            {/* Clone Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-6 rounded-lg font-medium text-white transition ${
                loading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-95 shadow-lg hover:shadow-orange-500/50'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {cloneMode === 'full' ? 'Cloning Full Website...' : 'Cloning Page...'}
                </span>
              ) : (
                cloneMode === 'full' ? 'Clone Full Website' : 'Clone Single Page'
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="ml-3 text-sm text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Success Result */}
          {result && (
            <div className="mt-6 p-6 bg-green-900/20 border border-green-500 rounded-lg">
              <div className="flex items-start mb-4">
                <svg className="w-6 h-6 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-green-300">Clone Successful!</h3>
                  <p className="mt-1 text-sm text-green-400">
                    {result.isZip
                      ? 'Full website cloned successfully. Download the ZIP file to extract all pages and assets.'
                      : 'Website cloned successfully. You can now download the HTML file.'}
                  </p>
                </div>
              </div>

              {/* Clone Details */}
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">{result.isZip ? 'Website:' : 'Title:'}</span>
                  <span className="font-medium text-gray-200">{result.title || 'N/A'}</span>
                </div>
                {!result.isZip && result.size && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Size:</span>
                    <span className="font-medium text-gray-200">
                      {(result.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                )}
                {result.isZip && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Format:</span>
                    <span className="font-medium text-gray-200">ZIP Archive</span>
                  </div>
                )}
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-medium transition active:scale-95 flex items-center justify-center shadow-lg hover:shadow-green-500/50"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {result.isZip ? 'Download ZIP File' : 'Download HTML File'}
              </button>
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="max-w-5xl mx-auto mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500 transition">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Fast Cloning</h3>
            <p className="text-gray-400">Clone websites in seconds with our optimized parallel processing</p>
          </div>

          <div className="text-center bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500 transition">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Secure</h3>
            <p className="text-gray-400">Your data is processed securely and never stored on our servers</p>
          </div>

          <div className="text-center bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500 transition">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-200 mb-2">Complete Download</h3>
            <p className="text-gray-400">Download entire websites as ZIP archives with all assets included</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
