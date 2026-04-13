import logging

#!/usr/bin/env python3
"""
修复 javascript_security.yaml 文件
将所有特殊字符用引号包裹
"""

import re
from pathlib import Path

file_path = Path('C:/Users/Administrator/STATIC_ANALYSIS_TOOLS/semgrep_rules/javascript_security.yaml')
output_path = Path('C:/Users/Administrator/STATIC_ANALYSIS_TOOLS/semgrep_rules/javascript_security_fixed.yaml')

logging.info(f"读取文件：{file_path}")

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
fixed_lines = []

for i, line in enumerate(lines):
    # 跳过注释行和空行
    if line.strip().startswith('#') or not line.strip():
        fixed_lines.append(line)
        continue
    
    # 跳过已经是多行文本的行
    if line.rstrip().endswith('|'):
        fixed_lines.append(line)
        continue
    
    # 修复 message 字段
    if 'message:' in line and not line.strip().startswith('#'):
        match = re.search(r'message:\s*(.+)', line)
        if match:
            value = match.group(1).strip()
            if not (value.startswith('"') or value.startswith("'")):
                # 用双引号包裹
                line = line.replace(f'message: {value}', f'message: "{value}"')
    
    # 修复 pattern 字段中的特殊字符
    if 'pattern:' in line and '|' not in line:
        match = re.search(r"pattern:\s*(.+)", line)
        if match:
            value = match.group(1).strip()
            if len(value) < 200 and not (value.startswith('"') or value.startswith("'")):
                # 用单引号包裹
                line = line.replace(f'pattern: {value}', f"pattern: '{value}'")
    
    # 修复 metavariable 名称
    if 'metavariable:' in line:
        line = re.sub(r"metavariable:\s*(\$?\w+)", r'metavariable: "\1"', line)
    
    # 修复 regex 值
    if 'regex:' in line:
        match = re.search(r"regex:\s*(.+)", line)
        if match:
            value = match.group(1).strip()
            if not (value.startswith('"') or value.startswith("'")):
                line = line.replace(f'regex: {value}', f'regex: "{value}"')
    
    # 修复 owasp 字段中的冒号
    if 'owasp:' in line:
        line = re.sub(r'owasp:\s*([A-Z]\d+:)', r'owasp: "\1"', line)
    
    fixed_lines.append(line)

# 写回文件
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(fixed_lines))

logging.info(f"✅ 修复完成：{output_path}")

# 验证
import yaml
try:
    with open(output_path, 'r', encoding='utf-8') as f:
        yaml.safe_load(f)
    logging.info("✅ YAML 语法验证通过！")
except yaml.YAMLError as e:
    logging.info(f"⚠️ 仍有语法问题：{str(e)[:100]}")
