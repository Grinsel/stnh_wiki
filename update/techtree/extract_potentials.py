import os
import re
import json

def find_potential_blocks(directory):
    all_potentials = []
    for filename in os.listdir(directory):
        if filename.endswith(".txt"):
            filepath = os.path.join(directory, filename)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
                # A more robust way to find matching braces
                for match in re.finditer(r'\bpotential\s*=\s*{', content):
                    start_index = match.end()
                    brace_count = 1
                    end_index = -1
                    for i in range(start_index, len(content)):
                        if content[i] == '{':
                            brace_count += 1
                        elif content[i] == '}':
                            brace_count -= 1
                        if brace_count == 0:
                            end_index = i
                            break
                    
                    if end_index != -1:
                        block_content = content[start_index:end_index].strip()
                        # Simple parsing of conditions, can be improved
                        conditions = [line.strip() for line in block_content.split('\n') if line.strip() and not line.strip().startswith('#')]
                        
                        potential_data = {
                            "file": filename,
                            "conditions": conditions
                        }
                        all_potentials.append(potential_data)

    return all_potentials

if __name__ == "__main__":
    tech_dir = os.path.join('common', 'technology')
    if os.path.isdir(tech_dir):
        potentials = find_potential_blocks(tech_dir)
        with open('potentials.json', 'w', encoding='utf-8') as f:
            json.dump(potentials, f, indent=2)
        print(f"Successfully extracted {len(potentials)} potential blocks to potentials.json")
    else:
        print(f"Directory not found: {tech_dir}")
