/**
 * MCP Tools API Endpoint
 *
 * This endpoint exposes MCP-compatible tools for AI agents
 * Can be used with:
 * - n8n HTTP Request nodes
 * - Custom AI agents
 * - OpenAI function calling
 * - FastMCP integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { MCP_TOOLS, executeMCPTool, MCPTool } from '@/lib/mcp-server';

// GET: List available tools (OpenAI function schema format)
export async function GET() {
  // Format tools for OpenAI function calling compatibility
  const openAIFunctions = MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  }));

  return NextResponse.json({
    status: 'ok',
    tools: MCP_TOOLS,
    openai_functions: openAIFunctions,
    usage: {
      list_tools: 'GET /api/agent/tools',
      execute_tool: 'POST /api/agent/tools',
      example: {
        method: 'POST',
        body: {
          tool: 'get_campaigns',
          params: { status_filter: 'enabled' },
        },
      },
    },
  });
}

// POST: Execute a tool
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, params = {} } = body;

    if (!tool) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing "tool" in request body',
          available_tools: MCP_TOOLS.map((t) => t.name),
        },
        { status: 400 }
      );
    }

    // Check if tool exists
    const toolDef = MCP_TOOLS.find((t) => t.name === tool);
    if (!toolDef) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown tool: ${tool}`,
          available_tools: MCP_TOOLS.map((t) => t.name),
        },
        { status: 400 }
      );
    }

    // Validate required params
    const required = toolDef.inputSchema.required || [];
    const missing = required.filter((r) => !(r in params));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required parameters: ${missing.join(', ')}`,
          tool_schema: toolDef.inputSchema,
        },
        { status: 400 }
      );
    }

    // Execute tool
    console.log(`[MCP Tools] Executing: ${tool}`, params);
    const result = await executeMCPTool(tool, params);

    return NextResponse.json({
      tool,
      params,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[MCP Tools] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
