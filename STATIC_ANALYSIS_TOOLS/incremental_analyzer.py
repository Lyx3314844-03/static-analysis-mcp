import logging

#!/usr/bin/env python3
"""
基于 Git 变更的增量静态分析工具
只扫描变更文件，提高效率
"""

import os
import json
import subprocess
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class IncrementalAnalyzer:
    """增量分析器"""
    
    def __init__(self, project_root: str = None):
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.cache_dir = self.project_root / '.static_analysis_cache'
        self.cache_dir.mkdir(exist_ok=True)
        self.results = []
    
    def run_git_command(self, args: List[str]) -> str:
        """运行 Git 命令"""
        try:
            result = subprocess.run(
                ['git'] + args,
                cwd=self.project_root,
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            logging.info(f"{Colors.RED}Git 命令失败：{e}{Colors.RESET}")
            return ""
        except FileNotFoundError:
            logging.info(f"{Colors.RED}错误：未找到 Git，请确保已安装 Git{Colors.RESET}")
            return ""
    
    def is_git_repo(self) -> bool:
        """检查是否是 Git 仓库"""
        git_dir = self.run_git_command(['rev-parse', '--git-dir'])
        return bool(git_dir)
    
    def get_changed_files(self, ref: str = 'HEAD~1') -> List[Dict]:
        """获取变更的文件列表"""
        if not self.is_git_repo():
            logging.info(f"{Colors.YELLOW}警告：不是 Git 仓库，将扫描所有文件{Colors.RESET}")
            return self.get_all_files()
        
        # 获取变更文件
        diff_output = self.run_git_command(['diff', '--name-only', ref])
        
        if not diff_output:
            # 尝试获取未提交的变更
            diff_output = self.run_git_command(['diff', '--cached', '--name-only'])
        
        if not diff_output:
            logging.info(f"{Colors.YELLOW}警告：没有检测到变更{Colors.RESET}")
            return []
        
        changed_files = []
        for file_path in diff_output.splitlines():
            full_path = self.project_root / file_path
            
            if full_path.exists() and full_path.is_file():
                # 只包含代码文件
                if self.is_code_file(full_path):
                    changed_files.append({
                        'path': str(full_path),
                        'relative_path': file_path,
                        'status': 'modified'
                    })
        
        # 获取新增的文件
        added_output = self.run_git_command(['diff', '--name-status', ref])
        for line in added_output.splitlines():
            if line.startswith('A\t'):  # Added
                file_path = line.split('\t')[1]
                full_path = self.project_root / file_path
                if full_path.exists() and self.is_code_file(full_path):
                    changed_files.append({
                        'path': str(full_path),
                        'relative_path': file_path,
                        'status': 'added'
                    })
        
        return changed_files
    
    def get_staged_files(self) -> List[Dict]:
        """获取暂存区的文件"""
        output = self.run_git_command(['diff', '--cached', '--name-status'])
        
        staged_files = []
        for line in output.splitlines():
            if '\t' in line:
                status, file_path = line.split('\t', 1)
                full_path = self.project_root / file_path
                
                if full_path.exists() and self.is_code_file(full_path):
                    staged_files.append({
                        'path': str(full_path),
                        'relative_path': file_path,
                        'status': 'staged'
                    })
        
        return staged_files
    
    def get_uncommitted_files(self) -> List[Dict]:
        """获取未提交的变更文件"""
        # 已修改的文件
        modified_output = self.run_git_command(['diff', '--name-only'])
        
        uncommitted = []
        for file_path in modified_output.splitlines():
            full_path = self.project_root / file_path
            if full_path.exists() and self.is_code_file(full_path):
                uncommitted.append({
                    'path': str(full_path),
                    'relative_path': file_path,
                    'status': 'uncommitted'
                })
        
        # 未跟踪的文件
        untracked_output = self.run_git_command(['ls-files', '--others', '--exclude-standard'])
        for file_path in untracked_output.splitlines():
            full_path = self.project_root / file_path
            if full_path.exists() and self.is_code_file(full_path):
                uncommitted.append({
                    'path': str(full_path),
                    'relative_path': file_path,
                    'status': 'untracked'
                })
        
        return uncommitted
    
    def is_code_file(self, file_path: Path) -> bool:
        """检查是否是代码文件"""
        code_extensions = {
            '.py', '.js', '.ts', '.jsx', '.tsx',
            '.java', '.go', '.rb', '.php',
            '.c', '.cpp', '.cs', '.h', '.hpp',
            '.kt', '.scala', '.rs', '.swift',
            '.yaml', '.yml', '.json',
            '.Dockerfile', '.tf'
        }
        
        if file_path.name == 'Dockerfile':
            return True
        
        return file_path.suffix.lower() in code_extensions
    
    def get_all_files(self) -> List[Dict]:
        """获取所有代码文件"""
        all_files = []
        
        for ext in ['.py', '.js', '.ts', '.java', '.go', '.rb', '.php']:
            for file_path in self.project_root.glob(f'**/*{ext}'):
                if file_path.is_file():
                    # 排除常见目录
                    exclude_dirs = ['node_modules', 'venv', '.venv', 'dist', 'build', '.git']
                    if any(exclude in str(file_path) for exclude in exclude_dirs):
                        continue
                    
                    all_files.append({
                        'path': str(file_path),
                        'relative_path': str(file_path.relative_to(self.project_root)),
                        'status': 'all'
                    })
        
        return all_files
    
    def get_file_hash(self, file_path: str) -> str:
        """获取文件哈希"""
        import hashlib
        with open(file_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    
    def is_file_changed(self, file_path: str) -> bool:
        """检查文件是否已变更（通过哈希对比）"""
        cache_file = self.cache_dir / f"{file_path.replace('/', '_').replace('\\', '_')}.hash"
        current_hash = self.get_file_hash(file_path)
        
        if cache_file.exists():
            with open(cache_file, 'r') as f:
                cached_hash = f.read().strip()
            return current_hash != cached_hash
        return True
    
    def update_cache(self, file_path: str):
        """更新文件缓存"""
        cache_file = self.cache_dir / f"{file_path.replace('/', '_').replace('\\', '_')}.hash"
        current_hash = self.get_file_hash(file_path)
        with open(cache_file, 'w') as f:
            f.write(current_hash)
    
    def generate_mcp_call(self, files: List[Dict]) -> List[Dict]:
        """生成 MCP 调用"""
        calls = []
        
        for file_info in files:
            file_path = file_info['path']
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 检测语言
            language = self.detect_language(Path(file_path))
            
            if language:
                call = {
                    "tool": "constant_quadruped/semgrep-mcp-server:security_check",
                    "input": {
                        "code": content,
                        "language": language,
                        "filename": file_info['relative_path']
                    },
                    "metadata": file_info
                }
                calls.append(call)
        
        return calls
    
    def detect_language(self, file_path: Path) -> str:
        """检测文件语言"""
        ext_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.java': 'java',
            '.go': 'go',
            '.rb': 'ruby',
            '.php': 'php',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.rs': 'rust',
            '.swift': 'swift',
            '.sh': 'bash',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.json': 'json',
            '.tf': 'terraform',
        }
        
        if file_path.name == 'Dockerfile':
            return 'dockerfile'
        
        return ext_map.get(file_path.suffix.lower(), None)
    
    def analyze(self, 
                mode: str = 'changed',
                ref: str = 'HEAD~1') -> Dict:
        """执行增量分析"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.CYAN}增量静态分析{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")
        
        if not self.is_git_repo():
            logging.info(f"{Colors.YELLOW}警告：当前目录不是 Git 仓库{Colors.RESET}")
            mode = 'all'
        
        # 获取要分析的文件
        if mode == 'changed':
            files = self.get_changed_files(ref)
            logging.info(f"{Colors.BLUE}扫描模式：变更文件 ({ref}){Colors.RESET}")
        elif mode == 'staged':
            files = self.get_staged_files()
            logging.info(f"{Colors.BLUE}扫描模式：暂存区文件{Colors.RESET}")
        elif mode == 'uncommitted':
            files = self.get_uncommitted_files()
            logging.info(f"{Colors.BLUE}扫描模式：未提交变更{Colors.RESET}")
        elif mode == 'all':
            files = self.get_all_files()
            logging.info(f"{Colors.BLUE}扫描模式：所有文件{Colors.RESET}")
        else:
            logging.info(f"{Colors.RED}错误：未知的扫描模式 {mode}{Colors.RESET}")
            return {}
        
        logging.info(f"{Colors.GREEN}找到 {len(files)} 个文件{Colors.RESET}")
        
        if not files:
            return {'files': [], 'mcp_calls': []}
        
        # 过滤未变更的文件（通过缓存）
        if mode in ['changed', 'uncommitted']:
            changed_files = [f for f in files if self.is_file_changed(f['path'])]
            unchanged_count = len(files) - len(changed_files)
            if unchanged_count > 0:
                logging.info(f"{Colors.YELLOW}跳过 {unchanged_count} 个未变更文件（使用缓存）{Colors.RESET}")
            files = changed_files
        
        if not files:
            logging.info(f"{Colors.GREEN}所有文件均未变更，无需扫描{Colors.RESET}")
            return {'files': [], 'mcp_calls': []}
        
        # 生成 MCP 调用
        mcp_calls = self.generate_mcp_call(files)
        
        # 更新缓存
        for file_info in files:
            self.update_cache(file_info['path'])
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'mode': mode,
            'ref': ref if mode == 'changed' else None,
            'files': files,
            'file_count': len(files),
            'mcp_calls': mcp_calls
        }
        
        # 保存结果
        result_file = self.cache_dir / f'analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        logging.info(f"\n{Colors.GREEN}分析结果已保存到：{result_file}{Colors.RESET}")
        
        return result
    
    def print_mcp_calls(self, result: Dict):
        """打印 MCP 调用"""
        if not result or not result.get('mcp_calls'):
            return
        
        logging.info(f"\n{Colors.BOLD}{Colors.YELLOW}{'='*60}{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.YELLOW}MCP 调用列表{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.YELLOW}{'='*60}{Colors.RESET}\n")
        
        for i, call in enumerate(result['mcp_calls'], 1):
            logging.info(f"{Colors.CYAN}[{i}/{len(result['mcp_calls'])}] {call['metadata']['relative_path']}{Colors.RESET}")
            logging.info(f"工具：{call['tool']}")
            logging.info(f"语言：{call['input']['language']}")
            logging.info(f"状态：{call['metadata']['status']}")
            logging.info(f"{Colors.BLUE}---{Colors.RESET}")
            logging.info(json.dumps(call, indent=2, ensure_ascii=False))
            logging.info(f"{Colors.BLUE}---{Colors.RESET}\n")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='增量静态分析工具')
    parser.add_argument('mode', nargs='?', 
                       choices=['changed', 'staged', 'uncommitted', 'all'],
                       default='changed',
                       help='扫描模式')
    parser.add_argument('--ref', default='HEAD~1',
                       help='Git 引用（用于 changed 模式）')
    parser.add_argument('--project', default='.',
                       help='项目根目录')
    parser.add_argument('--no-cache', action='store_true',
                       help='忽略缓存，扫描所有文件')
    
    args = parser.parse_args()
    
    analyzer = IncrementalAnalyzer(args.project)
    
    if args.no_cache:
        # 清除缓存
        import shutil
        if analyzer.cache_dir.exists():
            shutil.rmtree(analyzer.cache_dir)
            logging.info(f"{Colors.GREEN}缓存已清除{Colors.RESET}")
    
    result = analyzer.analyze(mode=args.mode, ref=args.ref)
    
    if result and result.get('mcp_calls'):
        analyzer.print_mcp_calls(result)
        
        # 保存调用列表到单独文件
        calls_file = analyzer.cache_dir / 'mcp_calls.json'
        with open(calls_file, 'w', encoding='utf-8') as f:
            json.dump(result['mcp_calls'], f, indent=2, ensure_ascii=False)
        logging.info(f"\n{Colors.GREEN}MCP 调用列表已保存到：{calls_file}{Colors.RESET}")
    else:
        logging.info(f"\n{Colors.YELLOW}没有需要扫描的文件{Colors.RESET}")


if __name__ == '__main__':
    main()
