"""
Component Parser - Extract Component Stats from STNH Mod

This module parses STNH component_templates files and extracts:
- Component keys
- Prerequisite technologies
- Modifiers (stats/effects)
- Resources (costs)

Used to generate accurate tech effects based on what components they unlock.
"""

import os
import re
from pathlib import Path
from collections import defaultdict


class ComponentParser:
    def __init__(self, mod_root):
        """
        Initialize Component Parser

        Args:
            mod_root: Path to STNH mod root directory
        """
        self.mod_root = Path(mod_root)
        self.component_dir = self.mod_root / 'common' / 'component_templates'
        self.components = {}  # component_key -> component_data
        self.tech_components = defaultdict(list)  # tech_id -> [component_keys]

    def parse_all_components(self):
        """Parse all component template files"""
        print(f"\n[Component Parser] Scanning {self.component_dir}...")

        if not self.component_dir.exists():
            print(f"[ERROR] Component directory not found: {self.component_dir}")
            return

        component_files = list(self.component_dir.glob('*.txt'))
        print(f"[Component Parser] Found {len(component_files)} component files")

        total_components = 0

        for component_file in component_files:
            components_in_file = self._parse_component_file(component_file)
            total_components += components_in_file

        print(f"[Component Parser] Parsed {total_components} total components")
        print(f"[Component Parser] Linked to {len(self.tech_components)} technologies")

        return self.components, self.tech_components

    def _parse_component_file(self, filepath):
        """Parse a single component file"""
        count = 0

        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                content = f.read()

            # Remove comments
            content = re.sub(r'#.*?$', '', content, flags=re.MULTILINE)

            # Find all component templates
            # Pattern: component_template = { ... }
            # Types: utility_component_template, weapon_component_template, strike_craft_component_template
            template_pattern = r'(\w+_component_template)\s*=\s*\{'

            for match in re.finditer(template_pattern, content):
                component_type = match.group(1)
                start_pos = match.end() - 1

                # Extract component block
                block = self._extract_block(content, start_pos)
                if not block:
                    continue

                # Parse component data
                component_data = self._parse_component_block(block, component_type)

                if component_data:
                    key = component_data.get('key')
                    if key:
                        self.components[key] = component_data
                        count += 1

                        # Link to tech via prerequisites
                        prereq_tech = component_data.get('prerequisites')
                        if prereq_tech:
                            for tech in prereq_tech:
                                self.tech_components[tech].append(key)

        except Exception as e:
            print(f"[WARNING] Error parsing {filepath.name}: {e}")

        return count

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

    def _parse_component_block(self, block, component_type):
        """Parse a component block and extract relevant data"""
        data = {
            'type': component_type,
            'modifiers': {},
            'prerequisites': [],
            'cost': {},
            'upkeep': {}
        }

        # Extract key
        key_match = re.search(r'key\s*=\s*"([^"]+)"', block)
        if key_match:
            data['key'] = key_match.group(1)
        else:
            return None  # Skip if no key

        # Extract size
        size_match = re.search(r'size\s*=\s*(\w+)', block)
        if size_match:
            data['size'] = size_match.group(1)

        # Extract power
        power_match = re.search(r'power\s*=\s*([-\d.]+)', block)
        if power_match:
            data['power'] = float(power_match.group(1))

        # Extract prerequisites
        prereq_match = re.search(r'prerequisites\s*=\s*\{([^}]+)\}', block)
        if prereq_match:
            prereqs_str = prereq_match.group(1)
            # Extract tech IDs (may be quoted)
            tech_ids = re.findall(r'"?([a-zA-Z_0-9]+)"?', prereqs_str)
            data['prerequisites'] = [tid for tid in tech_ids if tid.startswith('tech_')]

        # Extract modifier block (contains the actual stats/effects)
        modifier_match = re.search(r'(?:^|\n)\s+modifier\s*=\s*\{', block, re.MULTILINE)
        if modifier_match:
            mod_start = modifier_match.end() - 1
            mod_block = self._extract_block(block, mod_start)

            if mod_block:
                # Extract key = value pairs from modifier block
                kv_pattern = r'(\w+)\s*=\s*([-+]?[\d.]+)'

                for kv_match in re.finditer(kv_pattern, mod_block):
                    modifier_key = kv_match.group(1)
                    modifier_value = float(kv_match.group(2))
                    data['modifiers'][modifier_key] = modifier_value

        # Extract resources (cost & upkeep)
        resources_match = re.search(r'resources\s*=\s*\{', block)
        if resources_match:
            res_start = resources_match.end() - 1
            res_block = self._extract_block(block, res_start)

            if res_block:
                # Extract cost
                cost_match = re.search(r'cost\s*=\s*\{([^}]+)\}', res_block)
                if cost_match:
                    cost_str = cost_match.group(1)
                    cost_kv = re.findall(r'(\w+)\s*=\s*([\d.]+)', cost_str)
                    data['cost'] = {k: float(v) for k, v in cost_kv}

                # Extract upkeep
                upkeep_match = re.search(r'upkeep\s*=\s*\{([^}]+)\}', res_block)
                if upkeep_match:
                    upkeep_str = upkeep_match.group(1)
                    upkeep_kv = re.findall(r'(\w+)\s*=\s*([\d.]+)', upkeep_str)
                    data['upkeep'] = {k: float(v) for k, v in upkeep_kv}

        # Extract damage (for weapons)
        damage_match = re.search(r'damage\s*=\s*\{\s*min\s*=\s*([\d.]+)\s+max\s*=\s*([\d.]+)', block)
        if damage_match:
            data['damage_min'] = float(damage_match.group(1))
            data['damage_max'] = float(damage_match.group(2))

        # Extract windup/cooldown (for weapons)
        windup_match = re.search(r'windup\s*=\s*([\d.]+)', block)
        if windup_match:
            data['windup'] = float(windup_match.group(1))

        cooldown_match = re.search(r'cooldown\s*=\s*([\d.]+)', block)
        if cooldown_match:
            data['cooldown'] = float(cooldown_match.group(1))

        return data

    def get_components_for_tech(self, tech_id):
        """Get all components unlocked by a technology"""
        return [self.components[key] for key in self.tech_components.get(tech_id, [])]


def test_parser():
    """Test the component parser"""
    from config import STNH_MOD_ROOT

    parser = ComponentParser(STNH_MOD_ROOT)
    components, tech_components = parser.parse_all_components()

    # Test with tech_physics_11282
    print("\n" + "="*60)
    print("Test: Components for tech_physics_11282")
    print("="*60)

    comps = parser.get_components_for_tech('tech_physics_11282')
    for comp in comps:
        print(f"\nComponent: {comp['key']}")
        print(f"  Type: {comp['type']}")
        print(f"  Modifiers: {comp['modifiers']}")
        print(f"  Cost: {comp['cost']}")

    # Show stats
    print("\n" + "="*60)
    print(f"Total Components: {len(components)}")
    print(f"Technologies with components: {len(tech_components)}")
    print("="*60)


if __name__ == '__main__':
    test_parser()
