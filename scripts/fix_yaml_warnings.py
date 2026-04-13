import logging

#!/usr/bin/env python3
"""
修复 YAML 文件语法警告
"""

import re
from pathlib import Path


def fix_yaml_file(file_path: Path):
    """修复 YAML 文件中的语法问题"""
    logging.info(f"修复文件：{file_path}")
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复 1: 确保冒号后有空格
    # 匹配冒号后没有空格的情况，但排除已经是正确格式的
    content = re.sub(r':([^:\s\n])', r': \1', content)
    
    # 修复 2: 确保列表项后有正确的缩进
    lines = content.split('\n')
    fixed_lines = []
    for i, line in enumerate(lines):
        # 跳过注释行
        if line.strip().startswith('#'):
            fixed_lines.append(line)
            continue
        
        # 确保列表项格式正确
        if line.strip().startswith('- '):
            # 检查是否有正确的缩进
            leading_spaces = len(line) - len(line.lstrip())
            fixed_lines.append(line)
        else:
            fixed_lines.append(line)
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines))
    
    logging.info(f"  ✅ 修复完成")


def main():
    """主函数"""
    import yaml
    
    files_to_fix = [
        Path('C:/Users/Administrator/STATIC_ANALYSIS_TOOLS/semgrep_rules/python_security.yaml'),
        Path('C:/Users/Administrator/STATIC_ANALYSIS_TOOLS/semgrep_rules/javascript_security.yaml'),
        Path('C:/Users/Administrator/STATIC_ANALYSIS_TOOLS/semgrep_rules/code_quality.yaml'),
    ]
    
    logging.info("开始修复 YAML 文件...\n")
    
    for file_path in files_to_fix:
        if file_path.exists():
            try:
                # 先尝试加载，如果成功则不需要修复
                with open(file_path, 'r', encoding='utf-8') as f:
                    yaml.safe_load(f)
                logging.info(f"✅ {file_path.name} - 已经是有效 YAML")
            except yaml.YAMLError as e:
                logging.info(f"⚠️ {file_path.name} - 发现错误：{str(e)[:100]}")
                fix_yaml_file(file_path)
                
                # 验证修复后是否有效
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        yaml.safe_load(f)
                    logging.info(f"  ✅ 修复成功！")
                except yaml.YAMLError as e2:
                    logging.info(f"  ⚠️ 仍有错误：{str(e2)[:100]}")
        else:
            logging.info(f"❌ {file_path.name} - 文件不存在")
    
    logging.info("\n修复完成！")


if __name__ == '__main__':
    main()
