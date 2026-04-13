import logging

#!/usr/bin/env python3
"""
Static Analysis MCP 完整代码检查脚本
检查所有 Python、YAML 文件以及依赖
"""

import os
import sys
import ast
import yaml
import importlib
from pathlib import Path
from typing import List, Dict, Tuple
import subprocess


class Color:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class CompleteCodeChecker:
    """完整代码检查器"""
    
    def __init__(self, root_dir: str):
        """
        初始化检查器
        
        Args:
            root_dir: 项目根目录
        """
        self.root_dir = Path(root_dir)
        self.tools_dir = self.root_dir / 'STATIC_ANALYSIS_TOOLS'
        self.scripts_dir = self.root_dir / 'scripts'
        self.k8s_dir = self.root_dir / 'k8s'
        
        self.results = {
            'python': {'total': 0, 'passed': 0, 'failed': 0, 'issues': []},
            'yaml': {'total': 0, 'passed': 0, 'failed': 0, 'issues': []},
            'dependencies': {'total': 0, 'installed': 0, 'missing': []}
        }
    
    def check_all(self):
        """执行所有检查"""
        logging.info(f"\n{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}Static Analysis MCP 完整代码检查{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}\n")
        
        # 1. 检查 Python 文件
        self.check_python_files()
        
        # 2. 检查 YAML 文件
        self.check_yaml_files()
        
        # 3. 检查依赖
        self.check_dependencies()
        
        # 4. 打印总结
        self.print_summary()
    
    def check_python_files(self):
        """检查所有 Python 文件"""
        logging.info(f"{Color.BOLD}【1/3】检查 Python 文件{Color.RESET}")
        logging.info(f"{'-'*80}\n")
        
        py_files = []
        py_files.extend(self.tools_dir.glob('*.py'))
        py_files.extend(self.scripts_dir.glob('*.py'))
        
        self.results['python']['total'] = len(py_files)
        
        for py_file in py_files:
            passed, issues = self.check_python_syntax(py_file)
            
            if passed:
                self.results['python']['passed'] += 1
                logging.info(f"  {Color.GREEN}✅{Color.RESET} {py_file.name}")
            else:
                self.results['python']['failed'] += 1
                self.results['python']['issues'].append({
                    'file': str(py_file),
                    'issues': issues
                })
                print(f"  {Color.RED}❌{Color.RESET} {py_file.name}")
                for issue in issues[:2]:
                    print(f"      {Color.YELLOW}⚠️{Color.RESET} {issue}")

        print()
    
    def check_python_syntax(self, file_path: Path) -> Tuple[bool, List[str]]:
        """
        检查 Python 语法
        
        Args:
            file_path: 文件路径
            
        Returns:
            (是否通过，问题列表)
        """
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 语法检查
            ast.parse(content)
            
            # 尝试导入（在实际路径下）
            if file_path.parent == self.tools_dir:
                test_cmd = [
                    sys.executable, '-c',
                    f"import sys; sys.path.insert(0, r'{self.tools_dir}'); import {file_path.stem}"
                ]
            else:
                test_cmd = [
                    sys.executable, '-c',
                    f"import sys; sys.path.insert(0, r'{self.scripts_dir}'); import {file_path.stem}"
                ]
            
            result = subprocess.run(test_cmd, capture_output=True, timeout=10)
            if result.returncode != 0:
                issues.append(f"导入失败：{result.stderr.decode('utf-8')[:100]}")
            
        except SyntaxError as e:
            issues.append(f"语法错误：行{e.lineno} - {e.msg}")
        except Exception as e:
            issues.append(f"检查错误：{str(e)}")
        
        return (len(issues) == 0, issues)
    
    def check_yaml_files(self):
        """检查所有 YAML 文件"""
        logging.info(f"{Color.BOLD}【2/3】检查 YAML 文件{Color.RESET}")
        logging.info(f"{'-'*80}\n")
        
        yaml_files = []
        
        # Semgrep 规则
        if (self.tools_dir / 'semgrep_rules').exists():
            yaml_files.extend((self.tools_dir / 'semgrep_rules').glob('*.yaml'))
        
        # K8s 配置
        if self.k8s_dir.exists():
            yaml_files.extend(self.k8s_dir.glob('*.yaml'))
        
        self.results['yaml']['total'] = len(yaml_files)
        
        for yaml_file in yaml_files:
            passed, issues = self.check_yaml_syntax(yaml_file)
            
            if passed:
                self.results['yaml']['passed'] += 1
                logging.info(f"  {Color.GREEN}✅{Color.RESET} {yaml_file.name}")
            else:
                self.results['yaml']['failed'] += 1
                self.results['yaml']['issues'].append({
                    'file': str(yaml_file),
                    'issues': issues
                })
                logging.info(f"  {Color.RED}❌{Color.RESET} {yaml_file.name}")
                for issue in issues[:2]:
                    logging.info(f"      {Color.YELLOW}⚠️{Color.RESET} {issue}")
        
        print()
    
    def check_yaml_syntax(self, file_path: Path) -> Tuple[bool, List[str]]:
        """
        检查 YAML 语法
        
        Args:
            file_path: 文件路径
            
        Returns:
            (是否通过，问题列表)
        """
        issues = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                yaml.safe_load(f)
        except yaml.YAMLError as e:
            issues.append(f"YAML 错误：{str(e)[:100]}")
        except Exception as e:
            issues.append(f"检查错误：{str(e)}")
        
        return (len(issues) == 0, issues)
    
    def check_dependencies(self):
        """检查依赖安装"""
        logging.info(f"{Color.BOLD}【3/3】检查依赖安装{Color.RESET}")
        logging.info(f"{'-'*80}\n")
        
        required_modules = [
            'flask', 'flask_cors', 'requests', 'yaml', 'pandas', 'plotly',
            'tqdm', 'pytest', 'redis', 'github', 'slack_sdk',
            'semgrep', 'openai', 'anthropic'
        ]
        
        self.results['dependencies']['total'] = len(required_modules)
        
        for module in required_modules:
            try:
                importlib.import_module(module)
                self.results['dependencies']['installed'] += 1
                logging.info(f"  {Color.GREEN}✅{Color.RESET} {module}")
            except ImportError:
                self.results['dependencies']['missing'].append(module)
                logging.info(f"  {Color.YELLOW}⚠️{Color.RESET} {module}")
        
        print()
    
    def print_summary(self):
        """打印总结"""
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}检查总结{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}\n")
        
        # Python 文件
        py_total = self.results['python']['total']
        py_passed = self.results['python']['passed']
        py_failed = self.results['python']['failed']
        
        logging.info(f"{Color.BOLD}Python 文件:{Color.RESET}")
        logging.info(f"  总计：{py_total}")
        logging.info(f"  {Color.GREEN}✅ 通过：{py_passed}{Color.RESET}")
        logging.info(f"  {Color.RED}❌ 失败：{py_failed}{Color.RESET}")
        
        if py_failed > 0:
            logging.info(f"  {Color.YELLOW}问题文件:{Color.RESET}")
            for item in self.results['python']['issues'][:5]:
                logging.info(f"    - {Path(item['file']).name}")
        
        py_rate = (py_passed / py_total * 100) if py_total > 0 else 0
        logging.info(f"  通过率：{py_rate:.1f}%\n")
        
        # YAML 文件
        yaml_total = self.results['yaml']['total']
        yaml_passed = self.results['yaml']['passed']
        yaml_failed = self.results['yaml']['failed']
        
        logging.info(f"{Color.BOLD}YAML 配置:{Color.RESET}")
        logging.info(f"  总计：{yaml_total}")
        logging.info(f"  {Color.GREEN}✅ 通过：{yaml_passed}{Color.RESET}")
        logging.info(f"  {Color.RED}❌ 失败：{yaml_failed}{Color.RESET}")
        
        if yaml_failed > 0:
            logging.info(f"  {Color.YELLOW}问题文件:{Color.RESET}")
            for item in self.results['yaml']['issues'][:5]:
                logging.info(f"    - {Path(item['file']).name}")
        
        yaml_rate = (yaml_passed / yaml_total * 100) if yaml_total > 0 else 0
        logging.info(f"  通过率：{yaml_rate:.1f}%\n")
        
        # 依赖
        dep_total = self.results['dependencies']['total']
        dep_installed = self.results['dependencies']['installed']
        dep_missing = self.results['dependencies']['missing']
        
        logging.info(f"{Color.BOLD}Python 依赖:{Color.RESET}")
        logging.info(f"  总计：{dep_total}")
        logging.info(f"  {Color.GREEN}✅ 已安装：{dep_installed}{Color.RESET}")
        if dep_missing:
            logging.info(f"  {Color.YELLOW}⚠️ 未安装：{', '.join(dep_missing)}{Color.RESET}")
        
        dep_rate = (dep_installed / dep_total * 100) if dep_total > 0 else 0
        logging.info(f"  安装率：{dep_rate:.1f}%\n")
        
        # 总体评分
        total_items = py_total + yaml_total + dep_total
        total_passed = py_passed + yaml_passed + dep_installed
        overall_rate = (total_passed / total_items * 100) if total_items > 0 else 0
        
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}")
        logging.info(f"{Color.BOLD}总体评分：{Color.GREEN if overall_rate >= 95 else Color.YELLOW if overall_rate >= 80 else Color.RED}{overall_rate:.1f}%{Color.RESET}")
        
        if overall_rate >= 95:
            logging.info(f"\n{Color.GREEN}🎉 所有代码检查通过！系统已准备就绪！{Color.RESET}")
        elif overall_rate >= 80:
            logging.info(f"\n{Color.YELLOW}⚠️ 发现一些问题，建议修复后使用{Color.RESET}")
        else:
            logging.info(f"\n{Color.RED}❌ 发现严重问题，请先修复{Color.RESET}")
        
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}\n")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='完整代码检查脚本')
    parser.add_argument('--root', type=str, default='.', help='项目根目录')
    
    args = parser.parse_args()
    
    checker = CompleteCodeChecker(args.root)
    checker.check_all()


if __name__ == '__main__':
    main()
