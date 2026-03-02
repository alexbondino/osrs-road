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


def main() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env")
        sys.exit(1)

    log("=== OSRS Road — Sincronización de datos ===")
    sb: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    raw_items = fetch_osrs_items()
    sync_items(sb, raw_items)
    sync_skills(sb)

    log("=== Sincronización completada ✓ ===")


if __name__ == "__main__":
    main()
