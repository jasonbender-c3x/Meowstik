# Copilot Intake Reports

Files in this folder are generated automatically when the `copilot_send_report` tool is invoked. Each report includes:

- The human-readable summary and details of what the LLM wants Copilot to do.
- A list of referenced files and the priority of the request.
- The exact prompt that was sent to the Copilot CLI.

These reports serve as the canonical instructions for GitHub Copilot. After the LLM writes one, run `copilot chat` or `gh copilot` in the terminal so you can see Copilot read the file and start implementing the changes. You can re-run Copilot later by pointing it at the same workspace and pointing the agent to the desired intake file.
