import logging

#!/usr/bin/env python3
"""
SARIF 格式导出工具
用于与 GitHub Code Scanning、Azure DevOps 等集成
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime


class SarifExporter:
    """SARIF 格式导出器"""
    
    def __init__(self):
        self.tool_name = "Static Analysis MCP"
        self.tool_version = "1.0.0"
        self.organization = "Static Analysis Team"
    
    def convert_findings_to_sarif(self, 
                                   findings: List[Dict],
                                   source_files: Optional[List[str]] = None) -> Dict:
        """将分析结果转换为 SARIF 格式"""
        
        # SARIF 模板
        sarif_template = {
            "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
            "version": "2.1.0",
            "runs": [{
                "tool": {
                    "driver": {
                        "name": self.tool_name,
                        "version": self.tool_version,
                        "informationUri": "https://github.com/static-analysis-mcp",
                        "rules": self._extract_rules(findings)
                    }
                },
                "results": self._convert_findings(findings),
                "artifacts": self._extract_artifacts(source_files) if source_files else []
            }]
        }
        
        return sarif_template
    
    def _extract_rules(self, findings: List[Dict]) -> List[Dict]:
        """从结果中提取规则定义"""
        rules = {}
        
        for finding in findings:
            rule_id = finding.get('rule_id', 'unknown-rule')
            if rule_id not in rules:
                rules[rule_id] = {
                    "id": rule_id,
                    "name": finding.get('rule_name', rule_id),
                    "shortDescription": {
                        "text": finding.get('message', 'Static analysis finding')
                    },
                    "defaultConfiguration": {
                        "level": self._severity_to_level(finding.get('severity', 'WARNING'))
                    },
                    "helpUri": finding.get('documentation_url', ''),
                    "properties": {
                        "category": finding.get('category', 'security'),
                        "cwe": finding.get('cwe', ''),
                        "owasp": finding.get('owasp', ''),
                        "tags": finding.get('tags', [])
                    }
                }
        
        return list(rules.values())
    
    def _convert_findings(self, findings: List[Dict]) -> List[Dict]:
        """转换分析结果为 SARIF 格式"""
        results = []
        
        for finding in findings:
            result = {
                "ruleId": finding.get('rule_id', 'unknown-rule'),
                "level": self._severity_to_level(finding.get('severity', 'WARNING')),
                "message": {
                    "text": finding.get('message', 'Static analysis finding')
                },
                "locations": [{
                    "physicalLocation": {
                        "artifactLocation": {
                            "uri": finding.get('file', 'unknown')
                        },
                        "region": {
                            "startLine": finding.get('line', 1),
                            "startColumn": finding.get('column', 1)
                        }
                    }
                }],
                "properties": {
                    "timestamp": finding.get('timestamp', datetime.now().isoformat()),
                    "confidence": finding.get('confidence', 0.8)
                }
            }
            
            # 添加修复建议
            if 'fix' in finding:
                result["fixes"] = [{
                    "description": {
                        "text": "Apply this fix"
                    },
                    "appliedFixes": [{
                        "description": {
                            "text": finding['fix']
                        }
                    }]
                }]
            
            # 添加代码片段
            if 'code_snippet' in finding:
                result["locations"][0]["physicalLocation"]["region"]["snippet"] = {
                    "text": finding['code_snippet']
                }
            
            results.append(result)
        
        return results
    
    def _extract_artifacts(self, source_files: List[str]) -> List[Dict]:
        """提取源文件信息"""
        artifacts = []
        
        for file_path in source_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                artifact = {
                    "location": {
                        "uri": Path(file_path).as_posix()
                    },
                    "contents": {
                        "text": content
                    },
                    "sourceLanguage": self._detect_language(file_path)
                }
                artifacts.append(artifact)
            except Exception as e:
                logging.info(f"警告：无法读取文件 {file_path}: {e}")
        
        return artifacts
    
    def _severity_to_level(self, severity: str) -> str:
        """将严重性转换为 SARIF 级别"""
        severity_map = {
            'ERROR': 'error',
            'CRITICAL': 'error',
            'HIGH': 'error',
            'WARNING': 'warning',
            'MEDIUM': 'warning',
            'INFO': 'note',
            'LOW': 'note',
            'NOTE': 'note'
        }
        return severity_map.get(severity.upper(), 'warning')
    
    def _detect_language(self, file_path: str) -> str:
        """检测文件语言"""
        ext_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.java': 'java',
            '.go': 'go',
            '.rb': 'ruby',
            '.php': 'php',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.json': 'json',
            '.tf': 'hcl'
        }
        
        ext = Path(file_path).suffix.lower()
        return ext_map.get(ext, 'text')
    
    def export(self, 
               findings: List[Dict],
               output_path: str,
               source_files: Optional[List[str]] = None) -> str:
        """导出 SARIF 文件"""
        sarif = self.convert_findings_to_sarif(findings, source_files)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(sarif, f, indent=2, ensure_ascii=False)
        
        return output_path
    
    def export_to_string(self, findings: List[Dict]) -> str:
        """导出为 JSON 字符串"""
        sarif = self.convert_findings_to_sarif(findings)
        return json.dumps(sarif, indent=2, ensure_ascii=False)


def create_github_actions_workflow() -> str:
    """生成 GitHub Actions 工作流配置"""
    workflow = """
