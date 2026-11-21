#!/usr/bin/env python3
"""Build a deduplicated song catalogue from official artist/label discographies.

The job fails closed: if either official catalogue cannot be read or the number
of extracted tracks is implausibly small, it does not overwrite the published
catalogue.
"""
from __future__ import annotations
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "LIVE-LOG-song-catalog/1.0 (GitHub Actions; official discography indexer)",
    "Accept-Language": "ja,en;q=0.8",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)
TIMEOUT = 25


def fetch(url: str) -> str:
    response = SESSION.get(url, timeout=TIMEOUT)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or response.encoding
    return response.text


def clean_title(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = re.sub(r"^\s*\d{1,3}\s*[.．、:：)）]\s*", "", value)
    value = re.sub(r"\s+", " ", value).strip(" \t\r\n・")
    value = re.sub(r"\s+(?:作詞|作曲|編曲)：.*$", "", value)
    return value


def key_title(value: str) -> str:
    # Deliberately conservative: normalize width/case/spacing, but retain
    # meaningful punctuation and version suffixes to avoid merging distinct cuts.
    value = unicodedata.normalize("NFKC", value or "").casefold()
    return re.sub(r"[\s\u3000]+", "", value)


def date_from_text(text: str) -> str | None:
    patterns = [
        r"発売日\s*[：:]?\s*(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日",
        r"(20\d{2})[./年-]\s*(\d{1,2})[./月-]\s*(\d{1,2})日?",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            y, m, d = map(int, match.groups())
            try:
                return f"{y:04d}-{m:02d}-{d:02d}"
            except ValueError:
                pass
    return None


def numbered_tracks(text: str) -> list[str]:
    found: list[str] = []
    for line in text.splitlines():
        line = line.strip()
        # Both labels' official pages use numbered CD track rows.
        match = re.match(r"^[*・\-]?\s*(?:CD\s*)?(?:DISC\s*\d+\s*)?(\d{1,2})\s*[.．、:：]\s+(.+?)\s*$", line, re.I)
        if not match:
            match = re.match(r"^(\d{1,2})\s+(.+?)\s*$", line)
        if not match:
            continue
        title = clean_title(match.group(2))
        if not title or len(title) > 100:
            continue
        if title.lower() in {"cd", "blu-ray", "dvd"}:
            continue
        found.append(title)
    # Preserve track order but remove repeats within the same page (e.g. page
    # text duplicated for multiple product variants).
    result, seen = [], set()
    for title in found:
        key = key_title(title)
        if key and key not in seen:
            seen.add(key)
            result.append(title)
    return result


def collect_bump() -> list[dict]:
    base = "https://www.toysfactory.co.jp"
    listing_urls = [
        base + "/artist/bumpofchicken/disco",
        base + "/artist/bumpofchicken/disco/single",
        base + "/artist/bumpofchicken/disco/album",
    ]
    detail_urls: set[str] = set()
    for listing in listing_urls:
        soup = BeautifulSoup(fetch(listing), "html.parser")
        for anchor in soup.select('a[href]'):
            href = urljoin(base, anchor.get("href", ""))
            if re.search(r"/artist/bumpofchicken/disco/\d+/?$", urlparse(href).path):
                detail_urls.add(href)
    if len(detail_urls) < 20:
        raise RuntimeError(f"BUMP official discography detail links too few: {len(detail_urls)}")

    songs: dict[str, dict] = {}
    pages_with_tracks = 0
    for index, url in enumerate(sorted(detail_urls)):
        try:
            soup = BeautifulSoup(fetch(url), "html.parser")
            text = soup.get_text("\n", strip=True)
            release = date_from_text(text)
            tracks = numbered_tracks(text)
            if release and tracks:
                pages_with_tracks += 1
                for track_index, title in enumerate(tracks, start=1):
                    key = key_title(title)
                    item = songs.get(key)
                    if item is None or release < item["releaseDate"]:
                        songs[key] = {"title": title, "releaseDate": release, "trackIndex": track_index, "source": url}
        except Exception as exc:
            print(f"WARN BUMP detail skipped {url}: {exc}", file=sys.stderr)
        if index % 8 == 0:
            time.sleep(0.4)
    if pages_with_tracks < 15 or len(songs) < 80:
        raise RuntimeError(f"BUMP extraction incomplete: pages={pages_with_tracks}, tracks={len(songs)}")
    return sorted(songs.values(), key=lambda x: (x["releaseDate"], x.get("trackIndex", 999), x["title"]))


def collect_nogizaka() -> list[dict]:
    base = "https://www.sonymusic.co.jp"
    listing = base + "/artist/nogizaka46/discography/"
    soup = BeautifulSoup(fetch(listing), "html.parser")
    detail_urls: set[str] = set()
    for anchor in soup.select('a[href]'):
        href = urljoin(base, anchor.get("href", ""))
        if "/artist/nogizaka46/discography/buy/" in urlparse(href).path:
            detail_urls.add(href.split("?")[0])
    if len(detail_urls) < 40:
        raise RuntimeError(f"Nogizaka official Sony Music detail links too few: {len(detail_urls)}")

    songs: dict[str, dict] = {}
    pages_with_tracks = 0
    for index, url in enumerate(sorted(detail_urls)):
        try:
            soup = BeautifulSoup(fetch(url), "html.parser")
            text = soup.get_text("\n", strip=True)
            release = date_from_text(text)
            tracks = numbered_tracks(text)
            if release and tracks:
                pages_with_tracks += 1
                for track_index, title in enumerate(tracks, start=1):
                    key = key_title(title)
                    item = songs.get(key)
                    if item is None or release < item["releaseDate"]:
                        songs[key] = {"title": title, "releaseDate": release, "trackIndex": track_index, "source": url}
        except Exception as exc:
            print(f"WARN Nogizaka detail skipped {url}: {exc}", file=sys.stderr)
        if index % 8 == 0:
            time.sleep(0.4)
    if pages_with_tracks < 30 or len(songs) < 150:
        raise RuntimeError(f"Nogizaka extraction incomplete: pages={pages_with_tracks}, tracks={len(songs)}")
    return sorted(songs.values(), key=lambda x: (x["releaseDate"], x.get("trackIndex", 999), x["title"]))


def main() -> None:
    catalog = {
        "schemaVersion": 1,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "sources": {
            "BUMP": "TOY'S FACTORY official discography",
            "乃木坂": "Sony Music official discography",
        },
        "songs": {
            "BUMP": collect_bump(),
            "乃木坂": collect_nogizaka(),
        },
    }
    for artist, tracks in catalog["songs"].items():
        keys = [key_title(track["title"]) for track in tracks]
        if len(keys) != len(set(keys)):
            raise RuntimeError(f"duplicate normalized titles remain: {artist}")
        print(f"{artist}: {len(tracks)} unique songs")
    with open("song-catalog.json", "w", encoding="utf-8") as output:
        json.dump(catalog, output, ensure_ascii=False, indent=2)
        output.write("\n")


if __name__ == "__main__":
    main()
