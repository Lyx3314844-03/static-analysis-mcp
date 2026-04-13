import logging

#!/usr/bin/env python3
"""
Static Analysis MCP 验证和修复脚本
检查所有文件并自动修复常见问题
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import List, Tuple


class Color:
    """颜色输出"""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def print_header(text: str):
    """打印标题"""
    logging.info(f"\n{Color.BLUE}{'='*70}{Color.RESET}")
    logging.info(f"{Color.BLUE}{text.center(70)}{Color.RESET}")
    logging.info(f"{Color.BLUE}{'='*70}{Color.RESET}\n")


def check_python_syntax(file_path: Path) -> Tuple[bool, str]:
    """检查 Python 语法"""
    try:
        result = subprocess.run(
            [sys.executable, '-m', 'py_compile', str(file_path)],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return True, ""
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)


def check_yaml_syntax(file_path: Path) -> Tuple[bool, str]:
    """检查 YAML 语法"""
    try:
        import yaml
        with open(file_path, 'r', encoding='utf-8') as f:
            yaml.safe_load(f)
        return True, ""
    except Exception as e:
        return False, str(e)


def check_imports(file_path: Path) -> List[str]:
    """检查导入是否可用"""
    missing_imports = []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 简单提取 import 语句
        import re
        imports = re.findall(r'^(?:import|from)\s+(\w+)', content, re.MULTILINE)
        
        for module in set(imports):
            try:
                __import__(module)
            except ImportError:
                missing_imports.append(module)
    
    except Exception:
        pass
    
    return missing_imports


def main():
    """主函数"""
    print_header("Static Analysis MCP 验证和修复")
    
    root_dir = Path(__file__).parent.parent
    tools_dir = root_dir / 'STATIC_ANALYSIS_TOOLS'
    scripts_dir = root_dir / 'scripts'
    k8s_dir = root_dir / 'k8s'
    
    all_passed = True
    python_files = []
    yaml_files = []
    
    # 收集文件
    logging.info(f"{Color.YELLOW}收集文件...{Color.RESET}")
    
    if tools_dir.exists():
        python_files.extend(tools_dir.glob('*.py'))
        if (tools_dir / 'semgrep_rules').exists():
            yaml_files.extend((tools_dir / 'semgrep_rules').glob('*.yaml'))
    
    if scripts_dir.exists():
        python_files.extend(scripts_dir.glob('*.py'))
    
    if k8s_dir.exists():
        yaml_files.extend(k8s_dir.glob('*.yaml'))
    
    logging.info(f"  Python 文件：{len(python_files)}")
    logging.info(f"  YAML 文件：{len(yaml_files)}")
    
    # 检查 Python 文件
    print_header("检查 Python 语法")
    
    for py_file in python_files:
        passed, error = check_python_syntax(py_file)
        if passed:
            logging.info(f"  {Color.GREEN}✅{Color.RESET} {py_file.name}")
        else:
            logging.info(f"  {Color.RED}❌{Color.RESET} {py_file.name}")
            if error:
                logging.info(f"      错误：{error[:100]}")
            all_passed = False
    
    # 检查 YAML 文件
    print_header("检查 YAML 语法")
    
    for yaml_file in yaml_files:
        passed, error = check_yaml_syntax(yaml_file)
        if passed:
            logging.info(f"  {Color.GREEN}✅{Color.RESET} {yaml_file.name}")
        else:
            logging.info(f"  {Color.RED}❌{Color.RESET} {yaml_file.name}")
            if error:
                logging.info(f"      错误：{error[:100]}")
            all_passed = False
    
    # 检查依赖
    print_header("检查依赖安装")
    
    required_modules = [
        'flask', 'requests', 'yaml', 'pandas', 'plotly',
        'tqdm', 'pytest', 'redis', 'github', 'slack_sdk'
    ]
    
    missing = []
    for module in required_modules:
        try:
            __import__(module)
            logging.info(f"  {Color.GREEN}✅{Color.RESET} {module}")
        except ImportError:
            logging.info(f"  {Color.YELLOW}⚠️{Color.RESET} {module}")
            missing.append(module)
    
    if missing:
        logging.info(f"\n{Color.YELLOW}以下模块未安装:{Color.RESET}")
        logging.info(f"  运行：pip install {' '.join(missing)}")
    
    # 总结
    print_header("验证总结")
    
    if all_passed and not missing:
        logging.info(f"{Color.GREEN}✅ 所有检查通过！{Color.RESET}")
        logging.info(f"\n{Color.GREEN}系统已准备就绪，可以立即使用！{Color.RESET}")
        return 0
    else:
        logging.info(f"{Color.YELLOW}⚠️ 发现一些问题，请查看上述输出{Color.RESET}")
        if not all_passed:
            logging.info(f"\n{Color.RED}语法错误需要修复！{Color.RESET}")
        if missing:
            logging.info(f"\n{Color.YELLOW}缺少依赖，请运行：pip install -r requirements.txt{Color.RESET}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
