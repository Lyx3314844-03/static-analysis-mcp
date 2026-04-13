import logging

#!/usr/bin/env python3
"""
Static Analysis MCP 深度代码检查脚本
检查代码质量、安全漏洞、最佳实践、文档完整性等
"""

import os
import sys
import ast
import re
from pathlib import Path
from typing import List, Dict, Tuple
from collections import defaultdict


class Color:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class DeepCodeChecker:
    """深度代码检查器"""
    
    def __init__(self, root_dir: str):
        """
        初始化检查器
        
        Args:
            root_dir: 项目根目录
        """
        self.root_dir = Path(root_dir)
        self.tools_dir = self.root_dir / 'STATIC_ANALYSIS_TOOLS'
        self.scripts_dir = self.root_dir / 'scripts'
        
        self.issues = {
            'critical': [],
            'major': [],
            'minor': []
        }
        
        self.stats = {
            'total_files': 0,
            'total_lines': 0,
            'functions': 0,
            'classes': 0,
            'docstrings': 0,
            'type_hints': 0
        }
    
    def check_all(self):
        """执行所有深度检查"""
        logging.info(f"\n{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}Static Analysis MCP 深度代码检查{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}\n")
        
        # 收集所有 Python 文件
        py_files = []
        py_files.extend(self.tools_dir.glob('*.py'))
        py_files.extend(self.scripts_dir.glob('*.py'))
        
        self.stats['total_files'] = len(py_files)
        
        logging.info(f"检查范围：{len(py_files)} 个 Python 文件\n")
        logging.info(f"{Color.BLUE}{'='*80}{Color.RESET}\n")
        
        # 检查每个文件
        for py_file in py_files:
            self.deep_check_file(py_file)
        
        # 打印总结
        self.print_summary()
    
    def deep_check_file(self, file_path: Path):
        """
        深度检查单个文件
        
        Args:
            file_path: 文件路径
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            lines = content.split('\n')
            self.stats['total_lines'] += len(lines)
            
            # 解析 AST
            tree = ast.parse(content)
            
            # 1. 检查文档字符串
            self.check_docstrings(tree, file_path)
            
            # 2. 检查类型提示
            self.check_type_hints(tree, file_path)
            
            # 3. 检查代码复杂度
            self.check_complexity(tree, file_path, lines)
            
            # 4. 检查安全问题
            self.check_security_issues(content, file_path)
            
            # 5. 检查最佳实践
            self.check_best_practices(content, file_path, lines)
            
            # 6. 检查导入
            self.check_imports(tree, file_path)
            
            logging.info(f"{Color.GREEN}✅{Color.RESET} {file_path.name} ({len(lines)} 行)")
            
        except Exception as e:
            self.issues['critical'].append({
                'file': str(file_path),
                'issue': f'检查失败：{str(e)}'
            })
            logging.info(f"{Color.RED}❌{Color.RESET} {file_path.name} - {str(e)}")
    
    def check_docstrings(self, tree: ast.AST, file_path: Path):
        """检查文档字符串"""
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                docstring = ast.get_docstring(node)
                if docstring:
                    self.stats['docstrings'] += 1
                else:
                    # 特殊方法可以没有文档字符串
                    if not node.name.startswith('_') or node.name == '__init__':
                        self.issues['minor'].append({
                            'file': str(file_path),
                            'line': node.lineno,
                            'issue': f"{node.__class__.__name__} '{node.name}' 缺少文档字符串"
                        })
    
    def check_type_hints(self, tree: ast.AST, file_path: Path):
        """检查类型提示"""
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # 检查返回值类型
                if node.returns:
                    self.stats['type_hints'] += 1
                # 检查参数类型
                for arg in node.args.args:
                    if arg.annotation:
                        self.stats['type_hints'] += 1
                    elif arg.arg != 'self':
                        self.issues['minor'].append({
                            'file': str(file_path),
                            'line': arg.lineno,
                            'issue': f"参数 '{arg.arg}' 缺少类型提示"
                        })
    
    def check_complexity(self, tree: ast.AST, file_path: Path, lines: List[str]):
        """检查代码复杂度"""
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # 计算圈复杂度
                complexity = 1
                for child in ast.walk(node):
                    if isinstance(child, (ast.If, ast.For, ast.While, ast.ExceptHandler,
                                        ast.With, ast.Assert, ast.comprehension)):
                        complexity += 1
                
                if complexity > 10:
                    self.issues['major'].append({
                        'file': str(file_path),
                        'line': node.lineno,
                        'issue': f"函数 '{node.name}' 复杂度过高 ({complexity})，建议拆分"
                    })
                
                # 检查函数长度
                func_lines = node.end_lineno - node.lineno + 1 if hasattr(node, 'end_lineno') else 50
                if func_lines > 50:
                    self.issues['major'].append({
                        'file': str(file_path),
                        'line': node.lineno,
                        'issue': f"函数 '{node.name}' 过长 ({func_lines} 行)，建议拆分"
                    })
    
    def check_security_issues(self, content: str, file_path: Path):
        """检查安全问题"""
        security_patterns = [
            (r'eval\s*\(', '使用 eval() 可能导致代码注入'),
            (r'exec\s*\(', '使用 exec() 可能导致代码注入'),
            (r'os\.system\s*\(', '使用 os.system() 可能导致命令注入'),
            (r'subprocess\.call\s*\([^)]*shell\s*=\s*True', '使用 shell=True 可能导致命令注入'),
            (r'pickle\.loads?\s*\(', '使用 pickle 可能导致不安全反序列化'),
            (r'yaml\.load\s*\([^)]*\)', '使用 yaml.load() 可能导致不安全反序列化'),
            (r'input\s*\([^)]*\)\s*eval', '用户输入直接用于 eval'),
            (r'__import__\s*\(', '动态导入可能导致安全风险'),
        ]
        
        for pattern, message in security_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                line_num = content[:match.start()].count('\n') + 1
                self.issues['major'].append({
                    'file': str(file_path),
                    'line': line_num,
                    'issue': f"安全问题：{message}"
                })
    
    def check_best_practices(self, content: str, file_path: Path, lines: List[str]):
        """检查最佳实践"""
        # 检查裸 except
        for i, line in enumerate(lines, 1):
            if re.search(r'\bexcept\s*:', line) and not re.search(r'except\s+Exception', line):
                self.issues['minor'].append({
                    'file': str(file_path),
                    'line': i,
                    'issue': "使用裸 except，建议指定具体异常类型"
                })
        
        # 检查硬编码密码
        password_patterns = [
            r'password\s*=\s*["\'][^"\']+["\']',
            r'api_key\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']',
            r'token\s*=\s*["\'][^"\']+["\']',
        ]
        
        for pattern in password_patterns:
            matches = re.finditer(pattern, content)
            for match in matches:
                line_num = content[:match.start()].count('\n') + 1
                # 排除环境变量和配置
                if 'os.environ' not in content[match.start()-50:match.end()+50]:
                    self.issues['major'].append({
                        'file': str(file_path),
                        'line': line_num,
                        'issue': "发现硬编码的敏感信息"
                    })
        
        # 检查 print 语句（生产环境应使用 logging）
        for i, line in enumerate(lines, 1):
            if re.search(r'\bprint\s*\(', line) and not line.strip().startswith('#'):
                # 排除调试文件
                if 'debug' not in str(file_path).lower() and 'test' not in str(file_path).lower():
                    self.issues['minor'].append({
                        'file': str(file_path),
                        'line': i,
                        'issue': "使用 print 语句，生产环境建议使用 logging"
                    })
    
    def check_imports(self, tree: ast.AST, file_path: Path):
        """检查导入"""
        imports = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    imports.append(alias.name)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
        
        # 检查未使用的导入
        # 这里简化处理，实际需要更复杂的分析
    
    def print_summary(self):
        """打印总结"""
        logging.info(f"\n{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}深度检查总结{Color.RESET}")
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}\n")
        
        # 代码统计
        logging.info(f"{Color.BOLD}代码统计:{Color.RESET}")
        logging.info(f"  文件数：{self.stats['total_files']}")
        logging.info(f"  总行数：{self.stats['total_lines']}")
        logging.info(f"  函数/方法数：{self.stats['functions']}")
        logging.info(f"  类数：{self.stats['classes']}")
        logging.info(f"  有文档字符串：{self.stats['docstrings']}")
        logging.info(f"  有类型提示：{self.stats['type_hints']}\n")
        
        # 问题统计
        critical_count = len(self.issues['critical'])
        major_count = len(self.issues['major'])
        minor_count = len(self.issues['minor'])
        total_issues = critical_count + major_count + minor_count
        
        logging.info(f"{Color.BOLD}问题统计:{Color.RESET}")
        logging.info(f"  {Color.RED}严重问题：{critical_count}{Color.RESET}")
        logging.info(f"  {Color.YELLOW}主要问题：{major_count}{Color.RESET}")
        logging.info(f"  {Color.BLUE}次要问题：{minor_count}{Color.RESET}")
        logging.info(f"  总计：{total_issues}\n")
        
        # 显示严重问题
        if self.issues['critical']:
            logging.info(f"\n{Color.RED}严重问题:{Color.RESET}")
            for issue in self.issues['critical'][:10]:
                logging.info(f"  📁 {Path(issue['file']).name}:{issue.get('line', '?')}")
                logging.info(f"     ⚠️ {issue['issue']}")
        
        # 显示主要问题
        if self.issues['major']:
            logging.info(f"\n{Color.YELLOW}主要问题 (前 10 个):{Color.RESET}")
            for issue in self.issues['major'][:10]:
                logging.info(f"  📁 {Path(issue['file']).name}:{issue.get('line', '?')}")
                logging.info(f"     ⚠️ {issue['issue']}")
        
        # 显示次要问题（前 5 个）
        if self.issues['minor']:
            logging.info(f"\n{Color.BLUE}次要问题 (前 5 个):{Color.RESET}")
            for issue in self.issues['minor'][:5]:
                logging.info(f"  📁 {Path(issue['file']).name}:{issue.get('line', '?')}")
                logging.info(f"     ⚠️ {issue['issue']}")
        
        # 总体评分
        logging.info(f"\n{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}")
        
        if total_issues == 0:
            logging.info(f"\n{Color.GREEN}🎉 完美！没有发现任何问题！{Color.RESET}")
            quality_score = 100
        elif critical_count > 0:
            logging.info(f"\n{Color.RED}⚠️ 发现 {critical_count} 个严重问题，需要立即修复！{Color.RESET}")
            quality_score = 60
        elif major_count > 5:
            logging.info(f"\n{Color.YELLOW}⚠️ 发现 {major_count} 个主要问题，建议修复！{Color.RESET}")
            quality_score = 80
        else:
            logging.info(f"\n{Color.GREEN}✅ 代码质量良好！{Color.RESET}")
            quality_score = 90
        
        logging.info(f"\n代码质量评分：{quality_score}/100")
        logging.info(f"{Color.BOLD}{Color.CYAN}{'='*80}{Color.RESET}\n")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='深度代码检查脚本')
    parser.add_argument('--root', type=str, default='.', help='项目根目录')
    
    args = parser.parse_args()
    
    checker = DeepCodeChecker(args.root)
    checker.check_all()


if __name__ == '__main__':
    main()
