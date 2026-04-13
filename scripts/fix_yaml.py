import logging

#!/usr/bin/env python3
"""
修复 YAML 语法错误
"""

import re
from pathlib import Path


def fix_yaml_file(file_path: Path):
    """修复 YAML 文件"""
    logging.info(f"修复文件：{file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    fixed_lines = []
    for i, line in enumerate(lines, 1):
        # 修复冒号后没有空格的问题
        if re.search(r':\S', line) and not line.strip().startswith('#'):
            # 跳过已经是正确格式的行
            if ':' in line and not line.strip().endswith(':'):
                # 在冒号后添加空格
                line = re.sub(r':(\S)', r': \1', line)
        
        # 修复引号问题
        if line.count('"') % 2 != 0:
            # 尝试修复未闭合的引号
            line = line.rstrip() + '"'
        
        fixed_lines.append(line)
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)
    
    logging.info(f"  ✅ 修复完成")


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1:
        for file_path in sys.argv[1:]:
            fix_yaml_file(Path(file_path))
    else:
        logging.info("用法：python fix_yaml.py <file1.yaml> [file2.yaml ...]")
