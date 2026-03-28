// Entry point for the TS cluster in the mixed-project fixture
import { clamp, slugify } from './helpers';

export interface AppConfig {
  readonly maxItems: number;
  readonly title: string;
}

export function processConfig(config: AppConfig): AppConfig {
  return {
    maxItems: clamp(config.maxItems, 1, 100),
    title: slugify(config.title),
  };
}
