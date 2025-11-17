import { useEffect } from 'react';

/**
 * Adsterra Banner Ad Component
 *
 * This component loads a display banner ad from Adsterra.
 * Can be placed anywhere in your layout (sidebar, between content, etc.)
 *
 * Setup Instructions:
 * 1. Login to your Adsterra dashboard: https://publishers.adsterra.com/
 * 2. Get your banner ad code
 * 3. Extract the key from the URL
 * 4. Update the config below with your key and other details
 *
 * Current Configuration:
 * - Key: e4c1e62156bc93596cac3aeeb7063931
 * - Format: iframe
 * - Height: 250px
 * - Width: 300px
 */
export function AdsterraBanner() {
  useEffect(() => {
    // Configuration options for the banner ad
    const atOptions = {
      'key': 'e4c1e62156bc93596cac3aeeb7063931',
      'format': 'iframe',
      'height': 250,
      'width': 300,
      'params': {}
    };

    // Create and inject the configuration script
    const configScript = document.createElement('script');
    configScript.type = 'text/javascript';
    configScript.innerHTML = `atOptions = ${JSON.stringify(atOptions)};`;

    // Find the container element and append the config script
    const container = document.getElementById('adsterra-banner-container');
    if (container && !container.querySelector('script')) {
      container.appendChild(configScript);

      // Create and inject the invocation script
      const invokeScript = document.createElement('script');
      invokeScript.type = 'text/javascript';
      invokeScript.src = '//www.effectivegatecpm.com/uknwtu66/invoke.js';
      invokeScript.async = true;
      container.appendChild(invokeScript);
    }
  }, []);

  return (
    <div className="flex justify-center my-8">
      <div
        id="adsterra-banner-container"
        className="min-h-[250px] min-w-[300px] flex items-center justify-center bg-gray-800/50 rounded-lg border border-gray-700"
      >
        {/* Ad will be injected here */}
      </div>
    </div>
  );
}

export default AdsterraBanner;
