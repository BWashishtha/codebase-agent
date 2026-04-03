import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  try {
    const { messages, codebase } = await req.json();

    if (!codebase || !messages?.length) {
      return new Response("Missing codebase or messages", { status: 400 });
    }

    const system = `You are an expert developer agent specialized in explaining and documenting codebases. The user has shared the following code:

\`\`\`
${codebase}
\`\`\`

Help the developer understand this codebase through conversation. You can:
- Explain overall architecture and design patterns
- Break down individual functions and their responsibilities  
- Trace data flow and execution paths
- Identify potential bugs, edge cases, or code smells
- Generate documentation: JSDoc, docstrings, inline comments, or full READMEs
- Suggest improvements or refactoring opportunities
- Answer any specific question about how the code works

Be precise, technical, and concise. Use markdown code blocks for all code and documentation output.`;

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(chunk.delta.text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
