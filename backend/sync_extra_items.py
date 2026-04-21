"""
DEPRECADO: Este script ha sido reemplazado por sync_osrs.py, que ahora
usa el generator=embeddedin del wiki OSRS para obtener TODOS los ítems
(tradeables y no-tradeables) desde una única fuente.

sync_extra_items.py — Sincroniza ítems no-tradeables de OSRS a Supabase.

Estrategia (sin ningún nombre hardcodeado):
  1. Descarga el GE mapping completo → conjunto de IDs ya conocidos.
  2. Recorre *todas* las páginas de Category:Items del wiki OSRS via
     categorymembers (paginado con cmcontinue).
  3. Descarga el wikitext en batches de 50 páginas por request (action=query).
  4. Parsea |id  |id1  |id2… e |image  |image1… del Infobox Item.
  5. Inserta en Supabase solo los ítems cuyo ID no aparece en el GE mapping.

Uso:
  python sync_extra_items.py            # sync completo
  python sync_extra_items.py --dry-run  # preview sin escribir en DB
  python sync_extra_items.py --limit 200  # prueba rápida (primeras 200 páginas)
"""

import argparse
import os
import re
import sys
import time
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────

load_dotenv()
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=False)

SUPABASE_URL         = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

GE_MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping"
WIKI_API       = "https://oldschool.runescape.wiki/api.php"
WIKI_ICON_BASE = "https://oldschool.runescape.wiki/images"

HEADERS = {"User-Agent": "osrs-road-extra-sync/1.0 (github.com/alexbondino/osrs-road)"}

WIKI_BATCH     = 20    # max titles por request de revisions
SUPABASE_BATCH = 200   # filas por upsert
DELAY          = 0.5   # segundos entre requests al wiki
MAX_RETRIES    = 3     # reintentos en caso de timeout

# ── GE Mapping ────────────────────────────────────────────────────────────────