name: Static Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # 每天 2 AM 运行

jobs:
  static-analysis:
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v4
    
    - name: Setup Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    
    - name: Run Static Analysis
      run: |
        python static_analyzer.py -o analysis_results.json
    
    - name: Convert to SARIF
      run: |
        python sarif_export.py analysis_results.json results.sarif
    
    - name: Upload SARIF to GitHub
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: results.sarif
        category: static-analysis
    
    - name: Upload analysis results
      uses: actions/upload-artifact@v4
      with:
        name: static-analysis-results
        path: |
          analysis_results.json
          results.sarif
        retention-days: 30
"""
    return workflow


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='SARIF 格式导出工具')
    parser.add_argument('input', help='输入的分析结果文件 (JSON)')
    parser.add_argument('-o', '--output', required=True,
                       help='输出的 SARIF 文件')
    parser.add_argument('--source-files', nargs='+',
                       help='源文件列表')
    parser.add_argument('--tool-name', default='Static Analysis MCP',
                       help='工具名称')
    parser.add_argument('--tool-version', default='1.0.0',
                       help='工具版本')
    parser.add_argument('--generate-workflow', action='store_true',
                       help='生成 GitHub Actions 工作流')
    
    args = parser.parse_args()
    
    if args.generate_workflow:
        workflow = create_github_actions_workflow()
        workflow_path = '.github/workflows/static-analysis.yml'
        
        os.makedirs('.github/workflows', exist_ok=True)
        with open(workflow_path, 'w', encoding='utf-8') as f:
            f.write(workflow.strip())
        
        logging.info(f"GitHub Actions 工作流已保存到：{workflow_path}")
        return
    
    # 读取分析结果
    with open(args.input, 'r', encoding='utf-8') as f:
        findings = json.load(f)
    
    # 确保 findings 是列表
    if isinstance(findings, dict):
        findings = findings.get('findings', [])
    
    # 导出 SARIF
    exporter = SarifExporter()
    exporter.tool_name = args.tool_name
    exporter.tool_version = args.tool_version
    
    output_path = exporter.export(findings, args.output, args.source_files)
    
    logging.info(f"\nSARIF 文件已导出：{output_path}")
    logging.info(f"\n使用方法:")
    logging.info(f"1. 上传到 GitHub Security: Settings → Code security and analysis → Security analysis")
    logging.info(f"2. 上传到 Azure DevOps: 使用 PublishSecurityAnalysisLogs@3 任务")
    logging.info(f"3. 本地查看：使用 SARIF Viewer 扩展 (VS Code)")


if __name__ == '__main__':
    main()
