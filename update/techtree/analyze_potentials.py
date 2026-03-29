import json
from collections import defaultdict

def analyze_potentials(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        potentials = json.load(f)

    condition_counts = defaultdict(int)
    categorized_conditions = defaultdict(list)

    for item in potentials:
        conditions = item.get('conditions', [])
        for cond in conditions:
            # Simple categorization based on keywords
            if 'is_species_class' in cond:
                category = 'species_class'
            elif 'has_country_flag' in cond:
                category = 'country_flag'
            elif 'is_assimilator' in cond:
                category = 'assimilator'
            elif 'is_borg_empire' in cond:
                category = 'borg_empire'
            elif 'is_undine_empire' in cond:
                category = 'undine_empire'
            elif 'is_romulan_tech_empire' in cond:
                category = 'romulan_empire'
            elif 'is_earth_or_ufp_story_empire' in cond:
                category = 'ufp_empire'
            elif 'is_cardassia_story_empire' in cond:
                category = 'cardassian_empire'
            elif 'OR' in cond or 'NOR' in cond or 'AND' in cond:
                category = 'logical_operator'
            else:
                category = 'other'
            
            condition_counts[cond] += 1
            if cond not in categorized_conditions[category]:
                categorized_conditions[category].append(cond)

    # Sort conditions for better readability
    for category in categorized_conditions:
        categorized_conditions[category].sort()

    # Prepare the report
    report = {
        "total_potential_blocks": len(potentials),
        "unique_conditions_count": len(condition_counts),
        "condition_counts": sorted(condition_counts.items(), key=lambda x: x[1], reverse=True),
        "categorized_conditions": categorized_conditions
    }

    with open('potentials_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    
    print("Analysis complete. Report saved to potentials_analysis.json")

if __name__ == "__main__":
    analyze_potentials('potentials.json')
