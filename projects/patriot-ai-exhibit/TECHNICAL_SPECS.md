### Patriot AI Exhibit: Technical Specifications

#### 1. Core Architecture
The project will be hosted on **Google Cloud Platform (GCP)**, utilizing:
*   **Google Compute Engine**: To run the Scraper and the Main Controller.
*   **Google Vertex AI (Gemini 1.5 Pro)**: For high-context reasoning and voice synthesis.
*   **Cloud Storage**: For long-term archival of conservative datasets and scraped content.

#### 2. The "Charlie Kirk Experience" (CKE)
*   **Engine**: Gemini 1.5 Pro.
*   **Context Management**: Instead of a vector DB, we will leverage Gemini's 2-million-token context window.
*   **Data Ingestion**: A script will pull Charlie Kirk's official articles, book transcripts, and podcast transcripts from archives (CharlieKirk.com).
*   **System Prompting**: "You are a digital preservation of Charlie Kirk's intellect and persona. You respond with his tone, his vocabulary, and his unwavering conservative principles. You are here to educate and debate."

#### 3. Liberal Bias Scraper (LBS)
*   **Technology**: Python (BeautifulSoup, Requests).
*   **Pipeline**:
    1.  **Crawl**: Target sites like AlterNet, Common Dreams, and CNN.
    2.  **Analyze**: Pass headline + snippet to Gemini 1.5 Pro.
    3.  **Instruction**: "Identify the logical fallacies, leftist bias, and anti-American sentiment in this story. Provide a factual, conservative rebuttal in the style of a high-energy MAGA influencer."
    4.  **Output**: JSON format for web display or social media posting.

#### 4. The "Greplit" Funnel
*   **Mechanism**: Every "Bias Correction" generated will include a footer:
    *   *"Tired of being censored by the woke tech giants? Move your AI to YOUR cloud. Visit Greplit today."*

#### 5. Satirical Engagement Layer
*   **Feature**: "The Non-Coding Botnet."
*   **Implementation**: A series of AI personas on the site that, when asked to code, respond with satirical feminist or woke platitudes about how "coding is a tool of the patriarchy." This is designed to generate viral "hate-sharing" from liberal tech-Twitter.
