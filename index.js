#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_DIR = process.env.GEMINI_OUTPUT_DIR || path.join(process.env.HOME, "Documents/gemini-output");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Initialize Gemini clients
let genAI = null;      // Old SDK for text generation
let genAINew = null;   // New SDK for image generation
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  genAINew = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// Store conversation history for chat functionality
const conversations = new Map();

const server = new Server(
  {
    name: "gemini-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "gemini_generate",
        description: "Generate text content using Google Gemini. Great for writing, analysis, code generation, and creative content.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt or instruction for Gemini",
            },
            model: {
              type: "string",
              description: "Model to use (default: gemini-1.5-flash). Options: gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash-exp",
              default: "gemini-1.5-flash",
            },
            temperature: {
              type: "number",
              description: "Creativity level 0.0-2.0 (default: 1.0). Lower = more focused, higher = more creative",
              default: 1.0,
            },
            max_tokens: {
              type: "number",
              description: "Maximum output tokens (default: 8192)",
              default: 8192,
            },
            save_to_file: {
              type: "boolean",
              description: "Save output to a file in the output directory",
              default: false,
            },
            filename: {
              type: "string",
              description: "Filename for saved output (without extension)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "gemini_analyze_image",
        description: "Analyze an image using Gemini's vision capabilities. Can describe, extract text, identify objects, or answer questions about images.",
        inputSchema: {
          type: "object",
          properties: {
            image_path: {
              type: "string",
              description: "Path to the image file to analyze",
            },
            prompt: {
              type: "string",
              description: "Question or instruction about the image (default: 'Describe this image in detail')",
              default: "Describe this image in detail",
            },
            model: {
              type: "string",
              description: "Model to use (default: gemini-1.5-flash)",
              default: "gemini-1.5-flash",
            },
          },
          required: ["image_path"],
        },
      },
      {
        name: "gemini_brainstorm",
        description: "Creative brainstorming for zines, articles, and content. Returns structured ideas with titles, concepts, and visual suggestions.",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "The topic or theme to brainstorm about",
            },
            content_type: {
              type: "string",
              description: "Type of content: zine, article, social_post, newsletter, poem, story",
              default: "zine",
            },
            style: {
              type: "string",
              description: "Creative style: punk, academic, whimsical, minimalist, collage, retro, futuristic",
              default: "creative",
            },
            num_ideas: {
              type: "number",
              description: "Number of ideas to generate (default: 5)",
              default: 5,
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "gemini_chat",
        description: "Have a multi-turn conversation with Gemini. Use conversation_id to continue existing chats.",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Your message to Gemini",
            },
            conversation_id: {
              type: "string",
              description: "ID to continue a previous conversation (optional, creates new if not provided)",
            },
            system_instruction: {
              type: "string",
              description: "System instruction to set context/persona (only used when starting new conversation)",
            },
            model: {
              type: "string",
              description: "Model to use (default: gemini-1.5-flash)",
              default: "gemini-1.5-flash",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "gemini_list_conversations",
        description: "List active conversation IDs for the gemini_chat tool",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "gemini_clear_conversation",
        description: "Clear a conversation history",
        inputSchema: {
          type: "object",
          properties: {
            conversation_id: {
              type: "string",
              description: "ID of the conversation to clear",
            },
          },
          required: ["conversation_id"],
        },
      },
      {
        name: "gemini_zine_page",
        description: "Generate content for a zine page including text, layout suggestions, and image prompts for illustration.",
        inputSchema: {
          type: "object",
          properties: {
            theme: {
              type: "string",
              description: "Theme or topic for the zine page",
            },
            page_type: {
              type: "string",
              description: "Type of page: cover, intro, article, interview, art_spread, collage, back_cover",
              default: "article",
            },
            tone: {
              type: "string",
              description: "Tone: rebellious, thoughtful, playful, informative, poetic, absurdist",
              default: "thoughtful",
            },
            include_image_prompts: {
              type: "boolean",
              description: "Include AI image generation prompts for illustrations",
              default: true,
            },
          },
          required: ["theme"],
        },
      },
      {
        name: "gemini_generate_image",
        description: "Generate an image using Google's most advanced Gemini 3 Pro Image model. State-of-the-art quality with 1K/2K/4K output, advanced text rendering, and photorealistic/artistic capabilities.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Detailed description of the image to generate",
            },
            style: {
              type: "string",
              description: "Art style hint: photorealistic, illustration, painting, sketch, collage, punk-zine, vintage, minimalist",
              default: "illustration",
            },
            aspect_ratio: {
              type: "string",
              description: "Aspect ratio: 1:1 (square), 3:4 (portrait), 4:3 (landscape), 9:16 (tall), 16:9 (wide)",
              default: "3:4",
            },
            num_images: {
              type: "number",
              description: "Number of images to generate (1-4, default: 1)",
              default: 1,
            },
            filename: {
              type: "string",
              description: "Output filename without extension (auto-generated if not provided)",
            },
          },
          required: ["prompt"],
        },
      },
    ],
  };
});

