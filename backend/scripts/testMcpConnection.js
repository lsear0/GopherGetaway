import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpClientManager } from '../src/mcp/McpClientManager.js';
import { ToolExecutor } from '../src/mcp/ToolExecutor.js';
import { ToolRegistry } from '../src/mcp/ToolRegistry.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const mockServerPath = path.join(currentDirectory, 'mockMcpServer.js');

async function main() {
  const clientManager = new McpClientManager({
    serverConfigs: [
      {
        name: 'mockTravel',
        transport: 'stdio',
        command: 'node',
        args: [mockServerPath],
        enabled: true,
      },
    ],
  });

  const toolRegistry = new ToolRegistry(clientManager);
  const toolExecutor = new ToolExecutor({ clientManager, toolRegistry, timeoutMs: 10_000 });

  try {
    await clientManager.pingServer('mockTravel', 10_000);

    const { tools, openAiTools, failures } = await toolRegistry.refresh();
    const toolResult = await toolExecutor.executeTool('mockTravel__search_stays', {
      location: 'Chicago',
      checkIn: '2026-06-01',
      checkOut: '2026-06-04',
      adults: 2,
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          handshake: clientManager.getStatusSnapshot().mockTravel,
          tools: tools.map(tool => tool.namespacedName),
          openAiToolNames: openAiTools.map(tool => tool.function.name),
          failures,
          toolResult,
        },
        null,
        2,
      ),
    );
  } finally {
    await clientManager.shutdown();
  }
}

main().catch(error => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error.message,
        details: error.details || null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
