"""
sync_osrs.py — Carga y sincronización incremental de ítems y skills de OSRS en Supabase.

Fuente de datos:
  - Ítems: OSRS Wiki (generator=embeddedin sobre Template:Infobox Item)
           Cubre TODOS los ítems del juego: tradeables y no-tradeables.
  - Stats GE: https://prices.runescape.wiki/api/v1/osrs/mapping
              Enriquece los ítems tradeables con lowalch, highalch, etc.
  - Skills / Quests / Diaries: listas estáticas.

Estrategia:
  - Primera ejecución: inserta todo.
  - Ejecuciones siguientes: inserta nuevos ítems y actualiza solo los que
    tengan cambios detectados.
  - Usa la service_role key de Supabase para saltar Row Level Security.

Uso:
  1. Copia .env.example a .env y completa tus credenciales.
  2. Activa el venv: source venv/bin/activate
  3. Instala deps:   pip install -r requirements.txt
  4. Ejecuta:        python sync_osrs.py
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Configuración ─────────────────────────────────────────────────────────────

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

OSRS_MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping"
OSRS_WIKI_ICON_BASE = "https://oldschool.runescape.wiki/images"
WIKI_API = "https://oldschool.runescape.wiki/api.php"

WIKI_PAGE_LIMIT = 50    # páginas por request al wiki (máximo permitido)
WIKI_DELAY     = 0.25   # segundos entre requests
WIKI_RETRIES   = 3      # reintentos en timeout

RE_INFOBOX = re.compile(r'\{\{Infobox Item', re.IGNORECASE)
RE_ID      = re.compile(r'\|\s*id\d*\s*=\s*(\d+)', re.IGNORECASE)
RE_IMAGE   = re.compile(r'\|\s*image\d*\s*=\s*\[\[File:([^\|\]\n]+\.png)\]\]', re.IGNORECASE)

HEADERS = {
    "User-Agent": "osrs-road-sync/1.0 (https://github.com/alexbondino/osrs-road)"
}

BATCH_SIZE = 500  # filas por upsert

# Skills estáticos de OSRS (raramente cambian)
OSRS_SKILLS = [
    {"name": "Attack",        "icon_url": f"{OSRS_WIKI_ICON_BASE}/Attack_icon.png",        "max_level": 99},
    {"name": "Hitpoints",     "icon_url": f"{OSRS_WIKI_ICON_BASE}/Hitpoints_icon.png",     "max_level": 99},
    {"name": "Mining",        "icon_url": f"{OSRS_WIKI_ICON_BASE}/Mining_icon.png",        "max_level": 99},
    {"name": "Strength",      "icon_url": f"{OSRS_WIKI_ICON_BASE}/Strength_icon.png",      "max_level": 99},
    {"name": "Agility",       "icon_url": f"{OSRS_WIKI_ICON_BASE}/Agility_icon.png",       "max_level": 99},
    {"name": "Smithing",      "icon_url": f"{OSRS_WIKI_ICON_BASE}/Smithing_icon.png",      "max_level": 99},
    {"name": "Defence",       "icon_url": f"{OSRS_WIKI_ICON_BASE}/Defence_icon.png",       "max_level": 99},
    {"name": "Herblore",      "icon_url": f"{OSRS_WIKI_ICON_BASE}/Herblore_icon.png",      "max_level": 99},
    {"name": "Fishing",       "icon_url": f"{OSRS_WIKI_ICON_BASE}/Fishing_icon.png",       "max_level": 99},
    {"name": "Ranged",        "icon_url": f"{OSRS_WIKI_ICON_BASE}/Ranged_icon.png",        "max_level": 99},
    {"name": "Thieving",      "icon_url": f"{OSRS_WIKI_ICON_BASE}/Thieving_icon.png",      "max_level": 99},
    {"name": "Cooking",       "icon_url": f"{OSRS_WIKI_ICON_BASE}/Cooking_icon.png",       "max_level": 99},
    {"name": "Prayer",        "icon_url": f"{OSRS_WIKI_ICON_BASE}/Prayer_icon.png",        "max_level": 99},
    {"name": "Crafting",      "icon_url": f"{OSRS_WIKI_ICON_BASE}/Crafting_icon.png",      "max_level": 99},
    {"name": "Firemaking",    "icon_url": f"{OSRS_WIKI_ICON_BASE}/Firemaking_icon.png",    "max_level": 99},
    {"name": "Magic",         "icon_url": f"{OSRS_WIKI_ICON_BASE}/Magic_icon.png",         "max_level": 99},
    {"name": "Fletching",     "icon_url": f"{OSRS_WIKI_ICON_BASE}/Fletching_icon.png",     "max_level": 99},
    {"name": "Woodcutting",   "icon_url": f"{OSRS_WIKI_ICON_BASE}/Woodcutting_icon.png",   "max_level": 99},
    {"name": "Runecraft",     "icon_url": f"{OSRS_WIKI_ICON_BASE}/Runecraft_icon.png",     "max_level": 99},
    {"name": "Slayer",        "icon_url": f"{OSRS_WIKI_ICON_BASE}/Slayer_icon.png",        "max_level": 99},
    {"name": "Farming",       "icon_url": f"{OSRS_WIKI_ICON_BASE}/Farming_icon.png",       "max_level": 99},
    {"name": "Construction",  "icon_url": f"{OSRS_WIKI_ICON_BASE}/Construction_icon.png",  "max_level": 99},
    {"name": "Hunter",        "icon_url": f"{OSRS_WIKI_ICON_BASE}/Hunter_icon.png",        "max_level": 99},
]

# ── Quests estáticos de OSRS ──────────────────────────────────────────────────
# difficulty: Novice | Intermediate | Experienced | Master | Grandmaster | Special
# icon_url usa la imagen de dificultad del wiki

_D = {
    "Nov": f"{OSRS_WIKI_ICON_BASE}/Quest_difficulty_novice.png",
    "Int": f"{OSRS_WIKI_ICON_BASE}/Quest_difficulty_intermediate.png",
    "Exp": f"{OSRS_WIKI_ICON_BASE}/Quest_difficulty_experienced.png",
    "Mas": f"{OSRS_WIKI_ICON_BASE}/Quest_difficulty_master.png",
    "GM":  f"{OSRS_WIKI_ICON_BASE}/Quest_difficulty_grandmaster.png",
    "Spe": f"{OSRS_WIKI_ICON_BASE}/Miniquest_icon.png",
}

def q(name, diff, members, series=None):
    return {"name": name, "difficulty": diff, "members": members,
            "series": series, "icon_url": _D.get(diff[:3], _D["Nov"])}

OSRS_QUESTS = [
    # ── Free quests ──────────────────────────────────────────────────────────
    q("Cook's Assistant",                      "Novice",       False),
    q("The Restless Ghost",                    "Novice",       False),
    q("Romeo & Juliet",                        "Novice",       False),
    q("Sheep Shearer",                         "Novice",       False),
    q("Ernest the Chicken",                    "Novice",       False),
    q("Goblin Diplomacy",                      "Novice",       False),
    q("Pirates' Treasure",                     "Novice",       False),
    q("Rune Mysteries",                        "Novice",       False),
    q("Misthalin Mystery",                     "Novice",       False),
    q("Imp Catcher",                           "Novice",       False),
    q("Witch's Potion",                        "Novice",       False),
    q("X Marks the Spot",                      "Novice",       False),
    q("Doric's Quest",                         "Novice",       False),
    q("Black Knights' Fortress",               "Intermediate", False),
    q("The Knight's Sword",                    "Intermediate", False),
    q("Vampire Slayer",                        "Intermediate", False),
    q("Demon Slayer",                          "Intermediate", False),
    q("Dragon Slayer I",                       "Experienced",  False),
    # ── P2P – Novice ─────────────────────────────────────────────────────────
    q("Druidic Ritual",                        "Novice",       True),
    q("Hazeel Cult",                           "Novice",       True),
    q("Sheep Herder",                          "Novice",       True),
    q("Plague City",                           "Novice",       True,  "Elf"),
    q("Clock Tower",                           "Novice",       True),
    q("Holy Grail",                            "Intermediate", True,  "Camelot"),
    q("Tree Gnome Village",                    "Intermediate", True,  "Gnome"),
    q("Fight Arena",                           "Intermediate", True),
    q("Waterfall Quest",                       "Intermediate", True),
    q("Jungle Potion",                         "Novice",       True),
    q("The Grand Tree",                        "Intermediate", True,  "Gnome"),
    q("Witch's House",                         "Intermediate", True),
    q("Lost City",                             "Intermediate", True),
    q("Merlin's Crystal",                      "Intermediate", True,  "Camelot"),
    q("Scorpion Catcher",                      "Intermediate", True),
    q("Family Crest",                          "Intermediate", True),
    q("Tribal Totem",                          "Intermediate", True),
    q("Fishing Contest",                       "Novice",       True),
    q("Monk's Friend",                         "Novice",       True),
    q("Temple of Ikov",                        "Intermediate", True),
    q("The Tourist Trap",                      "Intermediate", True),
    q("Watchtower",                            "Intermediate", True),
    q("Dwarf Cannon",                          "Novice",       True),
    q("Murder Mystery",                        "Novice",       True),
    q("The Dig Site",                          "Intermediate", True),
    q("Gertrude's Cat",                        "Novice",       True),
    q("Legends' Quest",                        "Master",       True),
    q("Death Plateau",                         "Intermediate", True,  "Troll"),
    q("Troll Stronghold",                      "Experienced",  True,  "Troll"),
    q("Tai Bwo Wannai Trio",                   "Intermediate", True),
    q("Regicide",                              "Experienced",  True,  "Elf"),
    q("Eadgar's Ruse",                         "Experienced",  True,  "Troll"),
    q("Shilo Village",                         "Intermediate", True),
    q("Underground Pass",                      "Experienced",  True,  "Elf"),
    q("Biohazard",                             "Novice",       True,  "Elf"),
    q("Mourning's End Part I",                 "Experienced",  True,  "Elf"),
    q("Mourning's End Part II",                "Master",       True,  "Elf"),
    q("Roving Elves",                          "Experienced",  True,  "Elf"),
    q("Big Chompy Bird Hunting",               "Intermediate", True),
    q("Elemental Workshop I",                  "Novice",       True),
    q("Elemental Workshop II",                 "Intermediate", True),
    q("Priest in Peril",                       "Intermediate", True,  "Myreque"),
    q("Nature Spirit",                         "Intermediate", True,  "Myreque"),
    q("Start of the Battle of the Mages",      "Novice",       True),
    q("Fairytale I - Growing Pains",           "Intermediate", True,  "Fairy Tale"),
    q("Fairytale II - Cure a Queen",           "Experienced",  True,  "Fairy Tale"),
    q("Ratcatchers",                           "Intermediate", True),
    q("Enlightened Journey",                   "Intermediate", True),
    q("Eagles' Peak",                          "Novice",       True),
    q("Animal Magnetism",                      "Intermediate", True),
    q("Contact!",                              "Intermediate", True),
    q("Cold War",                              "Intermediate", True),
    q("The Fremennik Trials",                  "Intermediate", True,  "Fremennik"),
    q("Grim Tales",                            "Master",       True),
    q("Royal Trouble",                         "Intermediate", True,  "Fremennik"),
    q("Death to the Dorgeshuun",               "Intermediate", True,  "Dorgeshuun"),
    q("More Experienced Deadmining",           "Novice",       True),
    q("In Aid of the Myreque",                 "Intermediate", True,  "Myreque"),
    q("In Search of the Myreque",              "Novice",       True,  "Myreque"),
    q("Creature of Fenkenstrain",              "Intermediate", True,  "Myreque"),
    q("Darkness of Hallowvale",                "Intermediate", True,  "Myreque"),
    q("The Slug Menace",                       "Intermediate", True),
    q("Rum Deal",                              "Experienced",  True),
    q("Swan Song",                             "Master",       True),
    q("One Small Favour",                      "Intermediate", True),
    q("Mountain Daughter",                     "Intermediate", True,  "Fremennik"),
    q("Between a Rock...",                     "Experienced",  True),
    q("The Feud",                              "Intermediate", True),
    q("The Golem",                             "Intermediate", True),
    q("Desert Treasure I",                     "Master",       True),
    q("Icthlarin's Little Helper",             "Intermediate", True),
    q("Spirits of the Elid",                   "Intermediate", True),
    q("Enakhra's Lament",                      "Intermediate", True),
    q("Cabin Fever",                           "Experienced",  True),
    q("Forgettable Tale...",                   "Intermediate", True),
    q("Garden of Tranquillity",                "Intermediate", True),
    q("A Tail of Two Cats",                    "Intermediate", True),
    q("Wanted!",                               "Intermediate", True),
    q("Mourning's End Part I",                 "Experienced",  True,  "Elf"),
    q("Recipe for Disaster",                   "Master",       True),
    q("Skippy and the Mogres",                 "Novice",       True),
    q("Rag and Bone Man I",                    "Novice",       True),
    q("Rag and Bone Man II",                   "Intermediate", True),
    q("Zogre Flesh Eaters",                    "Intermediate", True),
    q("The Great Brain Robbery",               "Experienced",  True),
    q("What Lies Below",                       "Intermediate", True),
    q("Olaf's Quest",                          "Intermediate", True,  "Fremennik"),
    q("Another Slice of H.A.M.",               "Intermediate", True,  "Dorgeshuun"),
    q("Dream Mentor",                          "Master",       True,  "Fremennik"),
    q("Dealing with Scabaras",                 "Intermediate", True),
    q("My Arm's Big Adventure",                "Intermediate", True,  "Troll"),
    q("Lunar Diplomacy",                       "Intermediate", True,  "Fremennik"),
    q("Grim Tales",                            "Master",       True),
    q("A Taste of Hope",                       "Experienced",  True,  "Myreque"),
    q("Getting Ahead",                         "Intermediate", True),
    q("Below Ice Mountain",                    "Novice",       False),
    q("Bone Voyage",                           "Intermediate", True),
    q("The Forsaken Tower",                    "Intermediate", True,  "Kourend"),
    q("Tale of the Righteous",                 "Novice",       True,  "Kourend"),
    q("Architectural Alliance",                "Special",      True,  "Kourend"),
    q("Client of Kourend",                     "Novice",       True,  "Kourend"),
    q("Depths of Despair",                     "Intermediate", True,  "Kourend"),
    q("The Queen of Thieves",                  "Intermediate", True,  "Kourend"),
    q("Song of the Elves",                     "Grandmaster",  True,  "Elf"),
    q("Sin of the Father",                     "Master",       True,  "Myreque"),
    q("A Kingdom Divided",                     "Experienced",  True,  "Kourend"),
    q("The Fremennik Exiles",                  "Master",       True,  "Fremennik"),
    q("Twilight's Promise",                    "Intermediate", True,  "Kourend"),
    q("Sleeping Giants",                       "Intermediate", True),
    q("Desert Treasure II - The Fallen Empire","Grandmaster",  True),
    q("The Path of Glouphrie",                 "Experienced",  True,  "Gnome"),
    q("Children of the Sun",                   "Novice",       True),
    q("Secrets of the North",                  "Master",       True,  "Fremennik"),
    q("Perilous Moons",                        "Intermediate", True),
    q("At First Light",                        "Intermediate", True),
    q("Defender of Varrock",                   "Master",       True),
    q("Natural History Quiz",                  "Special",      False),
    q("Hopespear's Will",                      "Special",      True),
    q("Enter the Abyss",                       "Special",      True),
    q("Alfred Grimhand's Barcrawl",            "Special",      True),
]

# ── Utilidades ────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def icon_to_url(filename: str) -> str:
    """Convierte nombre de archivo de icono a URL de la OSRS Wiki."""
    safe = quote(filename.replace(' ', '_'), safe='()_.~-')
    return f"{OSRS_WIKI_ICON_BASE}/{safe}"


def batches(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]


# ── Fuentes de datos ──────────────────────────────────────────────────────────

def fetch_ge_mapping() -> dict[int, dict]:
    """Descarga el GE mapping → dict keyed by item ID con stats de mercado."""
    log("Descargando GE mapping (ítems tradeables)...")
    resp = requests.get(OSRS_MAPPING_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = {item["id"]: item for item in resp.json()}
    log(f"  → {len(data):,} ítems en el GE mapping")
    return data


def _parse_wiki_page(title: str, wikitext: str) -> list[dict]:
    """Extrae todos los pares (id, image) del wikitext de un ítem."""
    if not RE_INFOBOX.search(wikitext):
        return []
    ids    = [int(m) for m in RE_ID.findall(wikitext)]
    images = RE_IMAGE.findall(wikitext)
    if not ids:
        return []
    result = []
    for i, item_id in enumerate(ids):
        img = images[i] if i < len(images) else (images[0] if images else None)
        result.append({
            "id":   item_id,
            "name": title,
            "icon": img,
        })
    return result


def fetch_all_wiki_items() -> list[dict]:
    """
    Descarga TODOS los ítems del wiki usando generator=embeddedin sobre
    Template:Infobox Item. Combina descubrimiento de páginas + wikitext
    en un único request por lote — cubre tradeables y no-tradeables.
    """
    log("Descargando ítems del wiki OSRS (tradeables + no-tradeables)...")
    params: dict = {
        "action":        "query",
        "generator":     "embeddedin",
        "geititle":      "Template:Infobox Item",
        "geilimit":      str(WIKI_PAGE_LIMIT),
        "prop":          "revisions",
        "rvprop":        "content",
        "rvslots":       "main",
        "format":        "json",
        "formatversion": "2",
    }

    seen_ids: set[int] = set()
    all_items: list[dict] = []
    batch_num = 0

    while True:
        for attempt in range(1, WIKI_RETRIES + 1):
            try:
                resp = requests.get(WIKI_API, params=params, headers=HEADERS, timeout=45)
                resp.raise_for_status()
                break
            except requests.exceptions.Timeout:
                wait = attempt * 5
                log(f"  ⏳ Timeout (intento {attempt}/{WIKI_RETRIES}), reintentando en {wait}s…")
                time.sleep(wait)
        else:
            log("  ⚠  Batch fallido tras varios intentos, continuando…")
            break

        data = resp.json()
        pages = data.get("query", {}).get("pages", [])
        batch_num += 1

        for page in pages:
            revisions = page.get("revisions")
            if not revisions:
                continue
            wikitext = (
                revisions[0].get("slots", {}).get("main", {}).get("content")
                or revisions[0].get("content", "")
            )
            for item in _parse_wiki_page(page["title"], wikitext):
                if item["id"] not in seen_ids:
                    seen_ids.add(item["id"])
                    all_items.append(item)

        if batch_num % 20 == 0:
            log(f"  … {len(all_items):,} ítems únicos encontrados hasta ahora")

        if "continue" not in data:
            break
        params.update(data["continue"])
        time.sleep(WIKI_DELAY)

    log(f"  → {len(all_items):,} ítems únicos extraídos del wiki")
    return all_items


def build_items(wiki_items: list[dict], ge_map: dict[int, dict]) -> list[dict]:
    """
    Combina los ítems del wiki con los stats del GE mapping.
    - Si el ID está en el GE → tradeable=True, enriquece con stats.
    - Si no → tradeable=False, solo nombre e icono.
    """
    now = datetime.now(timezone.utc).isoformat()
    rows = []
    for item in wiki_items:
        item_id = item["id"]
        icon    = item.get("icon") or ""
        ge      = ge_map.get(item_id)

        row: dict = {
            "id":         item_id,
            "name":       item["name"],
            "icon":       icon,
            "icon_url":   icon_to_url(icon) if icon else None,
            "tradeable":  ge is not None,
            "updated_at": now,
        }
        if ge:
            row.update({
                "name":     ge.get("name", item["name"]),  # GE name es canónico
                "examine":  ge.get("examine"),
                "members":  bool(ge.get("members", False)),
                "lowalch":  ge.get("lowalch"),
                "highalch": ge.get("highalch"),
                "limit_ge": ge.get("limit"),
                "value":    ge.get("value"),
            })
        else:
            row.update({
                "examine":  None,
                "members":  False,
                "lowalch":  None,
                "highalch": None,
                "limit_ge": None,
                "value":    None,
            })
        rows.append(row)
    return rows


def sync_items(sb: Client) -> None:
    ge_map    = fetch_ge_mapping()
    wiki_items = fetch_all_wiki_items()
    new_rows  = build_items(wiki_items, ge_map)

    log("Comparando con Supabase...")
    existing_map: dict[int, dict] = {}
    page = 0
    while True:
        rows = (
            sb.table("items")
            .select("id,name,examine,members,lowalch,highalch,limit_ge,value,icon,tradeable")
            .range(page * 1000, page * 1000 + 999)
            .execute()
            .data
        )
        if not rows:
            break
        for r in rows:
            existing_map[r["id"]] = r
        if len(rows) < 1000:
            break
        page += 1

    log(f"  → {len(existing_map):,} ítems ya existen en Supabase")

    to_upsert: list[dict] = []
    new_count = changed_count = 0

    for row in new_rows:
        existing = existing_map.get(row["id"])
        if existing is None:
            to_upsert.append(row)
            new_count += 1
        else:
            changed = (
                existing.get("name")      != row["name"]      or
                existing.get("examine")   != row["examine"]   or
                existing.get("members")   != row["members"]   or
                existing.get("lowalch")   != row["lowalch"]   or
                existing.get("highalch")  != row["highalch"]  or
                existing.get("limit_ge")  != row["limit_ge"]  or
                existing.get("value")     != row["value"]     or
                existing.get("icon")      != row["icon"]      or
                existing.get("tradeable") != row["tradeable"]
            )
            if changed:
                to_upsert.append(row)
                changed_count += 1

    tradeable_total    = sum(1 for r in new_rows if r["tradeable"])
    untradeable_total  = len(new_rows) - tradeable_total
    log(f"  → Wiki: {tradeable_total:,} tradeables + {untradeable_total:,} no-tradeables")
    log(f"  → {new_count:,} nuevos · {changed_count:,} con cambios · {len(new_rows) - new_count - changed_count:,} sin cambios")

    if not to_upsert:
        log("  ✓ Sin cambios que aplicar en ítems")
        return

    log(f"Subiendo {len(to_upsert):,} filas en lotes de {BATCH_SIZE}...")
    done = 0
    for batch in batches(to_upsert, BATCH_SIZE):
        sb.table("items").upsert(batch, on_conflict="id").execute()
        done += len(batch)
        log(f"  → {done:,}/{len(to_upsert):,} subidos")

    log(f"  ✓ Ítems sincronizados: {new_count:,} nuevos, {changed_count:,} actualizados")


def sync_skills(sb: Client) -> None:
    log("Sincronizando skills...")
    existing = {r["name"] for r in sb.table("skills").select("name").execute().data}
    new_skills = [s for s in OSRS_SKILLS if s["name"] not in existing]

    if not new_skills:
        log(f"  ✓ Los {len(OSRS_SKILLS)} skills ya existen, nada que hacer")
        return

    sb.table("skills").insert(new_skills).execute()
    log(f"  ✓ {len(new_skills)} skills insertados")


_DIARY_ICON = "https://oldschool.runescape.wiki/images/Achievement_Diaries.png"

def u(name, _sub, icon):
    """Item no tradeable — va a la tabla items con tradeable=False."""
    return {"name": name, "icon_url": f"{OSRS_WIKI_ICON_BASE}/{icon}"}

OSRS_UNLOCKS = [
    # ── Combat Achievements ──────────────────────────────────────────────────
    u("Combat Achievements: Easy",        "Combat Achievement", "Combat_achievement_icon.png"),
    u("Combat Achievements: Medium",      "Combat Achievement", "Combat_achievement_icon.png"),
    u("Combat Achievements: Hard",        "Combat Achievement", "Combat_achievement_icon.png"),
    u("Combat Achievements: Elite",       "Combat Achievement", "Combat_achievement_icon.png"),
    u("Combat Achievements: Master",      "Combat Achievement", "Combat_achievement_icon.png"),
    u("Combat Achievements: Grandmaster", "Combat Achievement", "Combat_achievement_icon.png"),
    # ── Capes ────────────────────────────────────────────────────────────────
    u("Fire Cape",          "Cape", "Fire_cape.png"),
    u("Infernal Cape",      "Cape", "Infernal_cape.png"),
    u("Cape of Accomplishment", "Cape", "Achievement_diary_cape.png"),
    u("Max Cape",           "Cape", "Max_cape.png"),
    u("Mythical Cape",      "Cape", "Mythical_cape.png"),
    u("Imbued Saradomin Cape",  "Cape", "Imbued_saradomin_cape.png"),
    u("Imbued Guthix Cape",     "Cape", "Imbued_guthix_cape.png"),
    u("Imbued Zamorak Cape",    "Cape", "Imbued_zamorak_cape.png"),
    # ── Defenders ────────────────────────────────────────────────────────────
    u("Dragon Defender",    "Defender", "Dragon_defender.png"),
    u("Avernic Defender",   "Defender", "Avernic_defender.png"),
    u("Crystal Shield",     "Defender", "Crystal_shield.png"),
    # ── Gloves ───────────────────────────────────────────────────────────────
    u("Barrows Gloves",     "Gloves", "Barrows_gloves.png"),
    u("Ferocious Gloves",   "Gloves", "Ferocious_gloves.png"),
    # ── Helmets / Head ───────────────────────────────────────────────────────
    u("Slayer Helmet (i)",  "Helm", "Slayer_helmet_%28i%29.png"),
    u("Neitiznot Faceguard","Helm", "Neitiznot_faceguard.png"),
    u("Serpentine Helm",    "Helm", "Serpentine_helm.png"),
    # ── Void Knight ──────────────────────────────────────────────────────────
    u("Void Knight Top",    "Void", "Void_knight_top.png"),
    u("Void Knight Robe",   "Void", "Void_knight_robe.png"),
    u("Void Knight Gloves", "Void", "Void_knight_gloves.png"),
    u("Void Melee Helm",    "Void", "Void_melee_helm.png"),
    u("Void Mage Helm",     "Void", "Void_mage_helm.png"),
    u("Void Ranger Helm",   "Void", "Void_ranger_helm.png"),
    u("Elite Void Top",     "Void", "Elite_void_top.png"),
    u("Elite Void Robe",    "Void", "Elite_void_robe.png"),
    # ── Barbarian Assault ────────────────────────────────────────────────────
    u("Fighter Torso",      "Minigame", "Fighter_torso.png"),
    u("Fighter Hat",        "Minigame", "Fighter_hat.png"),
    u("Ranger Hat",         "Minigame", "Ranger_hat.png"),
    u("Healer Hat",         "Minigame", "Healer_hat.png"),
    u("Runner Hat",         "Minigame", "Runner_hat.png"),
    # ── Diary rewards ────────────────────────────────────────────────────────
    u("Ardougne Cloak 1",        "Diary Reward", "Ardougne_cloak_1.png"),
    u("Ardougne Cloak 2",        "Diary Reward", "Ardougne_cloak_2.png"),
    u("Ardougne Cloak 3",        "Diary Reward", "Ardougne_cloak_3.png"),
    u("Ardougne Cloak 4",        "Diary Reward", "Ardougne_cloak_4.png"),
    u("Explorer's Ring 1",       "Diary Reward", "Explorer%27s_ring_1.png"),
    u("Explorer's Ring 2",       "Diary Reward", "Explorer%27s_ring_2.png"),
    u("Explorer's Ring 3",       "Diary Reward", "Explorer%27s_ring_3.png"),
    u("Explorer's Ring 4",       "Diary Reward", "Explorer%27s_ring_4.png"),
    u("Falador Shield 1",        "Diary Reward", "Falador_shield_1.png"),
    u("Falador Shield 2",        "Diary Reward", "Falador_shield_2.png"),
    u("Falador Shield 3",        "Diary Reward", "Falador_shield_3.png"),
    u("Falador Shield 4",        "Diary Reward", "Falador_shield_4.png"),
    u("Fremennik Sea Boots 1",   "Diary Reward", "Fremennik_sea_boots_1.png"),
    u("Fremennik Sea Boots 2",   "Diary Reward", "Fremennik_sea_boots_2.png"),
    u("Fremennik Sea Boots 3",   "Diary Reward", "Fremennik_sea_boots_3.png"),
    u("Fremennik Sea Boots 4",   "Diary Reward", "Fremennik_sea_boots_4.png"),
    u("Kandarin Headgear 1",     "Diary Reward", "Kandarin_headgear_1.png"),
    u("Kandarin Headgear 2",     "Diary Reward", "Kandarin_headgear_2.png"),
    u("Kandarin Headgear 3",     "Diary Reward", "Kandarin_headgear_3.png"),
    u("Kandarin Headgear 4",     "Diary Reward", "Kandarin_headgear_4.png"),
    u("Karamja Gloves 1",        "Diary Reward", "Karamja_gloves_1.png"),
    u("Karamja Gloves 2",        "Diary Reward", "Karamja_gloves_2.png"),
    u("Karamja Gloves 3",        "Diary Reward", "Karamja_gloves_3.png"),
    u("Karamja Gloves 4",        "Diary Reward", "Karamja_gloves_4.png"),
    u("Morytania Legs 1",        "Diary Reward", "Morytania_legs_1.png"),
    u("Morytania Legs 2",        "Diary Reward", "Morytania_legs_2.png"),
    u("Morytania Legs 3",        "Diary Reward", "Morytania_legs_3.png"),
    u("Morytania Legs 4",        "Diary Reward", "Morytania_legs_4.png"),
    u("Desert Amulet 1",         "Diary Reward", "Desert_amulet_1.png"),
    u("Desert Amulet 2",         "Diary Reward", "Desert_amulet_2.png"),
    u("Desert Amulet 3",         "Diary Reward", "Desert_amulet_3.png"),
    u("Desert Amulet 4",         "Diary Reward", "Desert_amulet_4.png"),
    u("Western Banner 1",        "Diary Reward", "Western_banner_1.png"),
    u("Western Banner 2",        "Diary Reward", "Western_banner_2.png"),
    u("Western Banner 3",        "Diary Reward", "Western_banner_3.png"),
    u("Western Banner 4",        "Diary Reward", "Western_banner_4.png"),
    u("Varrock Armour 1",        "Diary Reward", "Varrock_armour_1.png"),
    u("Varrock Armour 2",        "Diary Reward", "Varrock_armour_2.png"),
    u("Varrock Armour 3",        "Diary Reward", "Varrock_armour_3.png"),
    u("Varrock Armour 4",        "Diary Reward", "Varrock_armour_4.png"),
    u("Wilderness Sword 1",      "Diary Reward", "Wilderness_sword_1.png"),
    u("Wilderness Sword 2",      "Diary Reward", "Wilderness_sword_2.png"),
    u("Wilderness Sword 3",      "Diary Reward", "Wilderness_sword_3.png"),
    u("Wilderness Sword 4",      "Diary Reward", "Wilderness_sword_4.png"),
    u("Ghommal's Hilt 1",        "Diary Reward", "Ghommal%27s_hilt_1.png"),
    u("Ghommal's Hilt 2",        "Diary Reward", "Ghommal%27s_hilt_2.png"),
    u("Ghommal's Hilt 3",        "Diary Reward", "Ghommal%27s_hilt_3.png"),
    u("Ghommal's Hilt 4",        "Diary Reward", "Ghommal%27s_hilt_4.png"),
    u("Ghommal's Hilt 5",        "Diary Reward", "Ghommal%27s_hilt_5.png"),
    u("Ghommal's Hilt 6",        "Diary Reward", "Ghommal%27s_hilt_6.png"),
    # ── Other key unlocks ─────────────────────────────────────────────────────
    u("Ava's Assembler",         "Ranged",  "Ava%27s_assembler.png"),
    u("Twisted Ancestral Hat",   "Cosmetic", "Twisted_ancestral_hat.png"),
    u("Chambers of Xeric KC",    "Raids",    "Olmlet.png"),
    u("Theatre of Blood KC",     "Raids",    "Lil%27_zik.png"),
    u("Tombs of Amascut KC",     "Raids",    "Tumeken%27s_guardian.png"),
]

def d(area, tier):
    return {"name": f"{area} {tier}", "area": area, "tier": tier, "icon_url": _DIARY_ICON}

OSRS_DIARIES = [
    d("Ardougne",           "Easy"),   d("Ardougne",           "Medium"), d("Ardougne",           "Hard"),   d("Ardougne",           "Elite"),
    d("Desert",             "Easy"),   d("Desert",             "Medium"), d("Desert",             "Hard"),   d("Desert",             "Elite"),
    d("Falador",            "Easy"),   d("Falador",            "Medium"), d("Falador",            "Hard"),   d("Falador",            "Elite"),
    d("Fremennik",          "Easy"),   d("Fremennik",          "Medium"), d("Fremennik",          "Hard"),   d("Fremennik",          "Elite"),
    d("Kandarin",           "Easy"),   d("Kandarin",           "Medium"), d("Kandarin",           "Hard"),   d("Kandarin",           "Elite"),
    d("Karamja",            "Easy"),   d("Karamja",            "Medium"), d("Karamja",            "Hard"),   d("Karamja",            "Elite"),
    d("Kourend & Kebos",    "Easy"),   d("Kourend & Kebos",    "Medium"), d("Kourend & Kebos",    "Hard"),   d("Kourend & Kebos",    "Elite"),
    d("Lumbridge & Draynor","Easy"),   d("Lumbridge & Draynor","Medium"), d("Lumbridge & Draynor","Hard"),   d("Lumbridge & Draynor","Elite"),
    d("Morytania",          "Easy"),   d("Morytania",          "Medium"), d("Morytania",          "Hard"),   d("Morytania",          "Elite"),
    d("Tirannwn",           "Easy"),   d("Tirannwn",           "Medium"), d("Tirannwn",           "Hard"),   d("Tirannwn",           "Elite"),
    d("Varrock",            "Easy"),   d("Varrock",            "Medium"), d("Varrock",            "Hard"),   d("Varrock",            "Elite"),
    d("Western Provinces",  "Easy"),   d("Western Provinces",  "Medium"), d("Western Provinces",  "Hard"),   d("Western Provinces",  "Elite"),
    d("Wilderness",         "Easy"),   d("Wilderness",         "Medium"), d("Wilderness",         "Hard"),   d("Wilderness",         "Elite"),
]


def sync_untradeable_items(sb: Client) -> None:
    log("Sincronizando items no tradeables (unlocks)...")
    existing_names = {r["name"] for r in sb.table("items").select("name").eq("tradeable", False).execute().data}
    existing_ids   = {r["id"]   for r in sb.table("items").select("id").gte("id", 90001).execute().data}

    new_items: list[dict] = []
    next_id = 90001
    for item in OSRS_UNLOCKS:
        if item["name"] not in existing_names:
            while next_id in existing_ids:
                next_id += 1
            new_items.append({
                "id":        next_id,
                "name":      item["name"],
                "icon_url":  item["icon_url"],
                "tradeable": False,
                "members":   False,
            })
            existing_ids.add(next_id)
            next_id += 1

    if not new_items:
        log(f"  ✓ Los {len(OSRS_UNLOCKS)} unlocks ya existen en items, nada que hacer")
        return
    sb.table("items").insert(new_items).execute()
    log(f"  ✓ {len(new_items)} unlocks insertados en items ({len(OSRS_UNLOCKS)} total)")


def sync_diaries(sb: Client) -> None:
    log("Sincronizando diaries...")
    existing = {r["name"] for r in sb.table("diaries").select("name").execute().data}
    new_diaries = [item for item in OSRS_DIARIES if item["name"] not in existing]
    if not new_diaries:
        log(f"  ✓ Los {len(OSRS_DIARIES)} diaries ya existen, nada que hacer")
        return
    sb.table("diaries").insert(new_diaries).execute()
    log(f"  ✓ {len(new_diaries)} diaries insertados ({len(OSRS_DIARIES)} total)")


def sync_quests(sb: Client) -> None:
    log("Sincronizando quests...")
    existing = {r["name"] for r in sb.table("quests").select("name").execute().data}
    # Deduplica la lista estática (puede haber entradas repetidas)
    seen: set[str] = set()
    unique_quests = []
    for quest in OSRS_QUESTS:
        if quest["name"] not in seen:
            seen.add(quest["name"])
            unique_quests.append(quest)

    new_quests = [q for q in unique_quests if q["name"] not in existing]

    if not new_quests:
        log(f"  ✓ Los {len(unique_quests)} quests ya existen, nada que hacer")
        return

    sb.table("quests").insert(new_quests).execute()
    log(f"  ✓ {len(new_quests)} quests insertados ({len(unique_quests)} total)")


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env")
        sys.exit(1)

    log("=== OSRS Road — Sincronización de datos ===")
    sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    sync_items(sb)
    sync_skills(sb)
    sync_quests(sb)
    sync_diaries(sb)
    sync_untradeable_items(sb)

    log("=== Sincronización completada ✓ ===")


if __name__ == "__main__":
    main()
