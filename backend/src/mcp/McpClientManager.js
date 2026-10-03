import { readFile } from 'node:fs/promises';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { config, getMcpServerOverride } from '../config/env.js';
import { McpConnectionError } from '../middleware/errorHandler.js';

function replaceEnvPlaceholders(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, envName) => process.env[envName] || '');
  }

  if (Array.isArray(value)) {
    return value.map(item => replaceEnvPlaceholders(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, replaceEnvPlaceholders(nestedValue)]),
    );
  }

  return value;
}

function removeEmptyValues(value) {
  if (Array.isArray(value)) {
    return value.filter(item => item !== '').map(item => removeEmptyValues(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== '')
        .map(([key, nestedValue]) => [key, removeEmptyValues(nestedValue)]),
    );
  }

  return value;
}

async function safeClose(client, transport) {
  await Promise.allSettled([
    client?.close?.(),
    transport?.close?.(),
  ]);
}

export class McpClientManager {
  constructor({
    manifestPath = config.mcp.manifestPath,
    serverConfigs,
    clientInfo = { name: config.mcp.clientName, version: config.mcp.clientVersion },
    logger = console,
  } = {}) {
    this.manifestPath = manifestPath;
    this.inlineServerConfigs = serverConfigs;
    this.clientInfo = clientInfo;
    this.logger = logger;
    this.loadedServerConfigs = null;
    this.connectionRecords = new Map();
    this.connectionPromises = new Map();
    this.serverStatuses = new Map();
  }

  async loadServerConfigs(forceReload = false) {
    if (this.loadedServerConfigs && !forceReload) {
      return this.loadedServerConfigs;
    }

    if (this.inlineServerConfigs) {
      this.loadedServerConfigs = this.inlineServerConfigs.map(serverConfig =>
        this.normalizeServerConfig(serverConfig),
      );
      return this.loadedServerConfigs;
    }

    const rawManifest = await readFile(this.manifestPath, 'utf8');
    const parsedManifest = JSON.parse(rawManifest);
    const servers = Array.isArray(parsedManifest?.servers) ? parsedManifest.servers : [];

    this.loadedServerConfigs = servers.map(serverConfig => this.normalizeServerConfig(serverConfig));
    return this.loadedServerConfigs;
  }

  async getEnabledServerConfigs() {
    const serverConfigs = await this.loadServerConfigs();
    return serverConfigs.filter(serverConfig => serverConfig.enabled !== false);
  }

  async getServerConfig(serverName) {
    const serverConfigs = await this.loadServerConfigs();
    const serverConfig = serverConfigs.find(candidate => candidate.name === serverName);

    if (!serverConfig) {
      throw new McpConnectionError(`MCP server "${serverName}" is not configured.`, {
        details: { serverName },
      });
    }

    return serverConfig;
  }

  async ensureClient(serverName) {
    const existingRecord = this.connectionRecords.get(serverName);
    if (existingRecord?.client) {
      return existingRecord.client;
    }

    const pendingConnection = this.connectionPromises.get(serverName);
    if (pendingConnection) {
      return pendingConnection;
    }

    const connectionPromise = this.connectServer(serverName).finally(() => {
      this.connectionPromises.delete(serverName);
    });

    this.connectionPromises.set(serverName, connectionPromise);
    return connectionPromise;
  }

  async connectServer(serverName) {
    const serverConfig = await this.getServerConfig(serverName);
    this.updateStatus(serverName, { state: 'connecting', lastError: null });

    try {
      const connection = serverConfig.transport === 'stdio'
        ? await this.connectStdioServer(serverConfig)
        : await this.connectRemoteServer(serverConfig);

      this.connectionRecords.set(serverName, connection);
      this.updateStatus(serverName, {
        state: 'connected',
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
        transport: connection.transportType,
      });

      return connection.client;
    } catch (error) {
      const normalizedError = this.normalizeConnectionError(serverName, error);
      this.updateStatus(serverName, {
        state: 'error',
        lastError: normalizedError.message,
        lastErrorAt: new Date().toISOString(),
      });
      throw normalizedError;
    }
  }

  async pingServer(serverName, timeout = config.mcp.requestTimeoutMs) {
    const client = await this.ensureClient(serverName);
    await client.ping({ timeout });

    this.updateStatus(serverName, {
      state: 'connected',
      lastPingAt: new Date().toISOString(),
      lastError: null,
    });
  }

  getStatusSnapshot() {
    return Object.fromEntries(this.serverStatuses.entries());
  }

