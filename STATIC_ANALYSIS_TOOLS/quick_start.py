#!/usr/bin/env python3
"""
静态分析 MCP 快速启动脚本
提供交互式菜单和自动化工作流
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
import webbrowser

# ANSI 颜色代码
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """打印标题"""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text.center(60)}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}\n")


def print_menu(options: List[str]):
    """打印菜单"""
    for i, option in enumerate(options, 1):
        print(f"  {Colors.YELLOW}[{i}]{Colors.RESET} {option}")
    print()


def read_file(file_path: str) -> str:
    """读取文件内容"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        print(f"{Colors.RED}错误：读取文件失败 - {e}{Colors.RESET}")
        return None


def detect_language(file_path: str) -> str:
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
    
    path = Path(file_path)
    if path.name == 'Dockerfile':
        return 'dockerfile'
    
    return ext_map.get(path.suffix.lower(), None)


def quick_security_scan():
    """快速安全检查"""
    print_header("快速安全检查")
    
    file_path = input(f"{Colors.CYAN}请输入要扫描的文件路径：{Colors.RESET}").strip()
    
    if not os.path.exists(file_path):
        print(f"{Colors.RED}错误：文件不存在{Colors.RESET}")
        return
    
    code = read_file(file_path)
    if not code:
        return
    
    language = detect_language(file_path)
    if not language:
        print(f"{Colors.RED}错误：不支持的文件类型{Colors.RESET}")
        return
    
    print(f"\n{Colors.GREEN}检测到语言：{language}{Colors.RESET}")
    print(f"{Colors.CYAN}准备调用 Semgrep 进行安全检查...{Colors.RESET}")
    
    # 生成 MCP 调用命令
    mcp_call = {
        "tool": "constant_quadruped/semgrep-mcp-server:security_check",
        "input": {
            "code": code,
            "language": language,
            "filename": os.path.basename(file_path)
        }
    }
    
    print(f"\n{Colors.YELLOW}MCP 调用:{Colors.RESET}")
    print(json.dumps(mcp_call, indent=2, ensure_ascii=False))
    
    print(f"\n{Colors.CYAN}提示：将上面的调用复制到 MCP 客户端执行{Colors.RESET}")


def full_project_scan():
    """完整项目扫描"""
    print_header("完整项目扫描")
    
    project_path = input(f"{Colors.CYAN}请输入项目路径：{Colors.RESET}").strip()
    
    if not os.path.exists(project_path):
        print(f"{Colors.RED}错误：项目路径不存在{Colors.RESET}")
        return
    
    # 扫描配置
    config = input(f"{Colors.CYAN}Semgrep 配置 (默认:auto): {Colors.RESET}").strip() or 'auto'
    timeout = input(f"{Colors.CYAN}超时时间 (秒，默认:120): {Colors.RESET}").strip() or '120'
    
    # 查找所有代码文件
    extensions = ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.rb', '.php']
    files = []
    
    print(f"\n{Colors.CYAN}正在扫描项目文件...{Colors.RESET}")
    
    for ext in extensions:
        for file_path in Path(project_path).glob(f'**/*{ext}'):
            if file_path.is_file():
                # 排除常见目录
                exclude_dirs = ['node_modules', 'venv', '.venv', 'dist', 'build', '.git']
                if any(exclude in str(file_path) for exclude in exclude_dirs):
                    continue
                
                content = read_file(str(file_path))
                if content:
                    rel_path = str(file_path.relative_to(project_path))
                    files.append({
                        "path": rel_path,
                        "content": content
                    })
                    print(f"  ✓ {rel_path}")
    
    if not files:
        print(f"{Colors.RED}错误：未找到可扫描的文件{Colors.RESET}")
        return
    
    print(f"\n{Colors.GREEN}找到 {len(files)} 个文件{Colors.RESET}")
    print(f"{Colors.CYAN}准备调用 Semgrep 进行完整扫描...{Colors.RESET}")
    
    # 生成 MCP 调用命令
    mcp_call = {
        "tool": "constant_quadruped/semgrep-mcp-server:semgrep_scan",
        "input": {
            "codeFiles": files,
            "config": config,
            "timeout": int(timeout)
        }
    }
    
    print(f"\n{Colors.YELLOW}MCP 调用:{Colors.RESET}")
    print(json.dumps(mcp_call, indent=2, ensure_ascii=False))
    
    print(f"\n{Colors.CYAN}提示：将上面的调用复制到 MCP 客户端执行{Colors.RESET}")


def custom_rule_scan():
    """自定义规则扫描"""
    print_header("自定义规则扫描")
    
    file_path = input(f"{Colors.CYAN}请输入要扫描的文件路径：{Colors.RESET}").strip()
    rule_path = input(f"{Colors.CYAN}请输入规则文件路径：{Colors.RESET}").strip()
    
    if not os.path.exists(file_path) or not os.path.exists(rule_path):
        print(f"{Colors.RED}错误：文件不存在{Colors.RESET}")
        return
    
    code = read_file(file_path)
    rule = read_file(rule_path)
    
    if not code or not rule:
        return
    
    language = detect_language(file_path)
    if not language:
        print(f"{Colors.RED}错误：不支持的文件类型{Colors.RESET}")
        return
    
    print(f"\n{Colors.GREEN}检测到语言：{language}{Colors.RESET}")
    print(f"{Colors.CYAN}准备调用 Semgrep 自定义规则扫描...{Colors.RESET}")
    
    # 生成 MCP 调用命令
    mcp_call = {
        "tool": "constant_quadruped/semgrep-mcp-server:semgrep_scan_custom_rule",
        "input": {
            "code": code,
            "rule": rule,
            "language": language
        }
    }
    
    print(f"\n{Colors.YELLOW}MCP 调用:{Colors.RESET}")
    print(json.dumps(mcp_call, indent=2, ensure_ascii=False))
    
    print(f"\n{Colors.CYAN}提示：将上面的调用复制到 MCP 客户端执行{Colors.RESET}")


