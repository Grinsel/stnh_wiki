"""
Reverse Unlock Parser - Scans all game files to find what each tech unlocks

Instead of relying on prereqfor_desc blocks in tech files (which are incomplete),
this parser scans buildings, ship_sizes, megastructures, etc. to find prerequisites
and creates a reverse mapping: tech_id -> [things it unlocks]
"""

import re
from pathlib import Path
from collections import defaultdict
from config import STNH_MOD_ROOT

class ReverseUnlockParser:
    def __init__(self, mod_root):
        self.mod_root = Path(mod_root)
        self.unlocks = defaultdict(list)  # tech_id -> [unlock_entries]

        # Directories to scan and their unlock type labels
        # Expanded to cover ALL unlock sources in STNH
        self.scan_targets = {
            # Buildings & Infrastructure
            'buildings': 'Building',
            'districts': 'District',
            'starbase_buildings': 'Starbase Building',
            'starbase_modules': 'Starbase Module',
            'megastructures': 'Megastructure',

            # Ships & Military
            'ship_sizes': 'Ship Type',
            'section_templates': 'Ship Section',
            'armies': 'Army Type',
            'bombardment_stances': 'Bombardment Stance',

            # Empire & Politics
            'edicts': 'Edict',
            'decisions': 'Decision',
            'policies': 'Policy',
            'traditions': 'Tradition',
            'ascension_perks': 'Ascension Perk',

            # Resources & Economy
            'strategic_resources': 'Strategic Resource',
            'deposits': 'Deposit',
            'pop_jobs': 'Job',

            # Traits & Civics
            'traits': 'Trait',
            'governments': 'Government/Civic',

            # Diplomacy & War
            'diplomatic_actions': 'Diplomatic Action',
            'war_goals': 'War Goal',
            'casus_belli': 'Casus Belli',
            'federation_perks': 'Federation Perk',

            # Events & Projects
            'special_projects': 'Special Project',
            'artifact_actions': 'Artifact Action',
            'astral_actions': 'Astral Action',
            'anomalies': 'Anomaly',
            'situations': 'Situation',

            # Other
            'component_sets': 'Component Set',
            'terraform': 'Terraforming',
            'observation_station_missions': 'Observation Mission',
            'tradable_actions': 'Tradable Action',
            'espionage_operation_types': 'Espionage Operation',
            'specialist_subject_perks': 'Specialist Subject Perk',
            'pop_faction_types': 'Faction Type',
            'country_limits': 'Country Limit',
            'species_rights': 'Species Right',
            'zone_slots': 'Zone Slot',
            'zones': 'Zone',
            'council_agendas': 'Council Agenda',
            'bypass': 'Bypass',
            'game_rules': 'Game Rule',
            'patrons': 'Patron',
            'starbase_types': 'Starbase Type'
        }

    def parse_all(self):
        """Scan all directories and build reverse unlock mapping"""
        print("\n[ReverseUnlockParser] Starting comprehensive scan...")

        for directory, unlock_type in self.scan_targets.items():
            dir_path = self.mod_root / 'common' / directory
            if not dir_path.exists():
                print(f"[ReverseUnlockParser] Skipping {directory} (directory not found)")
                continue

            self._scan_directory(dir_path, unlock_type)

        print(f"[ReverseUnlockParser] Completed. Found unlocks for {len(self.unlocks)} techs")
        return dict(self.unlocks)

    def _scan_directory(self, dir_path, unlock_type):
        """Scan a single directory for files containing tech prerequisites"""
        files = list(dir_path.glob('**/*.txt'))
        prereqs_found = 0

        for file_path in files:
            try:
                prereqs_found += self._parse_file(file_path, unlock_type)
            except Exception as e:
                print(f"[ReverseUnlockParser] Error parsing {file_path.name}: {e}")

        if prereqs_found > 0:
            print(f"[ReverseUnlockParser]   {unlock_type}: {prereqs_found} prerequisites found")

    def _parse_file(self, file_path, unlock_type):
        """Parse a single file to extract tech prerequisites"""
        try:
            content = file_path.read_text(encoding='utf-8-sig', errors='ignore')
        except Exception:
            return 0

        prereqs_found = 0

        # Use simpler approach: extract all top-level blocks with proper brace matching
        blocks = self._extract_top_level_blocks(content)

        for item_id, block_content in blocks:
            # Skip meta-blocks
            if item_id in ['inline_script', 'has_global_flag', 'set_global_flag', 'if', 'else', 'limit']:
                continue

            # Extract prerequisites
            tech_prereqs = self._extract_prerequisites(block_content)

            if tech_prereqs:
                # Get human-readable name if possible
                item_name = self._extract_name(item_id, block_content)

                # Add to reverse mapping
                for tech_id in tech_prereqs:
                    self.unlocks[tech_id].append({
                        'type': unlock_type,
                        'id': item_id,
                        'name': item_name
                    })
                    prereqs_found += 1

        return prereqs_found

    def _extract_top_level_blocks(self, content):
        """Extract top-level blocks using brace counting"""
        blocks = []
        lines = content.split('\n')
        i = 0

        while i < len(lines):
            line = lines[i].strip()

            # Skip comments and empty lines
            if line.startswith('#') or not line:
                i += 1
                continue

            # Look for pattern: identifier = {
            match = re.match(r'^(\w+)\s*=\s*\{', line)
            if match:
                item_id = match.group(1)

                # Count braces to find block end
                brace_count = 1
                block_lines = [line[len(match.group(0)):]]  # Content after opening brace
                i += 1

                while i < len(lines) and brace_count > 0:
                    current_line = lines[i]
                    block_lines.append(current_line)

                    # Count braces (ignoring those in comments or strings)
                    clean_line = re.sub(r'#.*$', '', current_line)  # Remove comments
                    clean_line = re.sub(r'"[^"]*"', '', clean_line)  # Remove strings

                    brace_count += clean_line.count('{')
                    brace_count -= clean_line.count('}')

                    i += 1

                block_content = '\n'.join(block_lines)
                blocks.append((item_id, block_content))
            else:
                i += 1

        return blocks

    def _extract_prerequisites(self, block_content):
        """Extract tech prerequisites from a block"""
        tech_ids = []

        # Pattern 1: prerequisites = { "tech_xxx" }
        prereq_pattern = r'prerequisites\s*=\s*\{([^}]+)\}'
        match = re.search(prereq_pattern, block_content)

        if match:
            prereq_block = match.group(1)
            # Find all quoted tech IDs
            tech_ids.extend(re.findall(r'"(tech_\w+)"', prereq_block))

        # Pattern 2: required_technology = tech_xxx
        required_tech_pattern = r'required_technology\s*=\s*(tech_\w+)'
        tech_ids.extend(re.findall(required_tech_pattern, block_content))

        # Pattern 3: has_technology = tech_xxx (in potential/allow blocks)
        # This is a "condition" but for many items it's effectively a prerequisite
        # BUT: Filter out negated checks (NOT = { has_technology = tech_xxx })
        has_tech_pattern = r'(?<!NOT\s*=\s*\{\s*)has_technology\s*=\s*(tech_\w+)'

        # Simple approach: Find all has_technology, then filter out those in NOT blocks
        for match in re.finditer(r'has_technology\s*=\s*(tech_\w+)', block_content):
            tech_id = match.group(1)
            # Check if this is in a NOT block by looking backwards
            start_pos = max(0, match.start() - 50)  # Look 50 chars back
            context_before = block_content[start_pos:match.start()]
            if 'NOT' not in context_before or '=' not in context_before:
                # Likely not negated
                tech_ids.append(tech_id)

        # Remove duplicates
        return list(set(tech_ids))

    def _extract_name(self, item_id, block_content):
        """Extract human-readable name from block or use ID"""
        # Try to find a "name" field
        name_pattern = r'name\s*=\s*"([^"]+)"'
        match = re.search(name_pattern, block_content)

        if match:
            return match.group(1)

        # Fallback: prettify the ID
        # building_galactic_stock_exchange -> Galactic Stock Exchange
        # cruiser -> Cruiser
        parts = item_id.split('_')
        if len(parts) > 1:
            # Skip first part (e.g., "building", "ship") unless it's the only part
            return ' '.join(word.capitalize() for word in parts[1:] if word)
        else:
            # No underscore, just capitalize
            return item_id.capitalize()

    def format_unlocks_for_tech(self, tech_id):
        """Format unlock list for a specific tech into human-readable string"""
        if tech_id not in self.unlocks:
            return None

        unlock_entries = self.unlocks[tech_id]

        # Group by type
        by_type = defaultdict(list)
        for entry in unlock_entries:
            by_type[entry['type']].append(entry['name'])

        # Format as string - SHOW ALL UNLOCKS COMPLETELY
        parts = []
        for unlock_type, names in sorted(by_type.items()):
            if len(names) == 1:
                parts.append(f"{unlock_type}: {names[0]}")
            else:
                # Show ALL names, not just first 3
                parts.append(f"{unlock_type}s: {', '.join(names)}")

        return ' | '.join(parts)


def test_reverse_parser():
    """Test the reverse unlock parser"""
    from config import STNH_MOD_ROOT

    parser = ReverseUnlockParser(STNH_MOD_ROOT)
    unlocks = parser.parse_all()

    # Print statistics
    print(f"\nTotal techs with unlocks: {len(unlocks)}")

    # Sample output
    print("\nSample unlocks:")
    for tech_id in list(unlocks.keys())[:10]:
        formatted = parser.format_unlocks_for_tech(tech_id)
        print(f"  {tech_id}: {formatted}")

    # Check specific tech
    test_tech = 'tech_cruisers'
    if test_tech in unlocks:
        print(f"\n{test_tech} unlocks:")
        formatted = parser.format_unlocks_for_tech(test_tech)
        print(f"  {formatted}")

    return unlocks


if __name__ == '__main__':
    test_reverse_parser()
