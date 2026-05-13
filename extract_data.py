import re
import os

html_path = os.path.join(os.path.dirname(__file__), '../Mitus_IP_Web.html')
target_path = os.path.join(os.path.dirname(__file__), 'src/data/mockData.js')

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

def extract_var(var_name):
    pattern = r"const\s+" + var_name + r"\s*=\s*({(?:[^{}]|<br/>|{[^{}]*})*?});"
    # Basic regex won't work well for deeply nested structures like REVISION_LOG_SEED.
    # So we do manual block parsing.
    idx = content.find(f"const {var_name} =")
    if idx == -1:
        return None
    
    # We find the first brace
    start_brace = content.find('{', idx)
    if start_brace == -1:
        return None
    
    open_count = 0
    end_idx = -1
    for i in range(start_brace, len(content)):
        if content[i] == '{':
            open_count += 1
        elif content[i] == '}':
            open_count -= 1
            if open_count == 0:
                end_idx = i
                break
    
    if end_idx != -1:
        return "export " + content[idx:end_idx+1] + ";"
    return None

def extract_func(func_name):
    idx = content.find(f"const {func_name} =")
    if idx == -1:
        return None
    
    semicolon_idx = content.find('};', idx)
    if semicolon_idx != -1:
        return "export " + content[idx:semicolon_idx+2]
    return None

vars_to_extract = [
    'foundryProcessMap',
    'ipCategoryNameMap',
    'REVISION_LOG_SEED',
    'defaultProjOverview',
    'defaultIpIndexMap'
]

appends = '\n\n// --- Extracted from Mitus_IP_Web.html ---\n\n'

for v in vars_to_extract:
    extracted = extract_var(v)
    if extracted:
        appends += extracted + '\n\n'
        print(f"Successfully extracted {v}")
    else:
        print(f"Failed to extract {v}")

# Also extract makeDefaultIpIndex which is a function
func = extract_func("makeDefaultIpIndex")
if func:
    appends += func + '\n\n'

with open(target_path, 'a', encoding='utf-8') as f:
    f.write(appends)

print("Appended successfully.")
