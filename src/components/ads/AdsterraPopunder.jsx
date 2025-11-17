import { useEffect } from 'react';

/**
 * Adsterra Pop-Under Ad Component
 *
 * This component loads a pop-under ad from Adsterra.
 * Pop-unders open in a new window/tab in the background when user interacts with the page.
 *
 * Setup Instructions:
 * 1. Login to your Adsterra dashboard: https://publishers.adsterra.com/
 * 2. Create a new "Pop-Under" zone
 * 3. Copy the zone ID from your Adsterra dashboard
 * 4. Replace 'YOUR_POPUNDER_ZONE_ID' below with your actual zone ID
 *
 * Example zone ID: 4815162342
 *
 * Note: Pop-unders are typically shown once per user per 24 hours
 * to maintain good user experience.
 */
export function AdsterraPopunder() {
  useEffect(() => {
    // Configuration options for the pop-under ad
    const atOptions = {
      'key': 'YOUR_POPUNDER_ZONE_ID', // Replace with your actual Adsterra pop-under zone ID
      'format': 'iframe',
      'height': 60,
      'width': 468,
      'params': {}
    };

    // Create and inject the configuration script
    const configScript = document.createElement('script');
    configScript.type = 'text/javascript';
    configScript.innerHTML = `atOptions = ${JSON.stringify(atOptions)};`;
    document.body.appendChild(configScript);

    // Create and inject the invocation script
    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = `//www.topcreativeformat.com/${atOptions.key}/invoke.js`;
    invokeScript.async = true;
    document.body.appendChild(invokeScript);

    // Cleanup function to remove scripts when component unmounts
    return () => {
      if (configScript.parentNode) {
        configScript.parentNode.removeChild(configScript);
      }
      if (invokeScript.parentNode) {
        invokeScript.parentNode.removeChild(invokeScript);
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // This component doesn't render any visible elements
  return null;
}

export default AdsterraPopunder;
