"""
Balance Center Bridge - Adapter for STNH Techtree Project

This module provides a lightweight adapter layer to use the Balance Center
parser infrastructure without creating tight coupling with the techtree project.

The bridge allows us to:
- Access GameDataRepository for comprehensive tech data
- Use TechnologyParser with modifiers and unlocks extraction
- Leverage FactionDetector for faction mapping
- Use LocLoader for localization

All while maintaining separation from the Balance Center codebase.
"""

import sys
from pathlib import Path
import json

# Add Balance Center to Python path
BALANCE_CENTER_ROOT = Path(r"C:\Users\marcj\git01\New-Horizons-Development\balance_center")

if not BALANCE_CENTER_ROOT.exists():
    raise FileNotFoundError(
        f"Balance Center not found at: {BALANCE_CENTER_ROOT}\n"
        f"Please ensure the STNH mod repository is cloned to git01."
    )

sys.path.insert(0, str(BALANCE_CENTER_ROOT))

try:
    from engine.game_data_repository import GameDataRepository
    from engine.parsers.faction_detector import FactionDetector
    from engine.localization_loader import LocLoader
except ImportError as e:
    raise ImportError(
        f"Failed to import Balance Center modules: {e}\n"
        f"Please ensure Balance Center is properly set up in git01."
    )


class BalanceCenterBridge:
    """
    Lightweight adapter for Balance Center functionality.

    Provides:
    - GameDataRepository access
    - TechnologyParser with faction detection
    - LocLoader for localization
    - Output transformation to website JSON format
    """

    def __init__(self, mod_root):
        """
        Initialize the Balance Center Bridge.

        Args:
            mod_root: Path to STNH mod root directory
        """
        self.mod_root = Path(mod_root)

        if not self.mod_root.exists():
            raise FileNotFoundError(f"Mod root not found: {self.mod_root}")

        print(f"Initializing Balance Center Bridge...")
        print(f"  Mod root: {self.mod_root}")

        # Initialize GameDataRepository
        print(f"  Loading GameDataRepository...")
        self.repository = GameDataRepository(self.mod_root)

        # Initialize LocLoader
        loc_path = self.mod_root / 'localisation' / 'english'
        print(f"  Loading LocLoader from: {loc_path}")
        self.loc_loader = LocLoader(loc_path)

        print(f"[OK] Balance Center Bridge initialized successfully")

    def get_all_technologies_with_metadata(self):
        """
        Extract ALL tech data using Balance Center parsers.

        Returns:
            Dict with structure:
            {
                'technologies': [...],  # Full tech objects with modifiers/unlocks
                'factions': [...],      # Faction list
                'faction_mappings': {}  # Tech -> Factions mapping
            }
        """
        print(f"\n{'='*60}")
        print(f"Extracting technology data from Balance Center...")
        print(f"{'='*60}")

        # Get technologies with full parsing (modifiers, unlocks, etc.)
        # Note: TechnologyParser already extracts modifiers and unlocks during parsing
        print(f"Loading technologies...")
        techs = self.repository.get_technologies()
        print(f"  [OK] Loaded {len(techs)} technologies")

        # Get faction detector
        faction_detector = self.repository.faction_detector

        # Get all factions
        print(f"Detecting factions...")
        factions = faction_detector.get_all_factions()
        print(f"  [OK] Found {len(factions)} factions: {', '.join(sorted(factions))}")

        # Get faction mappings
        print(f"Loading faction mappings...")
        faction_mappings = faction_detector.faction_mappings
        print(f"  [OK] Loaded faction mapping data")

        print(f"{'='*60}\n")

        return {
            'technologies': techs,
            'factions': list(factions),
            'faction_mappings': faction_mappings
        }

    def get_localization(self, key, default=""):
        """
        Get localized string for a key.

        Args:
            key: Localization key (e.g., 'tech_physics_11282')
            default: Default value if key not found

        Returns:
            Localized string or default
        """
        return self.loc_loader.get(key, default)


def test_bridge():
    """Test function to verify Balance Center Bridge works"""
    from config import STNH_MOD_ROOT

    print("Testing Balance Center Bridge...")
    print(f"Using mod root: {STNH_MOD_ROOT}")

    try:
        bridge = BalanceCenterBridge(STNH_MOD_ROOT)
        data = bridge.get_all_technologies_with_metadata()

        print(f"\n[SUCCESS] Bridge test successful!")
        print(f"  Technologies: {len(data['technologies'])}")
        print(f"  Factions: {len(data['factions'])}")

        # Show sample tech
        if data['technologies']:
            sample = data['technologies'][0]
            print(f"\n  Sample tech:")
            print(f"    ID: {sample.get('name', 'N/A')}")
            print(f"    Area: {sample.get('area', 'N/A')}")
            print(f"    Tier: {sample.get('tier', 'N/A')}")
            print(f"    Has modifiers: {bool(sample.get('modifiers'))}")

        return True

    except Exception as e:
        print(f"\n[ERROR] Bridge test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    test_bridge()
