import json
import os
from config import OUTPUT_ROOT_DIR

def create_trigger_map():
    """
    Creates a manually curated mapping of game triggers to species.
    This file is used by create_tech_json.py to determine species requirements.

    Output: git09/stnh_techtree_interactive/trigger_map.json
    """
    # This is a manually curated list based on the analysis of potentials_analysis.json
    # It can be extended as needed.
    trigger_map = {
        "species_specific": [
            {"condition": "is_species_class = KDF", "species": ["Klingon"], "type": "include"},
            {"condition": "is_species_class = ROM", "species": ["Romulan"], "type": "include"},
            {"condition": "is_species_class = VUL", "species": ["Vulcan"], "type": "include"},
            {"condition": "is_species_class = FED", "species": ["Federation"], "type": "include"},
            {"condition": "is_species_class = CAR", "species": ["Cardassian"], "type": "include"},
            {"condition": "is_species_class = THO", "species": ["Tholian"], "type": "include"},
            {"condition": "is_species_class = UND", "species": ["Undine"], "type": "include"},
            {"condition": "is_species_class = XINMAM", "species": ["Xindi-Primate"], "type": "include"},
            {"condition": "is_species_class = XINREP", "species": ["Xindi-Reptilian"], "type": "include"},
            {"condition": "is_species_class = XININS", "species": ["Xindi-Insectoid"], "type": "include"},
            {"condition": "is_species_class = XINAQU", "species": ["Xindi-Aquatic"], "type": "include"},
            {"condition": "is_species_class = XINARB", "species": ["Xindi-Arboreal"], "type": "include"},
            {"condition": "is_species_class = XINAVI", "species": ["Xindi-Avian"], "type": "include"}
        ],
        "country_specific": [
            {"condition": "has_country_flag = klingon_empire", "species": ["Klingon"], "type": "include"},
            {"condition": "has_country_flag = romulan_star_empire", "species": ["Romulan"], "type": "include"},
            {"condition": "has_country_flag = cardassian_union", "species": ["Cardassian"], "type": "include"},
            {"condition": "has_country_flag = united_federation_of_planets", "species": ["Federation"], "type": "include"},
            {"condition": "has_country_flag = the_dominion", "species": ["Dominion"], "type": "include"},
            {"condition": "has_country_flag = tholian_assembly", "species": ["Tholian"], "type": "include"},
            {"condition": "has_country_flag = breen_confederacy", "species": ["Breen"], "type": "include"},
            {"condition": "has_country_flag = ferengi_alliance", "species": ["Ferengi"], "type": "include"},
            {"condition": "has_country_flag = sona_command", "species": ["Son'a"], "type": "include"},
            {"condition": "has_country_flag = hirogen_hunters", "species": ["Hirogen"], "type": "include"},
            {"condition": "has_country_flag = voth_theocracy", "species": ["Voth"], "type": "include"},
            {"condition": "has_country_flag = krenim_imperium", "species": ["Krenim"], "type": "include"},
            {"condition": "has_country_flag = vidiian_sodality", "species": ["Vidiian"], "type": "include"},
            {"condition": "has_country_flag = suliban_cabal", "species": ["Suliban"], "type": "include"}
        ],
        "empire_specific": [
            {"condition": "is_borg_empire = yes", "species": ["Borg"], "type": "include"},
            {"condition": "is_undine_empire = yes", "species": ["Undine"], "type": "include"},
            {"condition": "is_romulan_tech_empire = yes", "species": ["Romulan"], "type": "include"},
            {"condition": "is_earth_or_ufp_story_empire = yes", "species": ["Federation"], "type": "include"},
            {"condition": "is_cardassia_story_empire = yes", "species": ["Cardassian"], "type": "include"}
        ],
        "exclusions": [
            {"condition": "is_assimilator = no", "species": ["Borg"], "type": "exclude"},
            {"condition": "is_borg_empire = no", "species": ["Borg"], "type": "exclude"},
            {"condition": "is_undine_empire = no", "species": ["Undine"], "type": "exclude"}
        ]
    }

    output_file = os.path.join(OUTPUT_ROOT_DIR, 'trigger_map.json')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(trigger_map, f, indent=2)

    print(f"Successfully created '{output_file}'")

if __name__ == "__main__":
    create_trigger_map()
