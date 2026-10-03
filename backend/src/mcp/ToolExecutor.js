import { config } from '../config/env.js';
import { McpToolExecutionError, httpError } from '../middleware/errorHandler.js';

import { getMcpClientManager } from './McpClientManager.js';
import { getToolRegistry } from './ToolRegistry.js';

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return { text, truncated: false };

  return {
    text: `${text.slice(0, maxChars)}\n... [truncated ${text.length - maxChars} characters]`,
    truncated: true,
  };
}

function contentBlockToText(block) {
  if (!block || typeof block !== 'object') return '';

  if (block.type === 'text') return block.text;
  if (block.type === 'image') return `[image:${block.mimeType}]`;
  if (block.type === 'audio') return `[audio:${block.mimeType}]`;
  if (block.type === 'resource') {
    return block.resource?.text || `[resource:${block.resource?.uri || 'unknown'}]`;
  }
  if (block.type === 'resource_link') {
    return `[resource_link:${block.uri}]`;
  }

  return JSON.stringify(block);
}

function normalizeArguments(rawArguments, toolName) {
  if (rawArguments == null || rawArguments === '') return {};
  if (typeof rawArguments === 'object') return rawArguments;

  if (typeof rawArguments === 'string') {
    try {
      const parsed = JSON.parse(rawArguments);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      throw httpError(500, `Tool arguments for ${toolName} were not valid JSON.`);
    }
  }

  throw httpError(500, `Tool arguments for ${toolName} had an unsupported type.`);
}

export class ToolExecutor {
  constructor({
    clientManager = getMcpClientManager(),
    toolRegistry = getToolRegistry(),
    timeoutMs = config.mcp.requestTimeoutMs,
    maxToolResponseChars = config.mcp.maxToolResponseChars,
  } = {}) {
    this.clientManager = clientManager;
    this.toolRegistry = toolRegistry;
    this.timeoutMs = timeoutMs;
    this.maxToolResponseChars = maxToolResponseChars;
  }

  async executeTool(namespacedToolName, rawArguments) {
    const tool = await this.toolRegistry.getToolOrRefresh(namespacedToolName);
    if (!tool) {
      throw httpError(500, `Unknown MCP tool requested: ${namespacedToolName}.`);
    }

    const parsedArguments = normalizeArguments(rawArguments, namespacedToolName);
    const client = await this.clientManager.ensureClient(tool.serverName);

    try {
      const result = await client.callTool(
        {
          name: tool.originalName,
          arguments: parsedArguments,
        },
        undefined,
        {
          timeout: this.timeoutMs,
          maxTotalTimeout: this.timeoutMs,
        },
      );

      return this.normalizeResult(tool, parsedArguments, result);
    } catch (error) {
      throw new McpToolExecutionError(
        `The MCP tool "${namespacedToolName}" failed while fetching external travel data.`,
        {
          cause: error,
          details: {
            serverName: tool.serverName,
            toolName: namespacedToolName,
            message: error.message,
          },
        },
      );
    }
  }

  normalizeResult(tool, parsedArguments, result) {
    if ('toolResult' in result) {
      const fullText = JSON.stringify(result.toolResult, null, 2);
      const truncated = truncateText(fullText, this.maxToolResponseChars);

      return {
        serverName: tool.serverName,
        toolName: tool.namespacedName,
        originalToolName: tool.originalName,
        arguments: parsedArguments,
        isError: false,
        content: truncated.text,
        truncated: truncated.truncated,
      };
    }

    const contentText = result.content.map(contentBlockToText).filter(Boolean).join('\n\n');
    const fallbackStructuredContent = result.structuredContent
      ? JSON.stringify(result.structuredContent, null, 2)
      : '';
    const fullText = contentText || fallbackStructuredContent || '{}';
    const truncated = truncateText(fullText, this.maxToolResponseChars);

    return {
      serverName: tool.serverName,
      toolName: tool.namespacedName,
      originalToolName: tool.originalName,
      arguments: parsedArguments,
      isError: Boolean(result.isError),
      content: truncated.text,
      structuredContent: result.structuredContent || null,
      truncated: truncated.truncated,
    };
  }
}

let toolExecutor;

export function getToolExecutor() {
  if (!toolExecutor) {
    toolExecutor = new ToolExecutor();
  }

  return toolExecutor;
}
