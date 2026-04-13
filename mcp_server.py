#!/usr/bin/env python3
"""
Enhanced Static Analysis MCP Server
为 Qwen CLI 提供功能增强的 MCP 接口，整合了 AI 修复、增量扫描、风险预测等高级功能
"""

from mcp.server.fastmcp import FastMCP
from pathlib import Path
import subprocess
import sys
import os
import json
from typing import Optional, List, Dict

# 创建 MCP 服务器
mcp = FastMCP("Enhanced Static Analysis MCP")

# Resolve tool roots without assuming the repository must live under a fixed parent directory.
PROJECT_ROOT = Path(__file__).resolve().parent


def _resolve_workspace_root() -> Path:
    override = os.environ.get("STATIC_ANALYSIS_MCP_WORKSPACE_ROOT")
    if override:
        candidate = Path(override).resolve()
        if (candidate / "STATIC_ANALYSIS_TOOLS").exists() or (candidate / "scripts").exists():
            return candidate

    candidates = [PROJECT_ROOT]
    for candidate in candidates:
        if (candidate / "STATIC_ANALYSIS_TOOLS").exists() or (candidate / "scripts").exists():
            return candidate
    return PROJECT_ROOT


ROOT_DIR = _resolve_workspace_root()
TOOLS_DIR = ROOT_DIR / 'STATIC_ANALYSIS_TOOLS'
SCRIPTS_DIR = ROOT_DIR / 'scripts'


@mcp.tool()
def scan_project(project_path: str = ".", workers: int = 8) -> str:
    """
    扫描项目代码安全问题 (并行扫描)
    
    Args:
        project_path: 项目路径
        workers: 工作进程数
        
    Returns:
        扫描结果
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'parallel_scanner.py'),
        project_path,
        "-w", str(workers)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def incremental_scan(project_path: str = ".") -> str:
    """
    增量分析项目 (仅分析变更的文件)
    
    Args:
        project_path: 项目路径
        
    Returns:
        增量分析结果
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'incremental_analyzer.py'),
        "--project", project_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def auto_fix(project_path: str = ".", apply: bool = False) -> str:
    """
    自动修复代码问题
    
    Args:
        project_path: 项目路径
        apply: 是否实际应用修复
        
    Returns:
        修复结果
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'batch_auto_fix.py'),
        "--project", project_path
    ]
    if apply:
        cmd.append("--apply")
    else:
        cmd.append("--dry-run")
    
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def ai_fix_suggestion(file_path: str, rule_id: str, line: int) -> str:
    """
    生成 AI 代码修复建议
    
    Args:
        file_path: 文件路径
        rule_id: 违反的规则 ID
        line: 行号
        
    Returns:
        AI 修复建议
    """
    # 这里模拟从扫描结果中读取问题并传递给 AI 修复器
    # 实际脚本可能需要更复杂的参数，这里简化为演示
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'ai_fix_suggestion.py'),
        "--file", file_path,
        "--rule", rule_id,
        "--line", str(line)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def multi_model_fix(file_path: str) -> str:
    """
    使用多种 LLM 模型对比并修复代码
    
    Args:
        file_path: 文件路径
        
    Returns:
        多模型修复对比结果
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'multi_model_fixer.py'),
        "--file", file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def predict_risks(project_path: str = ".") -> str:
    """
    预测项目潜在风险和技术债务
    
    Args:
        project_path: 项目路径
        
    Returns:
        风险预测报告
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'predictive_analytics.py'),
        "--project", project_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def deep_security_scan(project_path: str = ".", output: str = "security_report.md") -> str:
    """
    执行深度安全扫描
    
    Args:
        project_path: 项目路径
        output: 输出报告文件名
        
    Returns:
        报告生成信息
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'deep_security_scan.py'),
        "--project", project_path,
        "--output", output
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def export_sarif(input_file: str, output_file: str = "results.sarif") -> str:
    """
    将分析结果导出为 SARIF 标准格式
    
    Args:
        input_file: 输入的 JSON 结果文件
        output_file: 输出的 SARIF 文件
        
    Returns:
        导出结果信息
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'sarif_export.py'),
        "--input", input_file,
        "--output", output_file
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def github_review_pr(repo: str, pr_number: int) -> str:
    """
    在 GitHub PR 中执行自动化代码审查
    
    Args:
        repo: 仓库名称 (owner/repo)
        pr_number: PR 编号
        
    Returns:
        审查状态
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'github_pr_reviewer.py'),
        "--repo", repo,
        "--pr", str(pr_number)
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def send_slack_notification(message: str, channel: str = "#security") -> str:
    """
    发送分析结果到 Slack
    
    Args:
        message: 消息内容
        channel: Slack 频道
        
    Returns:
        发送状态
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'slack_integration.py'),
        "--message", message,
        "--channel", channel
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def check_code_quality(project_path: str = ".") -> str:
    """
    检查代码质量指标
    """
    cmd = [
        sys.executable,
        str(SCRIPTS_DIR / 'deep_code_check.py'),
        "--root", project_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def start_web_dashboard(port: int = 8080) -> str:
    """
    启动 Web 交互式仪表盘
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'web_dashboard.py'),
        "--port", str(port)
    ]
    # 使用 Popen 因为 web 服务器通常是阻塞的
    subprocess.Popen(cmd, cwd=str(ROOT_DIR))
    return f"✅ Web 仪表盘已启动：http://localhost:{port}"


