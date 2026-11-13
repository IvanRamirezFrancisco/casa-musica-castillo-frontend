import { environment as production } from './environment.prod';

declare const CMC_STAGING_API_ORIGIN: string;

const staging = new URL(CMC_STAGING_API_ORIGIN);
if (staging.protocol !== 'https:' || staging.username || staging.password ||
    staging.pathname !== '/' || staging.search || staging.hash ||
    staging.hostname === new URL(production.apiUrl).hostname) {
  throw new Error('La web de staging requiere un origen HTTPS aislado.');
}

export const environment = { ...production, apiUrl: staging.origin + '/api' };
