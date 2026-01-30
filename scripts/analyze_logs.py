# w/scripts/analyze_logs.py
import json

# This would be in a library file, not re-declared in the script
# from shared.db import db_query 
# from shared.llm import call_llm 
# from shared.rag import ingest_document
# from shared.github import create_github_issue
# from shared.short_term_memory import append_to_stm

def analyze_interaction_logs():
    """
    Fetches recent interactions, analyzes them for feedback, and takes action.
    """
    
    # 1. Fetch recent, unanalyzed interactions
    # query = "SELECT id, content FROM interactions WHERE analyzed = FALSE LIMIT 100;"
    # recent_logs = db_query(query)
    recent_logs = [] # Placeholder for actual db call

    analysis_prompt = """
    You are a meta-analysis AI. Your task is to analyze an interaction log between a user and an AI assistant.
    Identify any of the following patterns:
    1.  **Direct Correction**: The user explicitly corrects the AI's behavior (e.g., "No, you should use tool X instead of Y").
    2.  **Implied Correction**: The user seems frustrated or has to repeat themselves, implying the AI failed.
    3.  **Praise**: The user expresses satisfaction with the AI's performance.
    4.  **New Fact/Preference**: The user states a new preference or fact that should be remembered.
    5.  **Potential Bug**: The interaction reveals a potential bug or flaw in the AI's tools or logic.

    Based on your analysis, classify the interaction and extract the key information.
    Your output MUST be a JSON object with a 'classification' and a 'payload'.

    - If 'classification' is 'correction', the 'payload' should be a concise, one-sentence rule for the AI to follow in the future.
    - If 'classification' is 'bug', the 'payload' should be a detailed bug report title and body.
    - For all others, the 'payload' can be a summary.

    Here is the log to analyze:
    {log_content}
    """

    for log in recent_logs:
        # response = call_llm(analysis_prompt.format(log_content=log['content']))
        # analysis = json.loads(response)
        analysis = {} # Placeholder for actual LLM call

        if analysis.get("classification") == "correction":
            rule = analysis["payload"]
            print(f"Found a correction. New rule: {rule}")
            # append_to_stm(rule)

        elif analysis.get("classification") == "bug":
            title = analysis["payload"]["title"]
            body = analysis["payload"]["body"]
            print(f"Found a bug. Creating issue: {title}")
            # create_github_issue("jasonbender-c3x", "Meowstik", title, body)
        
        else:
            # For 'praise', 'new_fact', etc., we can simply log it or ingest into a general RAG bucket.
            summary = analysis.get("payload", "No action taken.")
            # ingest_document(f"Interaction Analysis: {summary}", metadata={"type": "praise"})
            print(f"Analyzed interaction: {analysis.get('classification')}")

        # Mark the log as analyzed
        # db_execute("UPDATE interactions SET analyzed = TRUE WHERE id = :id", {"id": log['id']})

if __name__ == "__main__":
    analyze_interaction_logs()
