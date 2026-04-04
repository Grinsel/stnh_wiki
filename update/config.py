"""
Configuration for STNH Wiki Data Pipeline

Reads mod data from git01/New-Horizons-Development/ (READ-ONLY)
Writes generated data to git10/stnh_wiki/assets/
"""

import os
from pathlib import Path

# ==========================================
# PATH CONFIGURATION
# ==========================================

STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"
WIKI_ROOT = r"C:\Users\marcj\git10\stnh_wiki"
VANILLA_ROOT = r"C:\Program Files (x86)\Steam\steamapps\common\Stellaris"

# ==========================================
# SOURCE PATHS (READ-ONLY) - Core
# ==========================================

MOD_EVENTS_DIR = os.path.join(STNH_MOD_ROOT, "events")
MOD_LOCALISATION_DIR = os.path.join(STNH_MOD_ROOT, "localisation")
MOD_ON_ACTIONS_DIR = os.path.join(STNH_MOD_ROOT, "common", "on_actions")
MOD_EVENT_CHAINS_DIR = os.path.join(STNH_MOD_ROOT, "common", "event_chains")
MOD_INTERFACE_DIR = os.path.join(STNH_MOD_ROOT, "interface")
MOD_GFX_EVENT_PICTURES = os.path.join(STNH_MOD_ROOT, "gfx", "event_pictures")
MOD_GFX_BUILDINGS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "buildings")
MOD_GFX_TRAITS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "traits")
MOD_GFX_TRADITIONS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "traditions")
MOD_GFX_ASCENSION_PERKS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "ascension_perks")
MOD_GFX_CIVICS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "governments", "civics")
MOD_GFX_AUTHORITIES_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "governments", "authorities")
MOD_GFX_JOBS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "jobs")
MOD_GFX_DEPOSITS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "deposits")
MOD_GFX_RELICS_ICONS = os.path.join(STNH_MOD_ROOT, "gfx", "interface", "icons", "relics")

# Flag source directories (contain category subfolders: trek/, human/, etc.)
MOD_FLAGS_DIR = os.path.join(STNH_MOD_ROOT, "flags")
VANILLA_FLAGS_DIR = os.path.join(VANILLA_ROOT, "flags")

# ==========================================
# SOURCE PATHS (READ-ONLY) - Vanilla Stellaris
# ==========================================

VANILLA_INTERFACE_DIR = os.path.join(VANILLA_ROOT, "interface")
VANILLA_GFX_EVENT_PICTURES = os.path.join(VANILLA_ROOT, "gfx", "event_pictures")
VANILLA_GFX_BUILDINGS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "buildings")
VANILLA_GFX_TRAITS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "traits")
VANILLA_GFX_TRADITIONS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "traditions")
VANILLA_GFX_ASCENSION_PERKS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "ascension_perks")
VANILLA_GFX_CIVICS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "governments", "civics")
VANILLA_GFX_AUTHORITIES_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "governments", "authorities")
VANILLA_GFX_JOBS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "jobs")
VANILLA_GFX_DEPOSITS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "deposits")
VANILLA_GFX_RELICS_ICONS = os.path.join(VANILLA_ROOT, "gfx", "interface", "icons", "relics")
VANILLA_LOCALISATION_DIR = os.path.join(VANILLA_ROOT, "localisation")
VANILLA_BUILDINGS_DIR = os.path.join(VANILLA_ROOT, "common", "buildings")

# ==========================================
# SOURCE PATHS (READ-ONLY) - Future Phases
# ==========================================