def dependency_scan():
    """依赖项扫描"""
    print_header("依赖项漏洞扫描")
    
    dep_file = input(f"{Colors.CYAN}请输入依赖文件路径 (requirements.txt/package.json): {Colors.RESET}").strip()
    
    if not os.path.exists(dep_file):
        print(f"{Colors.RED}错误：文件不存在{Colors.RESET}")
        return
    
    print(f"{Colors.CYAN}准备调用 CodeScalpel 进行依赖扫描...{Colors.RESET}")
    
    # 生成 MCP 调用命令
    mcp_call = {
        "tool": "mcp__codescalpel__scan_dependencies",
        "input": {
            "path": dep_file,
            "include_dev": True,
            "scan_vulnerabilities": True,
            "timeout": 30
        }
    }
    
    print(f"\n{Colors.YELLOW}MCP 调用:{Colors.RESET}")
    print(json.dumps(mcp_call, indent=2, ensure_ascii=False))
    
    print(f"\n{Colors.CYAN}提示：将上面的调用复制到 MCP 客户端执行{Colors.RESET}")


def complexity_analysis():
    """复杂度分析"""
    print_header("代码复杂度分析")
    
    file_path = input(f"{Colors.CYAN}请输入要分析的文件或目录：{Colors.RESET}").strip()
    
    if not os.path.exists(file_path):
        print(f"{Colors.RED}错误：路径不存在{Colors.RESET}")
        return
    
    print(f"{Colors.CYAN}准备调用 CodeGraph 进行复杂度分析...{Colors.RESET}")
    
    # 生成 MCP 调用命令
    mcp_call = {
        "tool": "mcp__codegraph__complexity",
        "input": {
            "file": file_path,
            "above_threshold": True,
            "health": True
        }
    }
    
    print(f"\n{Colors.YELLOW}MCP 调用:{Colors.RESET}")
    print(json.dumps(mcp_call, indent=2, ensure_ascii=False))
    
    print(f"\n{Colors.CYAN}提示：将上面的调用复制到 MCP 客户端执行{Colors.RESET}")


def show_documentation():
    """显示文档"""
    print_header("文档和资源")
    
    docs = [
        ("主指南", "STATIC_ANALYSIS_MCP_GUIDE.md"),
        ("工具说明", "STATIC_ANALYSIS_TOOLS/README.md"),
        ("工作流示例", "STATIC_ANALYSIS_TOOLS/WORKFLOW_EXAMPLES.md"),
        ("Python 规则", "STATIC_ANALYSIS_TOOLS/semgrep_rules/python_security.yaml"),
        ("JavaScript 规则", "STATIC_ANALYSIS_TOOLS/semgrep_rules/javascript_security.yaml"),
    ]
    
    base_path = Path(__file__).parent
    
    for i, (name, path) in enumerate(docs, 1):
        full_path = base_path / path
        exists = "✓" if full_path.exists() else "✗"
        print(f"  {Colors.YELLOW}[{i}]{Colors.RESET} {exists} {name}: {path}")
    
    choice = input(f"\n{Colors.CYAN}选择要打开的文档 (1-5): {Colors.RESET}").strip()
    
    if choice.isdigit() and 1 <= int(choice) <= len(docs):
        doc_path = base_path / docs[int(choice)-1][1]
        if doc_path.exists():
            print(f"\n{Colors.GREEN}正在打开文档...{Colors.RESET}")
            # 在默认编辑器中打开
            os.startfile(str(doc_path))
        else:
            print(f"{Colors.RED}错误：文档不存在{Colors.RESET}")


def main():
    """主函数"""
    print_header("🔍 静态分析 MCP 工具集")
    
    while True:
        print_menu([
            "快速安全检查 (Semgrep)",
            "完整项目扫描 (Semgrep)",
            "自定义规则扫描",
            "依赖项漏洞扫描",
            "代码复杂度分析",
            "查看文档",
            "退出"
        ])
        
        choice = input(f"{Colors.CYAN}请选择操作 (1-7): {Colors.RESET}").strip()
        
        if choice == '1':
            quick_security_scan()
        elif choice == '2':
            full_project_scan()
        elif choice == '3':
            custom_rule_scan()
        elif choice == '4':
            dependency_scan()
        elif choice == '5':
            complexity_analysis()
        elif choice == '6':
            show_documentation()
        elif choice == '7':
            print(f"\n{Colors.GREEN}再见！{Colors.RESET}\n")
            break
        else:
            print(f"{Colors.RED}无效选择，请重试{Colors.RESET}")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}程序中断{Colors.RESET}")
        sys.exit(0)
