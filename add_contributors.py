import json
import re
import time
import requests
from bs4 import BeautifulSoup

INPUT_JSON = "birds.json"                 # your original file
OUTPUT_JSON = "birds_with_contributors.json"  # new file with Contributor field


def extract_asset_id(picture_html: str | None) -> str | None:
    """Extract ML asset ID from the iframe HTML in the Picture field."""
    if not picture_html:
        return None
    m = re.search(r"asset/(\d+)/", picture_html)
    return m.group(1) if m else None

def fetch_contributor(asset_id: str) -> str | None:
    """
    Fetch Macaulay Library asset page and extract contributor name.
    Updated based on real HTML snippet provided by the user.
    """
    url = f"https://macaulaylibrary.org/asset/{asset_id}"
    print(f"Fetching contributor for asset {asset_id} ...", flush=True)

    try:
        r = requests.get(url, timeout=20)
        r.raise_for_status()
    except Exception as e:
        print(f"  ! HTTP error for {asset_id}: {e}")
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    # ---- Strategy 1: Your exact snippet: <span class="main">Ad Konings</span> ----
    span_main = soup.find("span", class_="main")
    if span_main:
        name = span_main.get_text(strip=True)
        if name and len(name) < 60 and "Contributor" not in name:
            print(f"  → Contributor: {name}")
            return name

    # ---- Strategy 2: Look for a human name in contributor link ----
    contributor_link = soup.find("a", href=lambda x: x and "/contributor/" in x)
    if contributor_link:
        name = contributor_link.get_text(strip=True)
        if name and len(name) < 60:
            print(f"  → Contributor (link): {name}")
            return name

    # ---- Strategy 3: Final fallback: look for proper names near 'Contributor' text ----
    heading = soup.find(string=lambda x: isinstance(x, str) and "Contributor" in x)
    if heading:
        nxt = heading.parent.find_next(string=True)
        if nxt:
            name = nxt.strip()
            if name and name not in ("Contributor", ""):
                print(f"  → Contributor (fallback): {name}")
                return name

    print("  ! Could not find contributor on page.")
    return None


def main():
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        birds = json.load(f)

    for idx, bird in enumerate(birds, start=1):
        # Don’t overwrite if Contributor already exists and is non-empty
        if bird.get("Contributor"):
            print(f"[{idx}] {bird['Name']}: already has Contributor = {bird['Contributor']}")
            continue

        asset_id = extract_asset_id(bird.get("Picture", ""))
        if not asset_id:
            print(f"[{idx}] {bird['Name']}: no asset id found, skipping.")
            bird["Contributor"] = ""
            continue

        name = fetch_contributor(asset_id)
        bird["Contributor"] = name or ""

        # Be polite with the server
        time.sleep(1.0)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(birds, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Wrote updated birds with contributors to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
