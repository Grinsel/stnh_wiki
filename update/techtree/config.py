"""
Configuration file for STNH Techtree Update Scripts (Wiki Copy)

This configuration allows the update scripts to:
- Run from git10/stnh_wiki/update/techtree/
- Read mod data from git01/New-Horizons-Development/ (READ-ONLY)
- Write generated JSONs to git10/stnh_wiki/assets/tech/

NOTE: This is the Wiki copy. git09/stnh_techtree_interactive remains untouched.
"""

import os
from pathlib import Path

# ==========================================
# PATH CONFIGURATION
# ==========================================

# STNH Mod Source Directory (READ-ONLY)
# This is where the original mod files are located
STNH_MOD_ROOT = r"C:\Users\marcj\git01\New-Horizons-Development"

# Wiki Project Root Directory
WIKI_ROOT = r"C:\Users\marcj\git10\stnh_wiki"

# ==========================================
# DERIVED PATHS (AUTO-CALCULATED)
# ==========================================

# Mod Data Paths (SOURCE - READ-ONLY)
MOD_TECHNOLOGY_DIR = os.path.join(STNH_MOD_ROOT, "common", "technology")
MOD_LOCALISATION_DIR = os.path.join(STNH_MOD_ROOT, "localisation", "english")

# Output Paths (DESTINATION - WRITE)
OUTPUT_ASSETS_DIR = os.path.join(WIKI_ROOT, "assets", "tech")
OUTPUT_ROOT_DIR = WIKI_ROOT  # For tech_localisation_map.json, tech_trigger_map.json

# ==========================================
# FILE FILTERS
# ==========================================

# Which technology files to process
# Set to None to process all .txt files
# Set to lambda: filter function to customize
TECH_FILE_FILTER = lambda filename: "sth" in filename and filename.endswith('.txt')

# Localisation file pattern
LOCALISATION_FILE_PATTERN = "*_l_english.yml"

# ==========================================
# BALANCE CENTER INTEGRATION (Phase 1)
# ==========================================

# Balance Center Root Directory (for advanced parsing)
BALANCE_CENTER_ROOT = r"C:\Users\marcj\git01\balance_center\balance_center"

# Toggle to use Balance Center parsers vs simple parsers
# Set to False to fall back to simple regex-based parsing
USE_BALANCE_CENTER = True

# ==========================================
# VALIDATION
# ==========================================

def validate_paths():
    """
    Validates that all configured paths exist.
    Raises FileNotFoundError if critical paths are missing.
    """
    errors = []

    # Check source paths (must exist)
    if not os.path.exists(STNH_MOD_ROOT):
        errors.append(f"STNH Mod root not found: {STNH_MOD_ROOT}")

    if not os.path.exists(MOD_TECHNOLOGY_DIR):
        errors.append(f"Technology directory not found: {MOD_TECHNOLOGY_DIR}")

    if not os.path.exists(MOD_LOCALISATION_DIR):
        errors.append(f"Localisation directory not found: {MOD_LOCALISATION_DIR}")

    # Check destination paths (create if missing)
    if not os.path.exists(OUTPUT_ASSETS_DIR):
        print(f"Creating output assets directory: {OUTPUT_ASSETS_DIR}")
        os.makedirs(OUTPUT_ASSETS_DIR, exist_ok=True)

    if errors:
        raise FileNotFoundError("\n".join(errors))

    return True

# ==========================================
# HELPER FUNCTIONS
# ==========================================

def get_tech_files():
    """
    Returns list of technology files to process.
    """
    if not os.path.exists(MOD_TECHNOLOGY_DIR):
        return []

    files = os.listdir(MOD_TECHNOLOGY_DIR)

    if TECH_FILE_FILTER:
        files = [f for f in files if TECH_FILE_FILTER(f)]

    return files

def get_localisation_files():
    """
    Returns list of localisation files to process.
    """
    if not os.path.exists(MOD_LOCALISATION_DIR):
        return []

    from glob import glob
    pattern = os.path.join(MOD_LOCALISATION_DIR, LOCALISATION_FILE_PATTERN)
    return glob(pattern)

# ==========================================
# INFO DISPLAY
# ==========================================

def print_config():
    """
    Prints current configuration for debugging.
    """
    print("=" * 60)
    print("STNH Techtree Data Processing - Configuration")
    print("=" * 60)
    print(f"\nMod Source (READ-ONLY):")
    print(f"  Root: {STNH_MOD_ROOT}")
    print(f"  Tech: {MOD_TECHNOLOGY_DIR}")
    print(f"  Loc:  {MOD_LOCALISATION_DIR}")
    print(f"\nOutput Destination (WRITE):")
    print(f"  Assets: {OUTPUT_ASSETS_DIR}")
    print(f"  Root:   {OUTPUT_ROOT_DIR}")
    print(f"\nFiles to Process:")
    tech_files = get_tech_files()
    loc_files = get_localisation_files()
    print(f"  Technology files: {len(tech_files)}")
    print(f"  Localisation files: {len(loc_files)}")
    print("=" * 60)

# ==========================================
# AUTO-VALIDATION ON IMPORT
# ==========================================

if __name__ == "__main__":
    # When run directly, print config and validate
    try:
        validate_paths()
        print_config()
        print("\n[OK] Configuration validated successfully!")
    except Exception as e:
        print(f"\n[ERROR] Configuration validation failed:")
        print(f"        {e}")
        exit(1)
else:
    # When imported, just validate silently
    try:
        validate_paths()
    except Exception as e:
        print(f"[WARNING] Configuration validation failed: {e}")
