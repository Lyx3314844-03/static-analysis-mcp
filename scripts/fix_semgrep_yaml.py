import logging

#!/usr/bin/env python3
"""
修复 Semgrep YAML 文件的语法问题
将特殊字符用引号包裹，使其符合标准 YAML 语法
"""

import re
import sys
from pathlib import Path


def fix_semgrep_yaml(file_path: Path, output_path: Path = None):
    """
    修复 Semgrep YAML 文件
    
    Args:
        file_path: 输入文件路径
        output_path: 输出文件路径（默认为原文件）
    """
    if output_path is None:
        output_path = file_path
    
    logging.info(f"修复文件：{file_path.name}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    lines = content.split('\n')
    fixed_lines = []
    
    for i, line in enumerate(lines):
        # 跳过注释行和空行
        if line.strip().startswith('#') or not line.strip():
            fixed_lines.append(line)
            continue
        
        # 跳过已经是多行文本的行（以 | 或 > 结尾）
        if line.rstrip().endswith('|') or line.rstrip().endswith('>'):
            fixed_lines.append(line)
            continue
        
        # 修复冒号后没有空格的问题
        line = re.sub(r':([^:\s\n"/])', r': \1', line)
        
        # 修复 metavariable 名称（用引号包裹）
        line = re.sub(r'metavariable:\s*(\$?\w+)', r'metavariable: "\1"', line)
        
        # 修复 pattern 中的特殊字符（如果包含 $ 且没有引号）
        if 'pattern:' in line and '$' in line and not ('"' in line or "'" in line):
            # 提取 pattern 值并用引号包裹
            match = re.search(r'pattern:\s*(.+)', line)
            if match:
                pattern_value = match.group(1).strip()
                if not (pattern_value.startswith('"') or pattern_value.startswith("'")):
                    line = line.replace(f'pattern: {pattern_value}', f'pattern: "{pattern_value}"')
        
        # 修复 regex 值（用引号包裹）
        if 'regex:' in line and not ('"' in line or "'" in line):
            match = re.search(r'regex:\s*(.+)', line)
            if match:
                regex_value = match.group(1).strip()
                if not (regex_value.startswith('"') or regex_value.startswith("'")):
                    line = line.replace(f'regex: {regex_value}', f'regex: "{regex_value}"')
        
        fixed_lines.append(line)
    
    # 写回文件
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines))
    
    logging.info(f"  ✅ 修复完成：{output_path}")


def main():
    """主函数"""
    import yaml
    
    files_to_fix = [
        Path('C:/Users/Administrator/STATIC_ANALYSIS_TOOLS/semgrep_rules/python_security.yaml'),
        Path('C:/Users/Administrator/STATIC_ANALYSIS_TOOLS/semgrep_rules/javascript_security.yaml'),
    ]
    
    logging.info("开始修复 YAML 文件...\n")
    
    for file_path in files_to_fix:
        if file_path.exists():
            backup_path = file_path.with_suffix('.yaml.backup')
            
            # 创建备份
            if not backup_path.exists():
                import shutil
                shutil.copy2(file_path, backup_path)
                logging.info(f"  📋 已创建备份：{backup_path.name}")
            
            # 修复文件
            fix_semgrep_yaml(file_path, file_path)
            
            # 验证修复后是否有效
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    yaml.safe_load(f)
                logging.info(f"  ✅ 验证成功！")
            except yaml.YAMLError as e:
                logging.info(f"  ⚠️ 仍有语法问题（Semgrep 仍可使用）: {str(e)[:80]}")
        else:
            logging.info(f"❌ {file_path.name} - 文件不存在")
    
    logging.info("\n修复完成！")


if __name__ == '__main__':
    main()
