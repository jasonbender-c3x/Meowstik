# GitHub MCP Server Setup for Copilot

This guide explains how to configure GitHub Copilot to use the GitHub MCP (Model Context Protocol) server in VS Code.

## Overview

The GitHub MCP server enables GitHub Copilot to access GitHub-specific context and functionality, providing better code suggestions and assistance by understanding your repository structure, issues, pull requests, and more.

## Prerequisites

- Visual Studio Code with GitHub Copilot extension installed
- Node.js and npm installed
- GitHub Personal Access Token (PAT)

## Setup Instructions

### 1. Configuration File

The repository includes a `.vscode/mcp.json` file that configures the GitHub MCP server:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${input:github_mcp_pat}"
      }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "github_mcp_pat",
      "description": "GitHub Personal Access Token for MCP Server",
      "password": true
    }
  ]
}
```

### 2. Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Personal Access Tokens](https://github.com/settings/personal-access-tokens/new)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "MCP Server for Copilot")
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (Read org and team membership)
   - `read:user` (Read user profile data)
5. Click "Generate token"
6. **Important:** Copy the token immediately - you won't be able to see it again!

### 3. Enable the MCP Server in VS Code

1. Open the project in VS Code
2. When VS Code loads, you should see a prompt asking for your GitHub Personal Access Token
3. Paste your token and press Enter
4. The MCP server will start automatically

Alternatively, you can manually start the server:
1. Open the Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Type "MCP: List Servers"
3. Select "github" from the list
4. Click "Start Server" if it's not already running

### 4. Verify the Connection

Once configured, GitHub Copilot will have access to:
- Repository structure and file contents
- Issue tracking and management
- Pull request information
- GitHub Actions workflows
- Commit history
- And more GitHub-specific context

You can verify the connection by asking Copilot questions about your repository, such as:
- "What are the open issues in this repository?"
- "Show me the recent pull requests"
- "What does the CI/CD workflow do?"

## Troubleshooting

### Token Not Accepted
- Ensure your token has the correct scopes
- Check that the token hasn't expired
- Try generating a new token

### MCP Server Won't Start
- Ensure Node.js and npm are installed and in your PATH
- Try running `npx -y @modelcontextprotocol/server-github` manually to check for errors
- Check the VS Code output panel for error messages

### No Prompt for Token
- Check if `.vscode/mcp.json` exists in the project
- Try reloading the VS Code window (`Cmd+R` or `Ctrl+R`)
- Manually trigger the server start via Command Palette

## Security Notes

- The token is stored securely by VS Code and not committed to the repository
- Never commit your Personal Access Token to version control
- Use tokens with minimal required scopes
- Consider creating a dedicated GitHub account with limited permissions for MCP access
- Regularly rotate your tokens for security

## Additional Resources

- [VS Code MCP Server Documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [GitHub MCP Server Setup Guide](https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/set-up-the-github-mcp-server)
- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

## Support

If you encounter issues with the MCP server configuration, please:
1. Check the troubleshooting section above
2. Review the VS Code output panel for error messages
3. Create an issue in this repository with the `documentation` label
