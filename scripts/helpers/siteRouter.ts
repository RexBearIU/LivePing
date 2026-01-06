import { defaultHelper, SiteHelper } from './common';
import { tixcraftHelper } from './tixcraft';

export function getHelperForUrl(targetUrl: string): SiteHelper {
  const normalized = targetUrl.toLowerCase();
  if (normalized.includes('tixcraft')) {
    return tixcraftHelper;
  }
  return defaultHelper;
}
