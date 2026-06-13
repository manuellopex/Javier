import type { LLMProvider } from './provider';
import { anthropicProvider } from './anthropic';

/**
 * Provider registry. Set LLM_PROVIDER to switch (default: anthropic).
 * To add a provider: implement LLMProvider in lib/ai/<name>.ts and
 * register it here.
 */
const providers: Record<string, LLMProvider> = {
  anthropic: anthropicProvider,
};

export function getLLM(): LLMProvider {
  const name = process.env.LLM_PROVIDER || 'anthropic';
  const provider = providers[name];
  if (!provider) {
    throw new Error(
      `Unknown LLM_PROVIDER "${name}". Available: ${Object.keys(providers).join(', ')}`
    );
  }
  return provider;
}

export * from './provider';
