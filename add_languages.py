from playwright.sync_api import sync_playwright
import json
import time

INPUT_FILE = "birds_with_contributors.json"
OUTPUT_FILE = "birds_with_contributors_and_names.json"

def extract_names(page):
    """
    Click the 'Names (xx)' link and extract the table of names.
    """

    # 1. Find ANY element containing "Names (" and click it
    toggle = page.wait_for_selector("text=/Names\\s*\\(\\d+\\)/i", timeout=60000)
    toggle.click()

    # 2. Now wait for the dialog container to be attached (NOT visible)
    dialog = page.wait_for_selector('[data-lichen-dialog="allCommonNames"]',
                                    state="attached", timeout=60000)

    time.sleep(0.5)  # allow table rendering

    # 3. Extract rows
    rows = dialog.query_selector_all("table tbody tr")

    names = {}
    for row in rows:
        cols = row.query_selector_all("td")
        if len(cols) == 2:
            lang = cols[0].inner_text().strip()
            cname = cols[1].inner_text().strip()
            names[lang] = cname

    return names


def main():
    birds = json.load(open(INPUT_FILE, encoding="utf8"))
    results = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for b in birds:
            doi = b["Doi"]
            print("\n🔎 Loading:", doi)

            page.goto(doi, wait_until="networkidle")
            time.sleep(0.7)  # Allow page hydration

            try:
                names = extract_names(page)
                print(f"   ✔ Extracted {len(names)} names")
            except Exception as e:
                print("   ❌ Error:", e)
                names = {}

            b["commonNames"] = names
            results.append(b)

        browser.close()

    # ---------------------------------------------------------
    # COUNT LANGUAGES ACROSS ALL BIRDS & KEEP ONLY UNIVERSAL ONES
    # ---------------------------------------------------------
    language_count = {}

    for bird in results:
        for lang in bird["commonNames"].keys():
            language_count[lang] = language_count.get(lang, 0) + 1

    total_birds = len(results)

    languages_for_all_birds = [
        lang for lang, count in language_count.items()
        if count == total_birds
    ]

    print("\n🌍 Languages shared by ALL birds:")
    for lang in languages_for_all_birds:
        print("  •", lang)

    # Remove languages not present in ALL birds
    for bird in results:
        bird["commonNames"] = {
            lang: name
            for lang, name in bird["commonNames"].items()
            if lang in languages_for_all_birds
        }

    # ---------------------------------------------------------
    # SAVE THE FILTERED RESULT JSON
    # ---------------------------------------------------------
    json.dump(results, open(OUTPUT_FILE, "w", encoding="utf8"),
              indent=2, ensure_ascii=False)

    print("\n🎉 DONE — saved", OUTPUT_FILE)


if __name__ == "__main__":
    main()
