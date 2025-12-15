# Gemini MCP Server

A Model Context Protocol (MCP) server for Google Gemini API integration with Claude Code. Provides text generation, image analysis, creative brainstorming, multi-turn chat, and AI image generation.

## Features

| Tool | Description |
|------|-------------|
| `gemini_generate` | Generate text content (writing, analysis, code) |
| `gemini_analyze_image` | Analyze images with vision capabilities |
| `gemini_brainstorm` | Creative brainstorming for zines, articles, content |
| `gemini_chat` | Multi-turn conversations with memory |
| `gemini_list_conversations` | List active chat sessions |
| `gemini_clear_conversation` | Clear a chat session |
| `gemini_zine_page` | Generate zine page content with layout suggestions |
| `gemini_generate_image` | Generate images using Gemini's image models |

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/jeffemmett/gemini-mcp.git ~/.claude/mcp-servers/gemini
cd ~/.claude/mcp-servers/gemini
npm install
```

### 2. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Copy the key

### 3. Set your API key

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`):

```bash
# Bash/Zsh
export GEMINI_API_KEY="your_api_key_here"

# Fish
set -gx GEMINI_API_KEY "your_api_key_here"
```

Then reload your shell or run `source ~/.bashrc`.

### 4. Configure Claude Code

Add to your project's `.mcp.json` or global MCP config:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["/path/to/.claude/mcp-servers/gemini/index.js"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}"
      }
    }
  }
}
```

Replace `/path/to/` with your actual home directory path (e.g., `/home/username/` or `/Users/username/`).

## Optional Configuration

### Output Directory

Generated images and saved outputs go to `~/Documents/gemini-output/` by default. Override with:

```bash
export GEMINI_OUTPUT_DIR="/your/preferred/path"
```

## Usage Examples

Once configured, the tools are available in Claude Code:

**Text Generation:**
```
Use gemini_generate to write a haiku about programming
```

**Image Analysis:**
```
Use gemini_analyze_image to describe /path/to/image.jpg
```

**Creative Brainstorming:**
```
Use gemini_brainstorm for a zine about urban gardening with punk style
```

**Image Generation:**
```
Use gemini_generate_image to create a collage-style illustration of a mushroom forest
```

## Models Used

- **Text**: `gemini-1.5-flash` (default), `gemini-1.5-pro`, `gemini-2.0-flash-exp`
- **Images**: `gemini-2.0-flash-exp-image-generation`

## License

MIT