@mcp.tool()
def start_team_dashboard(port: int = 8081) -> str:
    """
    启动团队协作仪表盘 (多用户支持)
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'team_dashboard.py'),
        "--port", str(port)
    ]
    subprocess.Popen(cmd, cwd=str(ROOT_DIR))
    return f"👥 团队仪表盘已启动：http://localhost:{port}"


@mcp.tool()
def supply_chain_scan(file_path: str = "requirements.txt") -> str:
    """
    依赖供应链安全检查
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'supply_chain_scanner.py'),
        file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def create_baseline(name: str, input_file: str) -> str:
    """
    创建质量基线
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'baseline_manager.py'),
        "create",
        "--name", name,
        "--input", input_file
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def compare_baseline(baseline_name: str, input_file: str) -> str:
    """
    对比当前结果与基线
    """
    cmd = [
        sys.executable,
        str(TOOLS_DIR / 'baseline_manager.py'),
        "compare",
        "--baseline", baseline_name,
        "--input", input_file
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def verify_installation() -> str:
    """
    验证所有静态分析工具和 MCP 接口是否正常工作
    """
    cmd = [
        sys.executable,
        str(SCRIPTS_DIR / 'final_verification.py')
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    return result.stdout


@mcp.tool()
def get_help() -> str:
    """
    获取详细的工具说明和使用示例
    """
    help_text = """
# Enhanced Static Analysis MCP 帮助手册

## 核心工具

1. **scan_project** - 并行扫描项目安全问题
2. **incremental_scan** - 仅扫描变更的文件 (极速模式)
3. **deep_security_scan** - 生成详细的安全合规报告
4. **auto_fix** - 自动修复检测到的常见问题
5. **ai_fix_suggestion** - 使用 AI 生成针对性的修复代码建议
6. **predict_risks** - 预测技术债务和未来可能的 Bug 风险

## 协作与报告

7. **github_review_pr** - 自动审查 GitHub Pull Requests
8. **send_slack_notification** - 将警报发送到 Slack 频道
9. **export_sarif** - 导出到工业标准 SARIF 格式
10. **start_web_dashboard** - 启动个人分析看板
11. **start_team_dashboard** - 启动团队协作分析看板

## 管理与验证

12. **supply_chain_scan** - 检查第三方依赖的漏洞
13. **create_baseline / compare_baseline** - 质量基线管理
14. **verify_installation** - 系统健康检查

## 使用技巧

- 使用 `incremental_scan` 在开发过程中进行快速反馈。
- 对复杂的安全漏洞，请使用 `ai_fix_suggestion` 获取专业的修复方案。
- 在 CI/CD 流水中集成 `export_sarif` 以配合其他安全平台。
"""
    return help_text


if __name__ == "__main__":
    # 打印启动信息
    print(f"🚀 Enhanced Static Analysis MCP Server Starting...")
    print(f"📂 Root Directory: {ROOT_DIR}")
    print(f"🛠️ Tools Directory: {TOOLS_DIR}")
    mcp.run()
