import { readFileSync } from 'fs';

const MAX_RETRIES = 3;

export function fetchData(url) {
  if (!url) {
    throw new Error('URL is required');
  }
  return { url, retries: MAX_RETRIES };
}

export class DataService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  getData(path) {
    return fetchData(`${this.baseUrl}${path}`);
  }
}

export default DataService;