def fetch_ge_ids() -> set[int]:
    """Devuelve el conjunto de IDs que ya están en el GE mapping."""
    print("📦 Descargando GE mapping…")
    r = requests.get(GE_MAPPING_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    ids = {item["id"] for item in r.json()}
    print(f"   {len(ids):,} ítems en el GE mapping.")
    return ids

# ── Category walk ─────────────────────────────────────────────────────────────

def iter_category_pages(category: str = "Items"):
    """Genera los títulos de todas las páginas en una categoría del wiki."""
    params: dict = {
        "action": "query",
        "list":   "categorymembers",
        "cmtitle": f"Category:{category}",
        "cmlimit": "500",
        "cmtype":  "page",
        "format":  "json",
    }
    while True:
        r = requests.get(WIKI_API, params=params, headers=HEADERS, timeout=30)
        r.raise_for_status()
        data = r.json()
        for member in data["query"]["categorymembers"]:
            yield member["title"]
        if "continue" not in data:
            break
        params.update(data["continue"])
        time.sleep(DELAY)

# ── Wikitext batch fetch ───────────────────────────────────────────────────────

def fetch_wikitext_batch(titles: list[str]) -> dict[str, str]:
    """Devuelve {title: wikitext} para hasta WIKI_BATCH páginas, con reintentos."""
    params = {
        "action":   "query",
        "prop":     "revisions",
        "rvprop":   "content",
        "rvslots":  "main",
        "titles":   "|".join(titles),
        "format":   "json",
        "formatversion": "2",
    }
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(WIKI_API, params=params, headers=HEADERS, timeout=45)
            r.raise_for_status()
            result: dict[str, str] = {}
            for page in r.json()["query"]["pages"]:
                if "revisions" not in page:
                    continue
                rev = page["revisions"][0]
                wt = rev.get("slots", {}).get("main", {}).get("content") or rev.get("content", "")
                result[page["title"]] = wt
            return result
        except requests.exceptions.Timeout:
            wait = attempt * 5
            print(f"  ⏳ Timeout (intento {attempt}/{MAX_RETRIES}), reintentando en {wait}s…")
            time.sleep(wait)
    print(f"  ⚠  Batch fallido tras {MAX_RETRIES} intentos, omitiendo.")
    return {}

# ── Infobox parsing ───────────────────────────────────────────────────────────

RE_INFOBOX = re.compile(r'\{\{Infobox Item', re.IGNORECASE)
RE_ID      = re.compile(r'\|\s*id\d*\s*=\s*(\d+)', re.IGNORECASE)
RE_IMAGE   = re.compile(r'\|\s*image\d*\s*=\s*\[\[File:([^\|\]\n]+\.png)\]\]', re.IGNORECASE)

def parse_items(title: str, wikitext: str) -> list[dict]:
    """
    Extrae todos los ítems del wikitext (infoboxes multi-versión incluidos).
    Devuelve cada par (id, image) como un dict listo para Supabase.
    """
    if not RE_INFOBOX.search(wikitext):
        return []
    ids    = [int(m) for m in RE_ID.findall(wikitext)]
    images = RE_IMAGE.findall(wikitext)
    if not ids:
        return []
    items = []
    for i, item_id in enumerate(ids):
        img = images[i] if i < len(images) else (images[0] if images else None)
        icon = f"{WIKI_ICON_BASE}/{quote(img.replace(' ', '_'), safe='()_.~')}" if img else None
        items.append({"id": item_id, "name": title, "icon_url": icon})
    return items

# ── Supabase upsert ───────────────────────────────────────────────────────────

def upsert_items(client, rows: list[dict]) -> None:
    for i in range(0, len(rows), SUPABASE_BATCH):
        chunk = rows[i : i + SUPABASE_BATCH]
        client.table("items").upsert(chunk, on_conflict="id").execute()
        print(f"    ✓  {len(chunk)} filas")

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit",   type=int, default=0,
                        help="Limitar a N páginas del wiki (para pruebas)")
    args = parser.parse_args()

    ge_ids = fetch_ge_ids()

    client = None
    if not args.dry_run:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            sys.exit("❌  Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY")
        client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print(f"\n🌐 Recorriendo Category:Items del wiki OSRS…")

    buf:       list[str]  = []   # títulos acumulados para el próximo batch
    to_insert: list[dict] = []
    skipped_ge    = 0
    skipped_no_id = 0
    pages_seen    = 0

    def flush():
        nonlocal skipped_ge, skipped_no_id
        wt_map = fetch_wikitext_batch(buf)
        time.sleep(DELAY)
        for title, wikitext in wt_map.items():
            parsed = parse_items(title, wikitext)
            if not parsed:
                skipped_no_id += 1
                continue
            for item in parsed:
                if item["id"] in ge_ids:
                    skipped_ge += 1
                else:
                    to_insert.append(item)
                    if args.dry_run:
                        print(f"  ＋ [{item['id']:>6}] {item['name']}")
        buf.clear()

    for title in iter_category_pages("Items"):
        pages_seen += 1
        if args.limit and pages_seen > args.limit:
            break
        buf.append(title)
        if len(buf) >= WIKI_BATCH:
            flush()

    if buf:
        flush()

    total = len(to_insert)
    print(f"\n{'─'*60}")
    print(f"  Páginas procesadas  : {pages_seen:,}")
    print(f"  Sin infobox / sin ID: {skipped_no_id:,}")
    print(f"  Ya en GE (omitidos) : {skipped_ge:,}")
    print(f"  Nuevos ítems        : {total:,}")

    if args.dry_run:
        print("\n[dry-run] No se escribió nada en Supabase.")
        return

    # Deduplicar por ID (un mismo ID puede aparecer en varias páginas del wiki)
    seen: set[int] = set()
    deduped: list[dict] = []
    for item in to_insert:
        if item["id"] not in seen:
            seen.add(item["id"])
            deduped.append(item)
    to_insert = deduped
    total = len(to_insert)

    if not to_insert:
        print("\n✅  Nada nuevo que insertar.")
        return

    print(f"\n💾 Insertando {total:,} ítems únicos en Supabase…")
    upsert_items(client, to_insert)
    print(f"\n✅  Listo — {total:,} ítems no-tradeables sincronizados.")


if __name__ == "__main__":
    main()
