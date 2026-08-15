#!/usr/bin/env python3
"""Fetch freely-licensed gallery photography from Wikimedia Commons.

Fills `public/products/gallery` with placeholder shots for the seeded catalog,
one search per product so a hiking boot's gallery is boots rather than whatever
a catalog-wide search happened to return. Writes credits.json alongside them;
CREDITS.md is generated from that.

Rerunning is safe and cheap: anything already on disk is skipped, so this
resumes rather than restarting. Commons throttles bursts hard, hence the
deliberate GAP between requests — do not lower it. Search terms want to be
broad; "skate shoe canvas high top" matches nothing on Commons at all.

    python3 scripts/fetch-gallery-photos.py

**Every fetched photo needs looking at.** Search relevance cannot tell a shoe
from a landscape, and this has returned the CN Tower, a deer, and a 1907
postcard. To replace a bad one, add its `source_title` to `rejected.json`,
delete the file and its credits.json entry, and re-run — without the reject
entry the same search returns the same picture and downloads it straight back.

Images arrive at assorted sizes and formats, including greyscale PNGs served
with a .jpg name. Normalize afterwards:

    sips -s format jpeg -Z 900 -s formatOptions 68 <file> --out <file>
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request

UA = "NolidzSeedBot/1.0 (development seed data; contact: dev@localhost)"
OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "public", "products", "gallery",
)
PER_PRODUCT = 3
GAP = 8.0

LICENCE_RANK = {
    "CC0": 0, "Public domain": 0, "PDM-owner": 0, "No restrictions": 0,
    "CC BY 4.0": 1, "CC BY 3.0": 1, "CC BY 2.0": 1, "CC BY 2.5": 1,
    "CC BY-SA 4.0": 2, "CC BY-SA 3.0": 2, "CC BY-SA 2.0": 2,
}

"""
Restricted to Commons' Unsplash imports.

A plain keyword search here is unusable: Commons is full of museum and archive
photography, which is also what releases CC0, so licence-first ranking actively
promotes it. Searching "trail running shoe" returned a landscape of the Columbia
River and a deer; "skate shoe" returned antique wooden ice skates; "vintage
sneaker" returned a 1907 postcard. The Unsplash imports are modern commercial
photography, uniformly CC0 and high resolution, which is what a product gallery
needs.
"""
QUERIES = {
    "runner-low":     "running shoes",
    "court-classic":  "white sneakers",
    "trail-gtx":      "hiking shoes",
    "skate-mid":      "sneakers street",
    "retro-88":       "sneakers",
    "deck-slip-on":   "shoes",
    "chunky-dad":     "footwear",
    "hiker-boot":     "hiking boots",
    "knit-runner":    "running shoe",
    "lo-pro-tennis":  "leather shoes",
}

# Subjects that are shoes, but not the kind this shop sells.
BLOCK = (
    "wedding", "bride", "baby", "infant", "child", "heel", "stiletto",
    "ballet", "ski ", "ice skate", "horse", "cleat", "sandal", "flip flop",
    "slipper", "boot camp", "cowboy", "wedge", "pump", "snowboard", "ski boot",
    "kitten", "cat ", "puppy", "dog ", "tower", "skyline",
)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def strip_html(v):
    return " ".join(re.sub(r"<[^>]+>", "", v or "").split())[:80]


def search(term, limit=24):
    q = urllib.parse.urlencode({
        "action": "query", "generator": "search",
        "gsrsearch": f"filetype:bitmap intitle:Unsplash {term}",
        "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|size|extmetadata",
        "iiurlwidth": "900", "format": "json",
    })
    data = json.loads(get(f"https://commons.wikimedia.org/w/api.php?{q}"))
    out = []
    for page in (data.get("query", {}).get("pages") or {}).values():
        info = page.get("imageinfo", [{}])[0]
        meta = info.get("extmetadata", {})
        lic = (meta.get("LicenseShortName", {}) or {}).get("value", "")
        w, h = info.get("width", 0), info.get("height", 0)
        if lic not in LICENCE_RANK or not w or not h or w / h < 0.9 or w < 800:
            continue
        if any(word in page["title"].lower() for word in BLOCK):
            continue
        out.append({
            "rank": LICENCE_RANK[lic], "thumb": info.get("thumburl"),
            "title": page["title"], "licence": lic,
            "author": strip_html((meta.get("Artist", {}) or {}).get("value", "")),
            "page": info.get("descriptionurl"),
        })
    out.sort(key=lambda r: r["rank"])
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, "credits.json")
    credits = json.load(open(path)) if os.path.exists(path) else []
    have = {c["file"] for c in credits}

    # Titles already used, plus titles a human looked at and rejected.
    #
    # The rejects file is what makes replacing a bad photo work. Deleting the
    # image and its credits entry is not enough: the title goes unseen again,
    # the same search returns it at the same rank, and the fetcher downloads
    # the identical picture back. Search relevance cannot tell a shoe from the
    # CN Tower, so rejection has to be remembered.
    seen = {c["source_title"] for c in credits}
    rejects_path = os.path.join(OUT, "rejected.json")
    if os.path.exists(rejects_path):
        seen |= set(json.load(open(rejects_path)))

    for product, term in QUERIES.items():
        need = [n for n in range(1, PER_PRODUCT + 1)
                if f"{product}-g{n}.jpg" not in have]
        if not need:
            print(f"{product}: complete")
            continue

        print(f"\n== {product}: {term} (need {len(need)})")
        try:
            results = search(term)
        except Exception as exc:
            print("  search failed:", exc)
            time.sleep(GAP)
            continue
        time.sleep(GAP)

        for r in results:
            if not need:
                break
            if not r["thumb"] or r["title"] in seen:
                continue
            name = f"{product}-g{need[0]}.jpg"
            try:
                blob = get(r["thumb"])
            except Exception as exc:
                print("  failed:", str(exc)[:60])
                time.sleep(GAP * 2)
                continue
            if len(blob) < 25_000:
                continue
            open(os.path.join(OUT, name), "wb").write(blob)
            seen.add(r["title"])
            credits.append({
                "file": name, "product": product, "source_title": r["title"],
                "licence": r["licence"], "author": r["author"], "page": r["page"],
            })
            json.dump(credits, open(path, "w"), indent=2)
            print(f"  {name}  {len(blob)//1024}KB  {r['licence']}")
            need.pop(0)
            time.sleep(GAP)

    print(f"\ntotal {len(credits)} photos")


main()
