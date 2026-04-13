#!/usr/bin/env python3
"""
Static Analysis MCP 自动修复脚本
自动修复深度检查中发现的问题
"""

import os
import re
from pathlib import Path
from typing import List, Dict


class Color:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


class AutoFixer:
    """自动修复器"""
    
    def __init__(self, root_dir: str):
        """
        初始化修复器
        
        Args:
            root_dir: 项目根目录
        """
        self.root_dir = Path(root_dir)
        self.tools_dir = self.root_dir / 'STATIC_ANALYSIS_TOOLS'
        self.scripts_dir = self.root_dir / 'scripts'
        
        self.fixed_count = 0
        self.skipped_count = 0
    
    def fix_all(self):
        """执行所有修复"""
        logging.info(f"\n{Color.BLUE}{'='*80}{Color.RESET}")
        logging.info(f"{Color.BLUE}Static Analysis MCP 自动修复{Color.RESET}")
        logging.info(f"{Color.BLUE}{'='*80}{Color.RESET}\n")
        
        # 1. 修复硬编码敏感信息
        self.fix_hardcoded_secrets()
        
        # 2. 替换 print 为 logging
        self.fix_print_to_logging()
        
        # 3. 修复裸 except
        self.fix_bare_except()
        
        # 4. 添加缺失的文档字符串
        self.add_missing_docstrings()
        
        # 打印总结
        self.print_summary()
    
    def fix_hardcoded_secrets(self):
        """修复硬编码敏感信息"""
        logging.info(f"{Color.BOLD}【1/4】修复硬编码敏感信息{Color.RESET}")
        logging.info(f"{'-'*80}\n")
        
        files_to_fix = [
            self.tools_dir / 'ai_fix_suggestion.py',
            self.tools_dir / 'auto_fix.py',
        ]
        
        for file_path in files_to_fix:
            if not file_path.exists():
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # 修复硬编码的 API 密钥
            content = re.sub(
                r'(API_KEY|api_key|apikey)\s*=\s*["\']sk-[a-zA-Z0-9]+["\']',
                r'\1 = os.environ.get("OPENAI_API_KEY")',
                content
            )
            
            # 修复硬编码的密码
            content = re.sub(
                r'password\s*=\s*["\'][^"\']{4,}["\']',
                r'password = os.environ.get("PASSWORD")',
                content
            )
            
            # 添加 os 导入
            if 'os.environ' in content and 'import os' not in content:
                content = 'import os\n\n' + content
            
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                logging.info(f"  {Color.GREEN}✅{Color.RESET} 修复：{file_path.name}")
                self.fixed_count += 1
            else:
                logging.info(f"  {Color.YELLOW}⚠️{Color.RESET} 跳过：{file_path.name}")
                self.skipped_count += 1
        
        logging.info()
    
    def fix_print_to_logging(self):
        """替换 print 为 logging"""
        logging.info(f"{Color.BOLD}【2/4】替换 print 为 logging{Color.RESET}")
        logging.info(f"{'-'*80}\n")
        
        # 收集所有 Python 文件
        py_files = []
        py_files.extend(self.tools_dir.glob('*.py'))
        py_files.extend(self.scripts_dir.glob('*.py'))
        
        # 排除不需要修复的文件
        exclude_files = ['quick_start.py', 'check_functions.py', 'verify_and_fix.py']
        
        for file_path in py_files:
            if file_path.name in exclude_files:
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # 检查是否已有 logging 导入
            has_logging = 'import logging' in content or 'from logging import' in content
            
            # 替换 print 为 logging
            # 排除已经在字符串中的 print
            lines = content.split('\n')
            fixed_lines = []
            
            for line in lines:
                # 跳过注释和字符串中的 print
                if line.strip().startswith('#') or '"""' in line or "'''" in line:
                    fixed_lines.append(line)
                    continue
                
                # 替换 logging.info( 为 logging.info(
                if re.search(r'\bprint\s*\(', line):
                    line = re.sub(r'\bprint\s*\(', 'logging.info(', line)
                    if not has_logging:
                        has_logging = True
                        fixed_lines.insert(0, 'import logging')
                
                fixed_lines.append(line)
            
            content = '\n'.join(fixed_lines)
            
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                logging.info(f"  {Color.GREEN}✅{Color.RESET} 修复：{file_path.name}")
                self.fixed_count += 1
        
        logging.info()
    
    def fix_bare_except(self):
        """修复裸 except"""
        logging.info(f"{Color.BOLD}【3/4】修复裸 except{Color.RESET}")
        logging.info(f"{'-'*80}\n")
        
        # 收集所有 Python 文件
        py_files = []
        py_files.extend(self.tools_dir.glob('*.py'))
        py_files.extend(self.scripts_dir.glob('*.py'))
        
        for file_path in py_files:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # 替换裸 except
            lines = content.split('\n')
            fixed_lines = []
            
            for i, line in enumerate(lines):
                if re.search(r'\bexcept\s*:', line):
                    # 检查下一行是否是 pass
                    if i + 1 < len(lines) and 'pass' in lines[i + 1]:
                        # 替换为 except Exception as e: logging.error(...)
                        fixed_lines.append('    except Exception as e:')
                        fixed_lines.append(f'        logging.error(f"Error in {file_path.name}: {e}")')
                        continue
                fixed_lines.append(line)
            
            content = '\n'.join(fixed_lines)
            
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                logging.info(f"  {Color.GREEN}✅{Color.RESET} 修复：{file_path.name}")
                self.fixed_count += 1
        
        logging.info()
    
    def add_missing_docstrings(self):
        """添加缺失的文档字符串"""
        logging.info(f"{Color.BOLD}【4/4】添加缺失的文档字符串{Color.RESET}")
        logging.info(f"{'-'*80}\n")
        
        # 这个修复比较复杂，需要 AST 分析
        # 这里只做简单处理：为没有文档字符串的类添加
        logging.info(f"  {Color.YELLOW}⚠️{Color.RESET} 文档字符串需要手动添加")
        logging.info(f"  建议使用 IDE 插件或手动为类和函数添加文档字符串\n")
    
    def print_summary(self):
        """打印总结"""
        logging.info(f"{Color.BLUE}{'='*80}{Color.RESET}")
        logging.info(f"{Color.BLUE}修复总结{Color.RESET}")
        logging.info(f"{Color.BLUE}{'='*80}{Color.RESET}\n")
        
        logging.info(f"修复数量：{self.fixed_count}")
        logging.info(f"跳过数量：{self.skipped_count}")
        
        if self.fixed_count > 0:
            logging.info(f"\n{Color.GREEN}✅ 修复完成！{Color.RESET}")
        else:
            logging.info(f"\n{Color.YELLOW}⚠️ 没有需要修复的内容{Color.RESET}")
        
        logging.info(f"{Color.BLUE}{'='*80}{Color.RESET}\n")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='自动修复脚本')
    parser.add_argument('--root', type=str, default='.', help='项目根目录')
    
    args = parser.parse_args()
    
    fixer = AutoFixer(args.root)
    fixer.fix_all()


if __name__ == '__main__':
    main()
