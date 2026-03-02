"""
sync_osrs.py — Carga y sincronización incremental de ítems y skills de OSRS en Supabase.

Fuente de datos:
  - Ítems: https://prices.runescape.wiki/api/v1/mapping  (todos los ítems del GE)
  - Skills: lista estática (los 23 skills de OSRS no cambian salvo actualizaciones mayores)

Estrategia:
  - Primera ejecución: inserta todo.
  - Ejecuciones siguientes: inserta nuevos ítems y actualiza solo los que
    tengan cambios en sus stats (lowalch, highalch, value, limit_ge, etc.).
  - Usa la service_role key de Supabase para saltar Row Level Security.

Uso:
  1. Copia .env.example a .env y completa tus credenciales.
  2. Activa el venv: source venv/bin/activate
  3. Instala deps:   pip install -r requirements.txt
  4. Ejecuta:        python sync_osrs.py
"""

import hashlib
import json
import os
import sys
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client, Client

# ── Configuración ─────────────────────────────────────────────────────────────

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

OSRS_MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping"
OSRS_WIKI_ICON_BASE = "https://oldschool.runescape.wiki/images"

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


def icon_to_url(icon: str) -> str:
    """Convierte el nombre de icono a URL de la OSRS Wiki."""
    return f"{OSRS_WIKI_ICON_BASE}/{icon.replace(' ', '_')}"


def item_hash(item: dict) -> str:
    """Hash de los campos que nos interesan detectar si cambian."""
    key = json.dumps({
        "name":     item.get("name"),
        "examine":  item.get("examine"),
        "members":  item.get("members"),
        "lowalch":  item.get("lowalch"),
        "highalch": item.get("highalch"),
        "limit_ge": item.get("limit"),    # campo en la API se llama "limit"
        "value":    item.get("value"),
        "icon":     item.get("icon"),
    }, sort_keys=True)
    return hashlib.md5(key.encode()).hexdigest()


def batches(lst: list, size: int):
    for i in range(0, len(lst), size):
        yield lst[i : i + size]

# ── Lógica principal ──────────────────────────────────────────────────────────

def fetch_osrs_items() -> list[dict]:
    log("Descargando ítems desde OSRS Wiki...")
    resp = requests.get(OSRS_MAPPING_URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    log(f"  → {len(data):,} ítems descargados")
    return data


def build_row(raw: dict) -> dict:
    icon = raw.get("icon", "")
    return {
        "id":       raw["id"],
        "name":     raw.get("name", ""),
        "examine":  raw.get("examine"),
        "icon":     icon,
        "icon_url": icon_to_url(icon) if icon else None,
        "members":  bool(raw.get("members", False)),
        "lowalch":  raw.get("lowalch"),
        "highalch": raw.get("highalch"),
        "limit_ge": raw.get("limit"),
        "value":    raw.get("value"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def sync_items(sb: Client, raw_items: list[dict]) -> None:
    log("Comparando con Supabase...")

    # Traer todos los IDs ya existentes con sus hashes simulados
    # (traemos los campos relevantes para comparar)
    existing_map: dict[int, dict] = {}
    page = 0
    while True:
        rows = (
            sb.table("items")
            .select("id,name,examine,members,lowalch,highalch,limit_ge,value,icon")
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
    new_count = 0
    changed_count = 0

    for raw in raw_items:
        row = build_row(raw)
        existing = existing_map.get(row["id"])

        if existing is None:
            to_upsert.append(row)
            new_count += 1
        else:
            # Comparar campos relevantes
            changed = (
                existing.get("name")     != row["name"]     or
                existing.get("examine")  != row["examine"]  or
                existing.get("members")  != row["members"]  or
                existing.get("lowalch")  != row["lowalch"]  or
                existing.get("highalch") != row["highalch"] or
                existing.get("limit_ge") != row["limit_ge"] or
                existing.get("value")    != row["value"]    or
                existing.get("icon")     != row["icon"]
            )
            if changed:
                to_upsert.append(row)
                changed_count += 1

    log(f"  → {new_count:,} nuevos · {changed_count:,} con cambios · {len(raw_items) - new_count - changed_count:,} sin cambios")

    if not to_upsert:
        log("  ✓ Sin cambios que aplicar en ítems")
        return

    log(f"Subiendo {len(to_upsert):,} filas en lotes de {BATCH_SIZE}...")
    done = 0
    for batch in batches(to_upsert, BATCH_SIZE):
        sb.table("items").upsert(batch, on_conflict="id").execute()
        done += len(batch)
        log(f"  → {done:,}/{len(to_upsert):,} subidos")

    log(f"  ✓ Ítems sincronizados: {new_count} nuevos, {changed_count} actualizados")


def sync_skills(sb: Client) -> None:
    log("Sincronizando skills...")
    existing = {r["name"] for r in sb.table("skills").select("name").execute().data}
    new_skills = [s for s in OSRS_SKILLS if s["name"] not in existing]

    if not new_skills:
        log(f"  ✓ Los {len(OSRS_SKILLS)} skills ya existen, nada que hacer")
        return

    sb.table("skills").insert(new_skills).execute()
    log(f"  ✓ {len(new_skills)} skills insertados")


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

    raw_items = fetch_osrs_items()
    sync_items(sb, raw_items)
    sync_skills(sb)
    sync_quests(sb)

    log("=== Sincronización completada ✓ ===")


if __name__ == "__main__":
    main()
