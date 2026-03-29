"""
Supplemental Tech Parser - Captures techs missed by Balance Center

Balance Center filters out 138 techs from STNH mod (likely due to custom triggers
or non-standard syntax). This parser captures those missing techs with basic parsing.

Used as a supplemental source to ensure 100% tech coverage.
"""

import re
from pathlib import Path
from collections import defaultdict


class SupplementalTechParser:
    def __init__(self, mod_root):
        """
        Initialize Supplemental Tech Parser

        Args:
            mod_root: Path to STNH mod root directory
        """
        self.mod_root = Path(mod_root)
        self.tech_dir = self.mod_root / 'common' / 'technology'

    def parse_all_techs(self):
        """
        Parse all technology files and extract basic tech data

        Returns:
            List of tech dicts with minimal required fields
        """
        print("\n[Supplemental Parser] Scanning technology files...")

        if not self.tech_dir.exists():
            print(f"[ERROR] Technology directory not found: {self.tech_dir}")
            return []

        tech_files = list(self.tech_dir.glob('sth_*.txt'))
        print(f"[Supplemental Parser] Found {len(tech_files)} technology files")

        all_techs = []

        for tech_file in tech_files:
            techs_in_file = self._parse_tech_file(tech_file)
            all_techs.extend(techs_in_file)

        print(f"[Supplemental Parser] Parsed {len(all_techs)} technologies")
        return all_techs

    def _parse_tech_file(self, filepath):
        """Parse a single technology file"""
        techs = []

        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                content = f.read()

            # Remove comments
            content = re.sub(r'#.*?$', '', content, flags=re.MULTILINE)

            # Find all tech definitions: tech_* = {
            tech_pattern = r'^[\s]*(tech_[a-zA-Z0-9_]+)\s*=\s*\{'

            for match in re.finditer(tech_pattern, content, re.MULTILINE):
                tech_id = match.group(1)
                start_pos = match.end() - 1

                # Extract tech block
                tech_block = self._extract_block(content, start_pos)
                if not tech_block:
                    continue

                # Parse tech data
                tech_data = self._parse_tech_block(tech_id, tech_block, filepath.name)
                if tech_data:
                    techs.append(tech_data)

        except Exception as e:
            print(f"[WARNING] Error parsing {filepath.name}: {e}")

        return techs

    def _extract_block(self, content, start_pos):
        """Extract a { ... } block from content starting at position"""
        braces = 0
        pos = start_pos

        while pos < len(content):
            if content[pos] == '{':
                braces += 1
            elif content[pos] == '}':
                braces -= 1
                if braces == 0:
                    return content[start_pos:pos+1]
            pos += 1

        return None

    def _parse_tech_block(self, tech_id, block, source_file):
        """
        Parse a technology block and extract essential data

        Returns minimal tech dict compatible with Balance Center format
        """
        data = {
            'name': tech_id,
            'file_path': str(self.tech_dir / source_file),
            'prerequisites': [],
            'unlocks': [],
            'required_species': [],
            'prereqfor_desc': {},  # NEW: Unlock descriptions
            'direct_modifiers': {},  # NEW: Direct tech modifiers (not from components)
        }

        # Extract area (physics/engineering/society)
        area_match = re.search(r'area\s*=\s*(\w+)', block)
        if area_match:
            data['area'] = area_match.group(1)
        else:
            # Default based on tech_id prefix
            if tech_id.startswith('tech_physics'):
                data['area'] = 'physics'
            elif tech_id.startswith('tech_engineering'):
                data['area'] = 'engineering'
            elif tech_id.startswith('tech_society'):
                data['area'] = 'society'
            else:
                data['area'] = 'unknown'

        # Extract tier
        tier_match = re.search(r'tier\s*=\s*(\d+)', block)
        if tier_match:
            data['tier'] = int(tier_match.group(1))
        else:
            data['tier'] = 1  # Default

        # Extract cost
        cost_match = re.search(r'cost\s*=\s*(\d+)', block)
        if cost_match:
            data['cost'] = int(cost_match.group(1))
        else:
            data['cost'] = 0

        # Extract weight
        weight_match = re.search(r'weight\s*=\s*([\d.]+)', block)
        if weight_match:
            data['weight'] = float(weight_match.group(1))
        else:
            data['weight'] = 1

        # Extract prerequisites
        prereq_match = re.search(r'prerequisites\s*=\s*\{([^}]+)\}', block)
        if prereq_match:
            prereqs_str = prereq_match.group(1)
            # Extract quoted tech IDs
            tech_ids = re.findall(r'"(tech_[a-zA-Z0-9_]+)"', prereqs_str)
            data['prerequisites'] = tech_ids

        # Extract category
        category_match = re.search(r'category\s*=\s*\{([^}]+)\}', block)
        if category_match:
            categories_str = category_match.group(1)
            categories = re.findall(r'(\w+)', categories_str)
            data['category'] = [c for c in categories if c not in ['OR', 'AND', 'NOT']]
        else:
            data['category'] = []

        # Extract flags
        data['is_rare'] = 'is_rare' in block and 'is_rare = yes' in block
        data['is_dangerous'] = 'is_dangerous' in block and 'is_dangerous = yes' in block
        data['is_reverse_engineerable'] = 'is_reverse_engineerable = no' not in block
        data['start_tech'] = 'start_tech' in block and 'start_tech = yes' in block

        # Extract prereqfor_desc (unlocks) - ENHANCED
        prereqfor_match = re.search(r'prereqfor_desc\s*=\s*\{', block)
        if prereqfor_match:
            prereq_start = prereqfor_match.end() - 1
            prereq_block = self._extract_block(block, prereq_start)

            if prereq_block:
                data['prereqfor_desc'] = self._parse_prereqfor_desc(prereq_block)
                data['has_unlocks'] = True
            else:
                data['has_unlocks'] = False
        else:
            data['has_unlocks'] = False

        # Extract direct modifier block (some techs have direct modifiers, not via components)
        modifier_match = re.search(r'^\s+modifier\s*=\s*\{', block, re.MULTILINE)
        if modifier_match:
            mod_start = modifier_match.end() - 1
            mod_block = self._extract_block(block, mod_start)

            if mod_block:
                # Extract key = value pairs
                kv_pattern = r'(\w+)\s*=\s*([-+]?[\d.]+)'
                for kv_match in re.finditer(kv_pattern, mod_block):
                    modifier_key = kv_match.group(1)
                    try:
                        modifier_value = float(kv_match.group(2))
                        data['direct_modifiers'][modifier_key] = modifier_value
                    except ValueError:
                        continue

        return data

    def _parse_prereqfor_desc(self, block):
        """
        Parse prereqfor_desc block to extract unlock information

        Format examples:
        - ship = { title = "KEY" desc = "KEY" }
        - component = "COMPONENT_KEY"
        - building = "BUILDING_KEY"
        - technology = "tech_id"

        Returns:
            Dict with unlock types and their localization keys
        """
        unlocks = {}

        # Extract ship unlocks
        ship_match = re.search(r'ship\s*=\s*\{([^}]+)\}', block)
        if ship_match:
            ship_block = ship_match.group(1)
            title_match = re.search(r'title\s*=\s*"([^"]+)"', ship_block)
            desc_match = re.search(r'desc\s*=\s*"([^"]+)"', ship_block)

            if title_match:
                unlocks['ship'] = {
                    'title_key': title_match.group(1),
                    'desc_key': desc_match.group(1) if desc_match else ''
                }

        # Extract component unlocks
        component_matches = re.findall(r'component\s*=\s*"([^"]+)"', block)
        if component_matches:
            unlocks['components'] = component_matches

        # Extract building unlocks
        building_matches = re.findall(r'building\s*=\s*"([^"]+)"', block)
        if building_matches:
            unlocks['buildings'] = building_matches

        # Extract technology unlocks
        tech_matches = re.findall(r'technology\s*=\s*"([^"]+)"', block)
        if tech_matches:
            unlocks['technologies'] = tech_matches

        # Extract feature unlocks (traits, edicts, etc.)
        feature_match = re.search(r'feature\s*=\s*\{([^}]+)\}', block)
        if feature_match:
            feature_block = feature_match.group(1)
            title_match = re.search(r'title\s*=\s*"([^"]+)"', feature_block)
            desc_match = re.search(r'desc\s*=\s*"([^"]+)"', feature_block)

            if title_match:
                unlocks['feature'] = {
                    'title_key': title_match.group(1),
                    'desc_key': desc_match.group(1) if desc_match else ''
                }

        return unlocks


def test_parser():
    """Test the supplemental parser"""
    from config import STNH_MOD_ROOT

    parser = SupplementalTechParser(STNH_MOD_ROOT)
    techs = parser.parse_all_techs()

    print("\n" + "="*60)
    print("Supplemental Parser Test")
    print("="*60)
    print(f"Total techs parsed: {len(techs)}")

    # Check for our missing tech
    test_tech = next((t for t in techs if t['name'] == 'tech_engineering_industry_1253'), None)
    if test_tech:
        print("\n[SUCCESS] Found tech_engineering_industry_1253:")
        print(f"  Area: {test_tech['area']}")
        print(f"  Tier: {test_tech['tier']}")
        print(f"  Cost: {test_tech['cost']}")
        print(f"  Prerequisites: {test_tech['prerequisites']}")
    else:
        print("\n[ERROR] tech_engineering_industry_1253 not found")

    # Show distribution
    areas = defaultdict(int)
    for tech in techs:
        areas[tech['area']] += 1

    print("\nTechs by area:")
    for area, count in sorted(areas.items()):
        print(f"  {area}: {count}")


if __name__ == '__main__':
    test_parser()
