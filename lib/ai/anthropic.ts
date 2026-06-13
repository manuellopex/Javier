import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMContentBlock,
  LLMMessage,
  LLMProvider,
  LLMStreamCallbacks,
  LLMToolDefinition,
  LLMTurnResult,
} from './provider';

const DEFAULT_MODEL = 'claude-opus-4-8';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Add it to your environment.');
  }
  return new Anthropic({ apiKey });
}

function model(): string {
  return process.env.AURA_MODEL || DEFAULT_MODEL;
}

function toAnthropicMessages(messages: LLMMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === 'string'
        ? m.content
        : (m.content.map((block) => {
            if (block.type === 'text') return { type: 'text' as const, text: block.text };
            if (block.type === 'tool_use')
              return {
                type: 'tool_use' as const,
                id: block.id,
                name: block.name,
                input: block.input,
              };
            return {
              type: 'tool_result' as const,
              tool_use_id: block.tool_use_id,
              content: block.content,
              is_error: block.is_error,
            };
          }) as Anthropic.ContentBlockParam[]),
  }));
}

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  async streamTurn({
    system,
    messages,
    tools,
    maxTokens = 4096,
    callbacks,
  }: {
    system: string;
    messages: LLMMessage[];
    tools: LLMToolDefinition[];
    maxTokens?: number;
    callbacks: LLMStreamCallbacks;
  }): Promise<LLMTurnResult> {
    const client = getClient();

    const stream = client.messages.stream({
      model: model(),
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool.InputSchema,
      })),
      messages: toAnthropicMessages(messages),
    });

    stream.on('text', (delta) => callbacks.onTextDelta(delta));

    const final = await stream.finalMessage();

    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const toolUses = final.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

    // Echo back only blocks our abstraction understands; thinking blocks from
    // the same model would need verbatim replay, so we keep tool loops on
    // text + tool_use content (sufficient for AURA's short tool chains).
    const assistantContent: LLMContentBlock[] = final.content.flatMap(
      (b): LLMContentBlock[] => {
        if (b.type === 'text') return [{ type: 'text', text: b.text }];
        if (b.type === 'tool_use')
          return [
            { type: 'tool_use', id: b.id, name: b.name, input: b.input as Record<string, unknown> },
          ];
        return [];
      }
    );

    const stopReason: LLMTurnResult['stopReason'] =
      final.stop_reason === 'tool_use'
        ? 'tool_use'
        : final.stop_reason === 'end_turn'
          ? 'end_turn'
          : final.stop_reason === 'max_tokens'
            ? 'max_tokens'
            : 'other';

    return { stopReason, text, toolUses, assistantContent };
  },

  async complete({
    system,
    prompt,
    maxTokens = 1024,
  }: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string> {
    const client = getClient();
    const response = await client.messages.create({
      model: model(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
  },
};