// Helper function to read image and convert to base64
function imageToBase64(imagePath) {
  const absolutePath = path.resolve(imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const imageData = fs.readFileSync(absolutePath);
  const base64 = imageData.toString("base64");

  // Determine mime type from extension
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  const mimeType = mimeTypes[ext] || "image/jpeg";
  return { base64, mimeType };
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!GEMINI_API_KEY) {
    return {
      content: [
        {
          type: "text",
          text: "Error: GEMINI_API_KEY environment variable is not set",
        },
      ],
      isError: true,
    };
  }

  try {
    // ========== gemini_generate ==========
    if (name === "gemini_generate") {
      const model = genAI.getGenerativeModel({
        model: args.model || "gemini-1.5-flash",
        generationConfig: {
          temperature: args.temperature || 1.0,
          maxOutputTokens: args.max_tokens || 8192,
        },
      });

      const result = await model.generateContent(args.prompt);
      const response = result.response;
      const text = response.text();

      // Optionally save to file
      let savedPath = null;
      if (args.save_to_file) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = args.filename || `gemini_${timestamp}`;
        savedPath = path.join(OUTPUT_DIR, `${filename}.md`);
        fs.writeFileSync(savedPath, `# Gemini Output\n\n**Prompt:** ${args.prompt}\n\n**Model:** ${args.model || "gemini-1.5-flash"}\n\n---\n\n${text}`);
      }

      return {
        content: [
          {
            type: "text",
            text: savedPath
              ? `${text}\n\n---\n*Saved to: ${savedPath}*`
              : text,
          },
        ],
      };
    }

    // ========== gemini_analyze_image ==========
    if (name === "gemini_analyze_image") {
      const { base64, mimeType } = imageToBase64(args.image_path);

      const model = genAI.getGenerativeModel({
        model: args.model || "gemini-1.5-flash"
      });

      const imagePart = {
        inlineData: {
          data: base64,
          mimeType: mimeType,
        },
      };

      const result = await model.generateContent([
        args.prompt || "Describe this image in detail",
        imagePart,
      ]);

      return {
        content: [
          {
            type: "text",
            text: `**Image Analysis: ${args.image_path}**\n\n${result.response.text()}`,
          },
        ],
      };
    }

    // ========== gemini_brainstorm ==========
    if (name === "gemini_brainstorm") {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 1.2, // Higher creativity for brainstorming
        },
      });

      const brainstormPrompt = `You are a creative director brainstorming for a ${args.content_type || "zine"}.

Topic: ${args.topic}
Style: ${args.style || "creative"}
Number of ideas needed: ${args.num_ideas || 5}

Generate ${args.num_ideas || 5} distinct creative ideas. For each idea, provide:
1. **Title** - A catchy title
2. **Concept** - 2-3 sentence description of the idea
3. **Visual Direction** - Suggestions for imagery, colors, typography
4. **Key Phrases** - 3-5 evocative phrases or pull quotes that could be used
5. **AI Image Prompt** - A detailed prompt that could generate an illustration for this idea

Be bold, unconventional, and specific. Mix the expected with the surprising.`;

      const result = await model.generateContent(brainstormPrompt);

      return {
        content: [
          {
            type: "text",
            text: `# Brainstorm: ${args.topic}\n\n**Content Type:** ${args.content_type || "zine"}\n**Style:** ${args.style || "creative"}\n\n---\n\n${result.response.text()}`,
          },
        ],
      };
    }

    // ========== gemini_chat ==========
    if (name === "gemini_chat") {
      const convId = args.conversation_id || `conv_${Date.now()}`;

      let chat;
      if (conversations.has(convId)) {
        chat = conversations.get(convId);
      } else {
        const model = genAI.getGenerativeModel({
          model: args.model || "gemini-1.5-flash",
          systemInstruction: args.system_instruction,
        });
        chat = model.startChat({
          history: [],
        });
        conversations.set(convId, chat);
      }

      const result = await chat.sendMessage(args.message);

      return {
        content: [
          {
            type: "text",
            text: `**[Conversation: ${convId}]**\n\n${result.response.text()}`,
          },
        ],
      };
    }

    // ========== gemini_list_conversations ==========
    if (name === "gemini_list_conversations") {
      const convIds = Array.from(conversations.keys());

      if (convIds.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No active conversations. Start one with gemini_chat.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `**Active Conversations:**\n\n${convIds.map(id => `- ${id}`).join("\n")}`,
          },
        ],
      };
    }

    // ========== gemini_clear_conversation ==========
    if (name === "gemini_clear_conversation") {
      if (conversations.has(args.conversation_id)) {
        conversations.delete(args.conversation_id);
        return {
          content: [
            {
              type: "text",
              text: `Conversation '${args.conversation_id}' cleared.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Conversation '${args.conversation_id}' not found.`,
            },
          ],
        };
      }
    }

    // ========== gemini_zine_page ==========
    if (name === "gemini_zine_page") {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 1.1,
        },
      });

      const pagePrompt = `You are designing a page for a DIY zine. Create compelling content that balances text and visual elements.

Theme: ${args.theme}
Page Type: ${args.page_type || "article"}
Tone: ${args.tone || "thoughtful"}
Include Image Prompts: ${args.include_image_prompts !== false}

Generate the following for this zine page:

## HEADLINE
A bold, attention-grabbing headline (can be hand-drawn style, experimental typography)

## BODY TEXT
The main text content appropriate for the page type. Keep it punchy and zine-appropriate - not too long, not too polished.

## PULL QUOTES / CALLOUTS
2-3 short phrases that could be highlighted or placed in the margins

## LAYOUT NOTES
Suggestions for how to arrange elements on the page (consider: cut-and-paste aesthetic, hand-drawn elements, white space, asymmetry)

${args.include_image_prompts !== false ? `## IMAGE PROMPTS
2-3 detailed prompts for AI image generation that would create illustrations fitting this page. Include style directions (collage, illustration, photo manipulation, etc.)` : ""}

## DIY TOUCHES
Suggestions for hand-made additions (stamps, doodles, tape, stickers, hand-written notes)

Be authentic to zine culture - raw, personal, and visually interesting.`;

      const result = await model.generateContent(pagePrompt);

      return {
        content: [
          {
            type: "text",
            text: `# Zine Page: ${args.theme}\n\n**Type:** ${args.page_type || "article"} | **Tone:** ${args.tone || "thoughtful"}\n\n---\n\n${result.response.text()}`,
          },
        ],
      };
    }

    // ========== gemini_generate_image ==========
    if (name === "gemini_generate_image") {
      // Build enhanced prompt with style
      const styleHints = {
        "photorealistic": "photorealistic, high detail, natural lighting, realistic textures",
        "illustration": "digital illustration, clean lines, vibrant colors, artistic",
        "painting": "oil painting style, brushstrokes visible, artistic, painterly",
        "sketch": "pencil sketch, hand-drawn, black and white, line art",
        "collage": "cut-and-paste collage, mixed media, layered paper textures, punk zine aesthetic",
        "punk-zine": "punk zine aesthetic, xerox texture, high contrast, DIY, rebellious, rough edges",
        "vintage": "vintage aesthetic, retro colors, aged paper texture, nostalgic",
        "minimalist": "minimalist design, simple shapes, limited color palette, clean"
      };

      const styleModifier = styleHints[args.style] || styleHints["illustration"];
      const enhancedPrompt = `${args.prompt}. Style: ${styleModifier}`;

      // Map aspect ratio strings to API format
      const aspectRatioMap = {
        "square": "1:1",
        "portrait": "3:4",
        "landscape": "4:3",
        "tall": "9:16",
        "wide": "16:9",
        "1:1": "1:1",
        "3:4": "3:4",
        "4:3": "4:3",
        "9:16": "9:16",
        "16:9": "16:9"
      };
      const aspectRatio = aspectRatioMap[args.aspect_ratio] || "3:4";
      const numImages = Math.min(Math.max(args.num_images || 1, 1), 4);

      // Use the new Gemini image generation models with generateContent API
      // Models: gemini-2.5-flash-preview-image-generation (fast), gemini-2.0-flash-exp (fallback)
      let response;
      let modelUsed = "gemini-2.0-flash-exp";

      // List of models to try in order of preference (Dec 2025)
      // See: https://ai.google.dev/gemini-api/docs/image-generation
      const modelsToTry = [
        "gemini-2.0-flash-exp-image-generation",  // Explicit image generation variant
        "gemini-2.0-flash-exp",  // General experimental model with image capability
        "gemini-2.0-flash-preview-image-generation",
      ];

      let lastError = null;
      for (const modelName of modelsToTry) {
        try {
          console.error(`Trying image generation with model: ${modelName}`);
          response = await genAINew.models.generateContent({
            model: modelName,
            contents: enhancedPrompt,
            config: {
              responseModalities: ["IMAGE", "TEXT"],
            },
          });
          modelUsed = modelName;
          break; // Success, exit loop
        } catch (e) {
          console.error(`${modelName} failed:`, e.message);
          lastError = e;
          continue; // Try next model
        }
      }

      if (!response) {
        return {
          content: [
            {
              type: "text",
              text: `All image generation models failed. Last error: ${lastError?.message || "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }

      // Extract images from response parts
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const savedPaths = [];
      let textResponse = "";
      let imageIndex = 0;

      // Handle different response structures
      const parts = response.candidates?.[0]?.content?.parts || response.parts || [];

      for (const part of parts) {
        if (part.text) {
          textResponse += part.text + "\n";
        } else if (part.inlineData) {
          // New API format: inlineData with data field
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const suffix = numImages > 1 ? `_${imageIndex + 1}` : "";
          const filename = args.filename ? `${args.filename}${suffix}` : `gemini_img_${timestamp}${suffix}`;
          const outputPath = path.join(OUTPUT_DIR, `${filename}.png`);
          fs.writeFileSync(outputPath, buffer);
          savedPaths.push(outputPath);
          imageIndex++;
        } else if (part.inline_data) {
          // Alternative format
          const buffer = Buffer.from(part.inline_data.data, "base64");
          const suffix = numImages > 1 ? `_${imageIndex + 1}` : "";
          const filename = args.filename ? `${args.filename}${suffix}` : `gemini_img_${timestamp}${suffix}`;
          const outputPath = path.join(OUTPUT_DIR, `${filename}.png`);
          fs.writeFileSync(outputPath, buffer);
          savedPaths.push(outputPath);
          imageIndex++;
        }
      }

      if (savedPaths.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Image generation did not return any images. Response: ${textResponse || JSON.stringify(response).slice(0, 500)}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Image${savedPaths.length > 1 ? 's' : ''} generated successfully!\n\n**Model:** ${modelUsed}\n**Prompt:** ${args.prompt}\n**Style:** ${args.style || "illustration"}\n**Aspect Ratio:** ${aspectRatio}\n**Saved to:**\n${savedPaths.map(p => `- ${p}`).join('\n')}${textResponse ? `\n\n**Model response:** ${textResponse}` : ''}`,
          },
        ],
      };
    }

    // Unknown tool
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };

  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Gemini MCP server running...");
}

main().catch(console.error);
