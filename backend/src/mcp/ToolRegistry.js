import { getMcpClientManager } from './McpClientManager.js';

function normalizeInputSchema(schema) {
  const normalizedSchema = schema && typeof schema === 'object' ? structuredClone(schema) : {};

  if (!normalizedSchema.type) normalizedSchema.type = 'object';
  if (!normalizedSchema.properties) normalizedSchema.properties = {};
  if (!Array.isArray(normalizedSchema.required)) normalizedSchema.required = [];

  return normalizedSchema;
}

export class ToolRegistry {
  constructor(clientManager = getMcpClientManager()) {
    this.clientManager = clientManager;
    this.toolMap = new Map();
    this.lastRefresh = null;
    this.lastFailures = [];
  }

  namespaceToolName(serverName, toolName) {
    return `${serverName}__${toolName}`;
  }

  async refresh() {
    const serverConfigs = await this.clientManager.getEnabledServerConfigs();
    const tools = [];
    const failures = [];

    this.toolMap.clear();

    for (const serverConfig of serverConfigs) {
      try {
        const client = await this.clientManager.ensureClient(serverConfig.name);
        const result = await client.listTools();

        for (const tool of result.tools) {
          const namespacedName = this.namespaceToolName(serverConfig.name, tool.name);
          const entry = {
            serverName: serverConfig.name,
            originalName: tool.name,
            namespacedName,
            description: tool.description || `${tool.name} from ${serverConfig.name}`,
            inputSchema: normalizeInputSchema(tool.inputSchema),
            outputSchema: tool.outputSchema || null,
            annotations: tool.annotations || {},
          };

          this.toolMap.set(namespacedName, entry);
          tools.push(entry);
        }
      } catch (error) {
        failures.push({
          serverName: serverConfig.name,
          error: error.message,
        });
      }
    }

    this.lastRefresh = new Date().toISOString();
    this.lastFailures = failures;

    return {
      tools,
      failures,
      openAiTools: tools.map(tool => this.toOpenAiTool(tool)),
    };
  }

  async getOpenAiTools() {
    const { openAiTools } = await this.refresh();
    return openAiTools;
  }

  getTool(namespacedName) {
    return this.toolMap.get(namespacedName);
  }

  async getToolOrRefresh(namespacedName) {
    if (this.toolMap.has(namespacedName)) {
      return this.toolMap.get(namespacedName);
    }

    await this.refresh();
    return this.toolMap.get(namespacedName);
  }

  toOpenAiTool(tool) {
    return {
      type: 'function',
      function: {
        name: tool.namespacedName,
        description: `${tool.description} (via ${tool.serverName})`,
        parameters: normalizeInputSchema(tool.inputSchema),
      },
    };
  }
}

let toolRegistry;

export function getToolRegistry() {
  if (!toolRegistry) {
    toolRegistry = new ToolRegistry();
  }

  return toolRegistry;
}
