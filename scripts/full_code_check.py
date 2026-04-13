import logging

#!/usr/bin/env python3
"""
Static Analysis MCP 全面代码检查脚本
检查所有 Python 文件的语法、导入、依赖等问题
"""

import os
import sys
import ast
import importlib
from pathlib import Path
from typing import List, Dict, Tuple
import subprocess


class Color:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


class CodeChecker:
    """代码检查器"""
    
    def __init__(self, root_dir: str):
        """
        初始化检查器
        
        Args:
            root_dir: 项目根目录
        """
        self.root_dir = Path(root_dir)
        self.tools_dir = self.root_dir / 'STATIC_ANALYSIS_TOOLS'
        self.scripts_dir = self.root_dir / 'scripts'
        
        self.issues = []
        self.stats = {
            'total_files': 0,
            'files_with_issues': 0,
            'syntax_errors': 0,
            'import_errors': 0,
            'other_errors': 0
        }
    
    def check_all_files(self):
        """检查所有文件"""
        logging.info(f"\n{Color.BLUE}{'='*70}{Color.RESET}")
        logging.info(f"{Color.BLUE}Static Analysis MCP 全面代码检查{Color.RESET}")
        logging.info(f"{Color.BLUE}{'='*70}{Color.RESET}\n")
        
        # 收集所有 Python 文件
        py_files = []
        py_files.extend(self.tools_dir.glob('*.py'))
        py_files.extend(self.scripts_dir.glob('*.py'))
        
        self.stats['total_files'] = len(py_files)
        
        logging.info(f"检查范围：{len(py_files)} 个 Python 文件\n")
        
        # 检查每个文件
        for py_file in py_files:
            self.check_file(py_file)
        
        # 打印总结
        self.print_summary()
    
    def check_file(self, file_path: Path):
        """
        检查单个文件
        
        Args:
            file_path: 文件路径
        """
        file_issues = []
        
        try:
            # 1. 语法检查
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            try:
                ast.parse(content)
            except SyntaxError as e:
                file_issues.append(f"语法错误：行{e.lineno} - {e.msg}")
                self.stats['syntax_errors'] += 1
            
            # 2. 导入检查
            imports = self.extract_imports(content)
            for module in imports:
                try:
                    importlib.import_module(module)
                except ImportError:
                    file_issues.append(f"导入错误：无法导入 '{module}'")
                    self.stats['import_errors'] += 1
            
            # 3. 文件编码检查
            if not content.startswith('#') and 'utf-8' not in content[:100].lower():
                # 不强制要求，只是建议
                pass
            
        except Exception as e:
            file_issues.append(f"其他错误：{str(e)}")
            self.stats['other_errors'] += 1
        
        # 记录问题
        if file_issues:
            self.stats['files_with_issues'] += 1
            self.issues.append({
                'file': str(file_path),
                'issues': file_issues
            })
            logging.info(f"{Color.RED}❌{Color.RESET} {file_path.name}")
            for issue in file_issues[:3]:  # 只显示前 3 个问题
                logging.info(f"    {Color.YELLOW}⚠️{Color.RESET} {issue}")
        else:
            logging.info(f"{Color.GREEN}✅{Color.RESET} {file_path.name}")
    
    def extract_imports(self, content: str) -> List[str]:
        """
        提取导入的模块
        
        Args:
            content: 文件内容
            
        Returns:
            模块列表
        """
        imports = []
        
        try:
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name.split('.')[0])
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        imports.append(node.module.split('.')[0])
        except Exception as e:
            pass
        
        return list(set(imports))
    
    def print_summary(self):
        """打印总结"""
        logging.info(f"\n{Color.BLUE}{'='*70}{Color.RESET}")
        logging.info(f"{Color.BLUE}检查总结{Color.RESET}")
        logging.info(f"{Color.BLUE}{'='*70}{Color.RESET}\n")
        
        logging.info(f"总文件数：{self.stats['total_files']}")
        logging.info(f"{Color.GREEN}✅ 无问题：{self.stats['total_files'] - self.stats['files_with_issues']}{Color.RESET}")
        logging.info(f"{Color.RED}❌ 有问题：{self.stats['files_with_issues']}{Color.RESET}")
        
        logging.info(f"\n问题分类:")
        logging.info(f"  语法错误：{self.stats['syntax_errors']}")
        logging.info(f"  导入错误：{self.stats['import_errors']}")
        logging.info(f"  其他错误：{self.stats['other_errors']}")
        
        # 显示所有问题
        if self.issues:
            logging.info(f"\n{Color.YELLOW}问题详情:{Color.RESET}")
            for item in self.issues:
                logging.info(f"\n  📁 {item['file']}")
                for issue in item['issues']:
                    logging.info(f"    ⚠️ {issue}")
        
        # 计算通过率
        pass_rate = ((self.stats['total_files'] - self.stats['files_with_issues']) / 
                    self.stats['total_files'] * 100) if self.stats['total_files'] > 0 else 0
        
        logging.info(f"\n通过率：{pass_rate:.1f}%")
        
        if self.stats['files_with_issues'] == 0:
            logging.info(f"\n{Color.GREEN}🎉 所有代码检查通过！{Color.RESET}")
        else:
            logging.info(f"\n{Color.YELLOW}⚠️ 发现一些问题，请查看上述输出{Color.RESET}")


def check_dependencies():
    """检查依赖安装"""
    logging.info(f"\n{Color.BLUE}{'='*70}{Color.RESET}")
    logging.info(f"{Color.BLUE}检查依赖安装{Color.RESET}")
    logging.info(f"{Color.BLUE}{'='*70}{Color.RESET}\n")
    
    required_modules = [
        'flask', 'requests', 'yaml', 'pandas', 'plotly',
        'tqdm', 'pytest', 'redis', 'github', 'slack_sdk',
        'semgrep', 'openai', 'anthropic'
    ]
    
    missing = []
    for module in required_modules:
        try:
            importlib.import_module(module)
            logging.info(f"{Color.GREEN}✅{Color.RESET} {module}")
        except ImportError:
            logging.info(f"{Color.YELLOW}⚠️{Color.RESET} {module}")
            missing.append(module)
    
    if missing:
        logging.info(f"\n{Color.YELLOW}以下模块未安装:{Color.RESET}")
        logging.info(f"  运行：pip install {' '.join(missing)}")
    else:
        logging.info(f"\n{Color.GREEN}✅ 所有依赖已安装{Color.RESET}")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='全面代码检查脚本')
    parser.add_argument('--root', type=str, default='.', help='项目根目录')
    parser.add_argument('--check-deps', action='store_true', help='检查依赖')
    
    args = parser.parse_args()
    
    # 代码检查
    checker = CodeChecker(args.root)
    checker.check_all_files()
    
    # 依赖检查
    if args.check_deps:
        check_dependencies()


if __name__ == '__main__':
    main()
