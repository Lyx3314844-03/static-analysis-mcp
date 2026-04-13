#!/usr/bin/env python3
"""
静态分析自动修复工具
对于简单问题提供一键修复能力
"""

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Tuple
import difflib


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


class AutoFixer:
    """自动修复器"""
    
    def __init__(self, dry_run: bool = True):
        self.dry_run = dry_run  # 默认只预览不实际修改
        self.fix_count = 0
        self.fixes_applied = []
    
    def read_file(self, file_path: str) -> str:
        """读取文件内容"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def write_file(self, file_path: str, content: str, backup: bool = True):
        """写入文件内容"""
        if self.dry_run:
            logging.info(f"{Colors.BLUE}[预览] 将写入 {file_path}{Colors.RESET}")
            return
        
        if backup:
            backup_path = file_path + '.bak'
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.write(self.read_file(file_path))
            logging.info(f"{Colors.YELLOW}[备份] 已创建备份 {backup_path}{Colors.RESET}")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        logging.info(f"{Colors.GREEN}[修复] 已修复 {file_path}{Colors.RESET}")
        self.fix_count += 1
    
    def show_diff(self, original: str, fixed: str, file_path: str):
        """显示差异"""
        diff = difflib.unified_diff(
            original.splitlines(keepends=True),
            fixed.splitlines(keepends=True),
            fromfile=f'a/{file_path}',
            tofile=f'b/{file_path}',
            n=3
        )
        logging.info(''.join(diff))
    
    # ========== 修复规则 ==========
    
    def fix_print_to_logging(self, file_path: str) -> bool:
        """将 print 语句转换为 logging"""
        code = self.read_file(file_path)
        original = code
        
        # 检查是否已有 logging 导入
        has_logging = 'import logging' in code or 'from logging import' in code
        
        # 替换 print 语句
        patterns = [
            # logging.info("...") → logging.info("...")
            (r'^(\s*)print\((["\'].*?["\'])\)\s*$', r'\1logging.info(\2)'),
            # logging.info(f"...") → logging.info(f"...")
            (r'^(\s*)print\(f(["\'].*?["\'])\)\s*$', r'\1logging.info(f\2)'),
            # logging.info(var) → logging.info(var)
            (r'^(\s*)print\(([^"\'][^)]*[^"\'])\)\s*$', r'\1logging.info(\2)'),
        ]
        
        for pattern, replacement in patterns:
            code = re.sub(pattern, replacement, code, flags=re.MULTILINE)
        
        # 添加 logging 导入
        if has_logging != code and 'logging' in code:
            if 'import logging' not in code:
                code = 'import logging\n' + code
        
        if original != code:
            logging.info(f"\n{Colors.YELLOW}发现可修复的 print 语句{Colors.RESET}")
            self.show_diff(original, code, file_path)
            if not self.dry_run:
                self.write_file(file_path, code)
            self.fixes_applied.append({
                'file': file_path,
                'type': 'print_to_logging',
                'changes': code.count('logging.info') - original.count('logging.info')
            })
            return True
        
        return False
    
    def fix_hardcoded_secrets(self, file_path: str) -> bool:
        """修复硬编码的秘密"""
        code = self.read_file(file_path)
        original = code
        fixes = []
        
        # 检测模式
        secret_patterns = [
            # password = "..."
            (r'(\bpassword\b\s*=\s*)(["\'])([^"\']{4,})\2',
             r'\1os.environ.get("PASSWORD")'),
            # api_key = "..."
            (r'(\b(api_key|apikey|api_secret)\b\s*=\s*)(["\'])([^"\']{8,})\3',
             r'\1os.environ.get("API_KEY")'),
            # secret = "..."
            (r'(\b(secret|token)\b\s*=\s*)(["\'])([^"\']{8,})\3',
             r'\1os.environ.get("SECRET")'),
            # SECRET_KEY = "..."
            (r'(\b[A-Z_]*(SECRET|KEY|PASSWORD)[A-Z_]*\s*=\s*)(["\'])([^"\']{4,})\3',
             r'\1os.environ.get("\2")'),
        ]
        
        for pattern, replacement in secret_patterns:
            matches = re.findall(pattern, code, re.IGNORECASE)
            if matches:
                fixes.append(len(matches))
                code = re.sub(pattern, replacement, code, flags=re.IGNORECASE)
        
        # 添加 os 导入
        if fixes and 'import os' not in code:
            code = 'import os\n' + code
        
        if fixes:
            logging.info(f"\n{Colors.YELLOW}发现 {sum(fixes)} 处硬编码的秘密{Colors.RESET}")
            self.show_diff(original, code, file_path)
            if not self.dry_run:
                self.write_file(file_path, code)
            self.fixes_applied.append({
                'file': file_path,
                'type': 'hardcoded_secrets',
                'count': sum(fixes)
            })
            return True
        
        return False
    
    def fix_bare_except(self, file_path: str) -> bool:
        """修复裸 except"""
        code = self.read_file(file_path)
        original = code
        
        # 匹配裸 except
        pattern = r'(\s+)except\s*:\s*\n(\s+)(pass|continue|break)'
        
        def replace_except(match):
            indent = match.group(1)
            inner_indent = match.group(2)
            action = match.group(3)
            return f"""{indent}except Exception as e:
{inner_indent}import logging
{inner_indent}logging.error(f"Exception: {{e}}")
{inner_indent}{action}"""
        
        code = re.sub(pattern, replace_except, code)
        
        if original != code:
            logging.info(f"\n{Colors.YELLOW}发现裸 except 语句{Colors.RESET}")
            self.show_diff(original, code, file_path)
            if not self.dry_run:
                self.write_file(file_path, code)
            self.fixes_applied.append({
                'file': file_path,
                'type': 'bare_except',
                'changes': 1
            })
            return True
        
        return False
    
    def fix_weak_crypto(self, file_path: str) -> bool:
        """修复弱加密算法"""
        code = self.read_file(file_path)
        original = code
        fixes = []
        
        # MD5 → SHA256
        if 'hashlib.md5(' in code:
            fixes.append('MD5')
            code = code.replace('hashlib.md5(', 'hashlib.sha256(')
        
        # SHA1 → SHA256
        if 'hashlib.sha1(' in code:
            fixes.append('SHA1')
            code = code.replace('hashlib.sha1(', 'hashlib.sha256(')
        
        if fixes:
            logging.info(f"\n{Colors.YELLOW}发现弱加密算法：{', '.join(fixes)}{Colors.RESET}")
            self.show_diff(original, code, file_path)
            if not self.dry_run:
                self.write_file(file_path, code)
            self.fixes_applied.append({
                'file': file_path,
                'type': 'weak_crypto',
                'algorithms': fixes
            })
            return True
        
        return False
    
    def fix_resource_leak(self, file_path: str) -> bool:
        """修复资源泄露"""
        code = self.read_file(file_path)
        original = code
        fixes = []
        
        # 检测 open() 没有使用 with
        pattern = r'(\w+)\s*=\s*open\(([^)]+)\)\s*\n(.*?)(?=\1\.close\(\))'
        
        matches = list(re.finditer(pattern, code, re.DOTALL))
        if matches:
            for match in matches:
                var_name = match.group(1)
                args = match.group(2)
                body = match.group(3)
                
                # 转换为 with 语句
                fixed = f"""with open({args}) as {var_name}:
{body}"""
                code = code[:match.start()] + fixed + code[match.end():]
                fixes.append(var_name)
        
        if fixes:
            logging.info(f"\n{Colors.YELLOW}发现资源泄露风险：{', '.join(fixes)}{Colors.RESET}")
            self.show_diff(original, code, file_path)
            if not self.dry_run:
                self.write_file(file_path, code)
            self.fixes_applied.append({
                'file': file_path,
                'type': 'resource_leak',
                'variables': fixes
            })
            return True
        
        return False
    
    def fix_all(self, file_path: str) -> Dict:
        """应用所有修复"""
        logging.info(f"\n{'='*60}")
        logging.info(f"分析文件：{file_path}")
        logging.info(f"{'='*60}")
        
        results = {
            'file': file_path,
            'fixes': []
        }
        
        # 依次尝试各种修复
        fixers = [
            ('print → logging', self.fix_print_to_logging),
            ('硬编码秘密', self.fix_hardcoded_secrets),
            ('裸 except', self.fix_bare_except),
            ('弱加密', self.fix_weak_crypto),
            ('资源泄露', self.fix_resource_leak),
        ]
        
        for name, fixer in fixers:
            try:
                if fixer(file_path):
                    results['fixes'].append(name)
            except Exception as e:
                logging.info(f"{Colors.RED}修复 {name} 失败：{e}{Colors.RESET}")
        
        return results
    
    def scan_directory(self, directory: str, extensions: List[str] = None) -> List[Dict]:
        """扫描目录并修复"""
        if extensions is None:
            extensions = ['.py']
        
        results = []
        dir_path = Path(directory)
        
        for ext in extensions:
            for file_path in dir_path.glob(f'**/*{ext}'):
                if file_path.is_file():
                    # 排除常见目录
                    exclude_dirs = ['node_modules', 'venv', '.venv', 'dist', 'build', '.git']
                    if any(exclude in str(file_path) for exclude in exclude_dirs):
                        continue
                    
                    result = self.fix_all(str(file_path))
                    if result['fixes']:
                        results.append(result)
        
        return results
    
    def generate_report(self) -> str:
        """生成修复报告"""
        report = []
        report.append("# 自动修复报告\n")
        report.append(f"修复数量：{self.fix_count}\n")
        report.append(f"运行模式：{'预览' if self.dry_run else '实际修复'}\n")
        
        if self.fixes_applied:
            report.append("\n## 修复详情\n")
            for fix in self.fixes_applied:
                report.append(f"\n### {fix['file']}\n")
                report.append(f"- 类型：{fix['type']}\n")
                if 'count' in fix:
                    report.append(f"- 数量：{fix['count']}\n")
                if 'changes' in fix:
                    report.append(f"- 变更：{fix['changes']} 处\n")
        
        return '\n'.join(report)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='静态分析自动修复工具')
    parser.add_argument('path', nargs='?', default='.', 
                       help='要修复的文件或目录')
    parser.add_argument('--apply', action='store_true',
                       help='实际执行修复（默认只预览）')
    parser.add_argument('-o', '--output',
                       help='输出报告文件')
    parser.add_argument('--fix', choices=['all', 'print', 'secrets', 'except', 'crypto', 'resource'],
                       default='all',
                       help='选择修复类型')
    
    args = parser.parse_args()
    
    fixer = AutoFixer(dry_run=not args.apply)
    
    path = Path(args.path)
    
    logging.info(f"\n{Colors.BOLD}静态分析自动修复工具{Colors.RESET}")
    logging.info(f"模式：{'预览' if fixer.dry_run else '实际修复'}")
    logging.info(f"目标：{path.absolute()}")
    
    if path.is_file():
        fixer.fix_all(str(path))
    else:
        fixer.scan_directory(str(path))
    
    # 生成报告
    report = fixer.generate_report()
    
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        logging.info(f"\n{Colors.GREEN}报告已保存到：{args.output}{Colors.RESET}")
    else:
        logging.info("\n" + report)
    
    logging.info(f"\n{Colors.GREEN}完成！共修复 {fixer.fix_count} 个文件{Colors.RESET}")


if __name__ == '__main__':
    main()
