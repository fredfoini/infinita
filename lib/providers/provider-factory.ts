import {
  GeminiProvider, GroqProvider, NarrativeProviderError, OpenAIProvider,
  type NarrativeProvider, type NarrativeProviderId, type NarrativeRequest, type NarrativeUsage,
} from '@/lib/providers/narrative-provider';

type Circuit = { failures: number; unavailableUntil: number; lastReason?: string };
type FailoverRecord = { provider: NarrativeProviderId; reason: string };
export type ProviderFactoryResult<T> = { data: T; provider: NarrativeProviderId; usage?: NarrativeUsage; failovers: FailoverRecord[] };

const circuits = new Map<NarrativeProviderId, Circuit>();
const timeoutMs = Math.max(3000, Number(process.env.NARRATIVE_PROVIDER_TIMEOUT_MS) || 18000);
const circuitCooldownMs = Math.max(10000, Number(process.env.NARRATIVE_CIRCUIT_COOLDOWN_MS) || 120000);

function providers(): NarrativeProvider[] { return [new GroqProvider(), new GeminiProvider(), new OpenAIProvider()]; }
function stateFor(id: NarrativeProviderId) { return circuits.get(id) || { failures: 0, unavailableUntil: 0 }; }
function unavailableReason(error: unknown) {
  if (error instanceof NarrativeProviderError) return error.code || `http_${error.status || 'unknown'}`;
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout';
  return error instanceof Error ? error.message.slice(0, 180) : 'unknown_failure';
}
function shouldOpenCircuit(error: unknown, failures: number) {
  if (error instanceof NarrativeProviderError && ['quota_or_rate_limit', 'authentication'].includes(error.code || '')) return true;
  return failures >= 2;
}

export class ProviderFactory {
  static async generateJson<T>(request: NarrativeRequest): Promise<ProviderFactoryResult<T> | null> {
    const failovers: FailoverRecord[] = [];
    for (const provider of providers()) {
      if (!provider.isConfigured()) {
        failovers.push({ provider: provider.id, reason: 'not_configured' });
        continue;
      }
      const circuit = stateFor(provider.id);
      if (circuit.unavailableUntil > Date.now()) {
        failovers.push({ provider: provider.id, reason: `circuit_open:${circuit.lastReason || 'unavailable'}` });
        continue;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const started = Date.now();
      try {
        const result = await provider.generateJson<T>(request, controller.signal);
        circuits.set(provider.id, { failures: 0, unavailableUntil: 0 });
        console.info('INFINITA_LLM_SUCCESS', { provider: provider.id, model: provider.model, responseMs: Date.now() - started, usage: result.usage, failovers });
        return { ...result, provider: provider.id, failovers };
      } catch (error) {
        const reason = unavailableReason(error);
        const failures = circuit.failures + 1;
        circuits.set(provider.id, { failures, unavailableUntil: shouldOpenCircuit(error, failures) ? Date.now() + circuitCooldownMs : 0, lastReason: reason });
        failovers.push({ provider: provider.id, reason });
        console.warn('INFINITA_LLM_FAILOVER', { provider: provider.id, model: provider.model, responseMs: Date.now() - started, reason, failures });
      } finally { clearTimeout(timer); }
    }
    return null;
  }

  static diagnostics() {
    return providers().map(provider => ({ provider: provider.id, model: provider.model, configured: provider.isConfigured(), circuit: stateFor(provider.id) }));
  }
}
