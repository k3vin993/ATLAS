/**
 * ATLAS LLM Client — provider abstraction for AI entity extraction.
 * Supports Claude (Anthropic) and OpenAI-compatible APIs (OpenAI, Ollama, Azure, LMStudio, vLLM).
 * SDKs are lazy-loaded — zero startup cost if AI features are not configured.
 */

import { resolveEnv } from '../mapper.js';

let _anthropic = null;
let _openai = null;

export class LlmClient {
  constructor(config = {}) {
    this.provider = config.provider ?? 'claude';
    this.model = config.model ?? (this.provider === 'claude' ? 'claude-sonnet-4-20250514' : 'gpt-4o');
    this.apiKey = resolveEnv(config.api_key ?? '');
    this.baseUrl = config.base_url ? resolveEnv(config.base_url) : undefined;
    this.maxTokens = config.max_tokens ?? 4096;
  }

  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Send a completion request to the configured LLM provider.
   * @param {string} system - System prompt
   * @param {string} user - User message (file content)
   * @returns {Promise<{text: string, usage: {input_tokens: number, output_tokens: number}}>}
   */
  async complete(system, user) {
    if (!this.isConfigured()) {
      throw new Error('AI not configured — set ai.api_key in config.yml or ANTHROPIC_API_KEY / OPENAI_API_KEY env var');
    }

    if (this.provider === 'claude') {
      return this._completeClaude(system, user);
    }
    return this._completeOpenAI(system, user);
  }

  async _completeClaude(system, user) {
    if (!_anthropic) {
      const mod = await import('@anthropic-ai/sdk');
      _anthropic = mod.default ?? mod.Anthropic;
    }
    const client = new _anthropic({ apiKey: this.apiKey });
    const res = await client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return {
      text: res.content.map(c => c.text ?? '').join(''),
      usage: {
        input_tokens: res.usage?.input_tokens ?? 0,
        output_tokens: res.usage?.output_tokens ?? 0,
      },
    };
  }

  async _completeOpenAI(system, user) {
    if (!_openai) {
      const mod = await import('openai');
      _openai = mod.default ?? mod.OpenAI;
    }
    const opts = { apiKey: this.apiKey };
    if (this.baseUrl) opts.baseURL = this.baseUrl;
    const client = new _openai(opts);
    const res = await client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const choice = res.choices?.[0];
    return {
      text: choice?.message?.content ?? '',
      usage: {
        input_tokens: res.usage?.prompt_tokens ?? 0,
        output_tokens: res.usage?.completion_tokens ?? 0,
      },
    };
  }
}