  async shutdown() {
    const records = [...this.connectionRecords.entries()];

    await Promise.allSettled(
      records.map(async ([serverName, record]) => {
        await safeClose(record.client, record.transport);
        this.connectionRecords.delete(serverName);
        this.updateStatus(serverName, { state: 'closed' });
      }),
    );
  }

  normalizeServerConfig(serverConfig) {
    const resolvedConfig = replaceEnvPlaceholders(serverConfig);
    const override = getMcpServerOverride(resolvedConfig.name);
    const transport = resolvedConfig.transport;

    const normalizedConfig = removeEmptyValues({
      ...resolvedConfig,
      ...override,
      args: override.args || resolvedConfig.args || [],
      env: resolvedConfig.env || {},
      headers: resolvedConfig.headers || {},
      enabled: resolvedConfig.enabled !== false,
    });

    if (!normalizedConfig.name) {
      throw new Error('Each MCP server configuration must define a name.');
    }

    if (!['stdio', 'sse', 'streamableHttp'].includes(transport)) {
      throw new Error(`Unsupported MCP transport "${transport}" for server "${normalizedConfig.name}".`);
    }

    if (transport === 'stdio' && !normalizedConfig.command) {
      throw new Error(`MCP stdio server "${normalizedConfig.name}" is missing a command.`);
    }

    if ((transport === 'sse' || transport === 'streamableHttp') && !normalizedConfig.url) {
      throw new Error(`MCP remote server "${normalizedConfig.name}" is missing a url.`);
    }

    return normalizedConfig;
  }

  createClient() {
    return new Client({
      name: this.clientInfo.name,
      version: this.clientInfo.version,
    });
  }

  async connectStdioServer(serverConfig) {
    const client = this.createClient();
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env,
      cwd: serverConfig.cwd,
      stderr: 'pipe',
    });

    this.attachTransportObservers(serverConfig.name, transport);
    await client.connect(transport, { timeout: config.mcp.requestTimeoutMs });

    return {
      client,
      transport,
      config: serverConfig,
      transportType: 'stdio',
    };
  }

  async connectRemoteServer(serverConfig) {
    const headers = serverConfig.headers || {};
    const url = new URL(serverConfig.url);

    const tryStreamableHttp = async () => {
      const client = this.createClient();
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: { headers },
        redirectPolicy: 'follow',
      });

      this.attachTransportObservers(serverConfig.name, transport);

      try {
        await client.connect(transport, { timeout: config.mcp.requestTimeoutMs });
      } catch (error) {
        await safeClose(client, transport);
        throw error;
      }

      return {
        client,
        transport,
        config: serverConfig,
        transportType: 'streamableHttp',
      };
    };

    try {
      return await tryStreamableHttp();
    } catch (streamError) {
      if (serverConfig.transport === 'streamableHttp') {
        throw streamError;
      }

      this.logger.warn?.(
        `Streamable HTTP connection failed for ${serverConfig.name}; retrying with SSE fallback.`,
      );

      const client = this.createClient();
      const transport = new SSEClientTransport(url, {
        requestInit: { headers },
        eventSourceInit: { headers },
        redirectPolicy: 'follow',
      });

      this.attachTransportObservers(serverConfig.name, transport);

      try {
        await client.connect(transport, { timeout: config.mcp.requestTimeoutMs });
        return {
          client,
          transport,
          config: serverConfig,
          transportType: 'sse',
        };
      } catch (sseError) {
        await safeClose(client, transport);
        throw new Error(
          `Streamable HTTP failed: ${streamError.message}. SSE fallback failed: ${sseError.message}.`,
        );
      }
    }
  }

  attachTransportObservers(serverName, transport) {
    transport.onerror = error => {
      this.updateStatus(serverName, {
        state: 'error',
        lastError: error.message,
        lastErrorAt: new Date().toISOString(),
      });
    };

    transport.onclose = () => {
      this.connectionRecords.delete(serverName);
      this.updateStatus(serverName, {
        state: 'closed',
        lastClosedAt: new Date().toISOString(),
      });
    };
  }

  updateStatus(serverName, updates) {
    this.serverStatuses.set(serverName, {
      ...(this.serverStatuses.get(serverName) || {}),
      ...updates,
    });
  }

  normalizeConnectionError(serverName, error) {
    if (error instanceof McpConnectionError) {
      return error;
    }

    return new McpConnectionError(`Unable to connect to MCP server "${serverName}".`, {
      cause: error,
      details: {
        serverName,
        message: error.message,
      },
    });
  }
}

let mcpClientManager;

export function getMcpClientManager() {
  if (!mcpClientManager) {
    mcpClientManager = new McpClientManager();
  }

  return mcpClientManager;
}
