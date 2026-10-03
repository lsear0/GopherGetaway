import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'mock-travel-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_stays',
      description: 'Return mock accommodation search results for MCP diagnostics.',
      inputSchema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'Destination city or region.' },
          checkIn: { type: 'string', description: 'Check-in date in ISO format.' },
          checkOut: { type: 'string', description: 'Check-out date in ISO format.' },
          adults: { type: 'number', description: 'Number of adult guests.' }
        },
        required: ['location', 'checkIn', 'checkOut']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async request => {
  if (request.params.name !== 'search_stays') {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }]
    };
  }

  const { location, checkIn, checkOut, adults = 2 } = request.params.arguments || {};
  const payload = {
    location,
    checkIn,
    checkOut,
    adults,
    properties: [
      {
        name: 'Mock Lakeview Hotel',
        nightlyRateUsd: 129,
        distanceToCenterKm: 1.4,
        platform: 'mock-platform'
      },
      {
        name: 'Mock Budget Stay',
        nightlyRateUsd: 94,
        distanceToCenterKm: 2.1,
        platform: 'mock-platform'
      }
    ]
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
