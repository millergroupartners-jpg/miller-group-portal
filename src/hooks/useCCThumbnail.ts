import { useState, useEffect } from 'react';
import { getCCThumbForAddress } from '../services/companyCamApi';

/** Returns the CompanyCam feature thumbnail URL for a property address, or null while loading */
export function useCCThumbnail(address: string | undefined): string | null {
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    getCCThumbForAddress(address).then(url => {
      if (url) setThumb(url);
    });
  }, [address]);

  return thumb;
}
