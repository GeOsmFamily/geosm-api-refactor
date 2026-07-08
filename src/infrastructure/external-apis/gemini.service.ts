import { trace } from '@opentelemetry/api';
import { config } from '../../config/env.config.js';
import { geminiCallsTotal, geminiCallDurationSeconds } from '../observability/metrics.js';

const tracer = trace.getTracer('geosm-gemini');

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiMessage {
  role: 'user' | 'model';
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiGenerateResult {
  text: string | null;
  functionCalls: GeminiFunctionCall[];
}

interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GeminiApiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

/**
 * Client HTTP minimal pour l'API Google Gemini (pas de SDK - meme pattern que
 * OSRMService/NominatimService : fetch direct, erreurs explicites). GEMINI_API_KEY est
 * optionnelle (voir env.config.ts) : ensureConfigured() echoue proprement a l'appel plutot
 * que de faire planter le demarrage du serveur quand la cle est absente.
 */
export class GeminiService {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = config.GEMINI_API_KEY;
    this.model = config.GEMINI_MODEL;
  }

  private ensureConfigured(): void {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY non configurée : fonctionnalité IA indisponible.');
    }
  }

  /** Génération de texte simple (résumés, rédaction) - pas de tool-calling. */
  async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    this.ensureConfigured();
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const result = await this.callGenerateContent('generateText', body);
    return this.extractText(result) ?? '';
  }

  /**
   * Génération avec function-calling (assistant agentique) : `tools` déclare les fonctions
   * que Gemini peut choisir d'appeler, `messages` est l'historique de conversation (incluant
   * d'éventuelles functionResponse pour boucler le résultat d'un appel précédent).
   */
  async generateWithTools(
    messages: GeminiMessage[],
    tools: GeminiFunctionDeclaration[],
    systemInstruction?: string,
  ): Promise<GeminiGenerateResult> {
    this.ensureConfigured();
    const body: Record<string, unknown> = {
      contents: messages.map((m) => this.toContent(m)),
      tools: [{ functionDeclarations: tools }],
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    const result = await this.callGenerateContent('generateWithTools', body);
    return {
      text: this.extractText(result),
      functionCalls: this.extractFunctionCalls(result),
    };
  }

  private toContent(message: GeminiMessage): { role: string; parts: GeminiPart[] } {
    if (message.functionResponse) {
      return { role: 'function', parts: [{ functionResponse: message.functionResponse }] };
    }
    if (message.functionCall) {
      return { role: 'model', parts: [{ functionCall: message.functionCall }] };
    }
    return { role: message.role, parts: [{ text: message.text ?? '' }] };
  }

  private async callGenerateContent(
    method: string,
    body: Record<string, unknown>,
  ): Promise<GeminiApiResponse> {
    return tracer.startActiveSpan(`gemini.${method}`, async (span) => {
      const end = geminiCallDurationSeconds.startTimer({ method });
      try {
        const response = await fetch(
          `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );
        if (!response.ok) {
          const errText = await response.text();
          geminiCallsTotal.inc({ method, status: 'error' });
          span.setAttribute('gemini.status_code', response.status);
          throw new Error(`Gemini API a échoué (${response.status}): ${errText}`);
        }
        geminiCallsTotal.inc({ method, status: 'success' });
        return await (response.json() as Promise<GeminiApiResponse>);
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        throw error;
      } finally {
        end();
        span.end();
      }
    });
  }

  private extractText(result: GeminiApiResponse): string | null {
    const parts = result.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find((p) => typeof p.text === 'string');
    return textPart?.text ?? null;
  }

  private extractFunctionCalls(result: GeminiApiResponse): GeminiFunctionCall[] {
    const parts = result.candidates?.[0]?.content?.parts ?? [];
    return parts
      .filter((p): p is GeminiPart & { functionCall: GeminiFunctionCall } => !!p.functionCall)
      .map((p) => p.functionCall);
  }
}