MOD_TECHNOLOGY_DIR = os.path.join(STNH_MOD_ROOT, "common", "technology")
MOD_SHIP_SIZES_DIR = os.path.join(STNH_MOD_ROOT, "common", "ship_sizes")
MOD_COMPONENT_TEMPLATES_DIR = os.path.join(STNH_MOD_ROOT, "common", "component_templates")
MOD_BUILDINGS_DIR = os.path.join(STNH_MOD_ROOT, "common", "buildings")
MOD_TRAITS_DIR = os.path.join(STNH_MOD_ROOT, "common", "traits")
MOD_GOVERNMENTS_DIR = os.path.join(STNH_MOD_ROOT, "common", "governments")
MOD_MEGASTRUCTURES_DIR = os.path.join(STNH_MOD_ROOT, "common", "megastructures")
MOD_ANOMALIES_DIR = os.path.join(STNH_MOD_ROOT, "common", "anomalies")
MOD_DEPOSITS_DIR = os.path.join(STNH_MOD_ROOT, "common", "deposits")
MOD_DECISIONS_DIR = os.path.join(STNH_MOD_ROOT, "common", "decisions")
MOD_DISTRICTS_DIR = os.path.join(STNH_MOD_ROOT, "common", "districts")
MOD_TRADITIONS_DIR = os.path.join(STNH_MOD_ROOT, "common", "traditions")
MOD_ASCENSION_PERKS_DIR = os.path.join(STNH_MOD_ROOT, "common", "ascension_perks")
MOD_EDICTS_DIR = os.path.join(STNH_MOD_ROOT, "common", "edicts")
MOD_POLICIES_DIR = os.path.join(STNH_MOD_ROOT, "common", "policies")
MOD_CIVICS_DIR = os.path.join(STNH_MOD_ROOT, "common", "governments", "civics")
MOD_AUTHORITIES_DIR = os.path.join(STNH_MOD_ROOT, "common", "governments", "authorities")
MOD_RELICS_DIR = os.path.join(STNH_MOD_ROOT, "common", "relics")
MOD_ARCHAEOLOGICAL_SITES_DIR = os.path.join(STNH_MOD_ROOT, "common", "archaeological_site_types")
MOD_PRESCRIPTED_COUNTRIES_DIR = os.path.join(STNH_MOD_ROOT, "prescripted_countries")
MOD_SPECIES_CLASSES_DIR = os.path.join(STNH_MOD_ROOT, "common", "species_classes")
MOD_JOBS_DIR = os.path.join(STNH_MOD_ROOT, "common", "pop_jobs")
MOD_ARMIES_DIR = os.path.join(STNH_MOD_ROOT, "common", "armies")
MOD_SHIP_MODELS_DIR = os.path.join(STNH_MOD_ROOT, "gfx", "models", "ships")
MOD_SECTION_TEMPLATES_DIR = os.path.join(STNH_MOD_ROOT, "common", "section_templates")

# ==========================================
# OUTPUT PATHS (WRITE)
# ==========================================

OUTPUT_ASSETS_DIR = os.path.join(WIKI_ROOT, "assets")
OUTPUT_EVENTS_DETAIL_DIR = os.path.join(OUTPUT_ASSETS_DIR, "events_detail")
OUTPUT_LOCALISATION_DIR = os.path.join(OUTPUT_ASSETS_DIR, "localisation")
OUTPUT_PICTURES_DIR = os.path.join(WIKI_ROOT, "pictures")
OUTPUT_ICONS_DIR = os.path.join(WIKI_ROOT, "icons")
OUTPUT_MODELS_DIR = os.path.join(WIKI_ROOT, "models")

# ==========================================
# LANGUAGES
# ==========================================

LANGUAGES = [
    "english",
    "german",
    "french",
    "spanish",
    "russian",
    "polish",
    "braz_por",
]

LANGUAGE_SUFFIXES = {
    "english": "l_english",
    "german": "l_german",
    "french": "l_french",
    "spanish": "l_spanish",
    "russian": "l_russian",
    "polish": "l_polish",
    "braz_por": "l_braz_por",
}

# ==========================================
# EVENT TYPES
# ==========================================

EVENT_TYPES = [
    "country_event",
    "planet_event",
    "fleet_event",
    "ship_event",
    "pop_event",
    "observer_event",
    "situation_event",
]

# ==========================================
# VALIDATION
# ==========================================

def validate_paths():
    errors = []
    if not os.path.exists(STNH_MOD_ROOT):
        errors.append(f"STNH Mod root not found: {STNH_MOD_ROOT}")
    if not os.path.exists(MOD_LOCALISATION_DIR):
        errors.append(f"Localisation directory not found: {MOD_LOCALISATION_DIR}")
    if not os.path.exists(MOD_INTERFACE_DIR):
        errors.append(f"Interface directory not found: {MOD_INTERFACE_DIR}")

    # Create output dirs
    for d in [OUTPUT_ASSETS_DIR, OUTPUT_EVENTS_DETAIL_DIR, OUTPUT_LOCALISATION_DIR,
              OUTPUT_PICTURES_DIR, OUTPUT_ICONS_DIR, OUTPUT_MODELS_DIR]:
        os.makedirs(d, exist_ok=True)

    if errors:
        raise FileNotFoundError("\n".join(errors))
    return True


def print_config():
    print("=" * 60)
    print("STNH Wiki - Configuration")
    print("=" * 60)
    print(f"\nMod Source (READ-ONLY):")
    print(f"  Root:       {STNH_MOD_ROOT}")
    print(f"  Events:     {MOD_EVENTS_DIR}")
    print(f"  Loc:        {MOD_LOCALISATION_DIR}")
    print(f"  On-Actions: {MOD_ON_ACTIONS_DIR}")
    print(f"  Chains:     {MOD_EVENT_CHAINS_DIR}")
    print(f"  Interface:  {MOD_INTERFACE_DIR}")
    print(f"\nOutput (WRITE):")
    print(f"  Assets:     {OUTPUT_ASSETS_DIR}")
    print(f"  Pictures:   {OUTPUT_PICTURES_DIR}")
    print(f"  Icons:      {OUTPUT_ICONS_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    try:
        validate_paths()
        print_config()
        print("\n[OK] Configuration validated successfully!")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        exit(1)
