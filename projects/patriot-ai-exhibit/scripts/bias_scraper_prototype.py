import requests
from bs4 import BeautifulSoup
import json

# This is a prototype for the Liberal Bias Scraper
# It will fetch headlines from identified liberal news sources
# and eventually pass them to Gemini for bias analysis.

SOURCES = {
    "The American Prospect": "https://prospect.org/",
    "Common Dreams": "https://www.commondreams.org/",
    "AlterNet": "https://www.alternet.org/"
}

def scrape_headlines(site_name, url):
    print(f"Scraping {site_name}...")
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # This logic will need to be customized per site
        headlines = []
        if site_name == "Common Dreams":
            # Example: finding h2 or h3 titles
            for h in soup.find_all(['h2', 'h3'], limit=5):
                headlines.append(h.get_text().strip())
        else:
            for h in soup.find_all(['h1', 'h2'], limit=5):
                headlines.append(h.get_text().strip())
                
        return headlines
    except Exception as e:
        return [f"Error scraping {site_name}: {str(e)}"]

def main():
    results = {}
    for name, url in SOURCES.items():
        results[name] = scrape_headlines(name, url)
    
    print("\n--- SCRAPED HEADLINES ---")
    for site, titles in results.items():
        print(f"\n[{site}]")
        for t in titles:
            print(f" - {t}")

if __name__ == "__main__":
    main()
