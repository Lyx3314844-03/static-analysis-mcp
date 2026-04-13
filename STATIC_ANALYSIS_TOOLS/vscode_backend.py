import logging

#!/usr/bin/env python3
"""
VS Code 插件后端服务
提供实时问题检测、Quick Fix 等功能
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import threading
from dataclasses import dataclass
from enum import Enum


class DiagnosticSeverity(Enum):
    """诊断严重性"""
    ERROR = 1
    WARNING = 2
    INFO = 3
    HINT = 4


@dataclass
class Diagnostic:
    """诊断信息"""
    file: str
    line: int
    column: int
    end_line: int
    end_column: int
    message: str
    source: str
    code: str
    severity: DiagnosticSeverity
    quick_fixes: List[Dict]


class RealTimeAnalyzer:
    """实时分析器"""
    
    def __init__(self, project_root: str):
        """
        初始化实时分析器
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
        self.cache = {}
        self.analysis_queue = []
        self.is_analyzing = False
    
    def analyze_file(self, file_path: str, content: str) -> List[Diagnostic]:
        """
        分析文件
        
        Args:
            file_path: 文件路径
            content: 文件内容
            
        Returns:
            诊断列表
        """
        diagnostics = []
        
        # 检查缓存
        cache_key = f"{file_path}:{hash(content)}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # 运行静态分析
        diagnostics.extend(self._run_static_analysis(file_path, content))
        
        # 运行安全检查
        diagnostics.extend(self._run_security_check(file_path, content))
        
        # 运行质量检查
        diagnostics.extend(self._run_quality_check(file_path, content))
        
        # 缓存结果
        self.cache[cache_key] = diagnostics
        
        # 限制缓存大小
        if len(self.cache) > 100:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
        
        return diagnostics
    
    def _run_static_analysis(self, file_path: str, content: str) -> List[Diagnostic]:
        """运行静态分析"""
        diagnostics = []
        
        # 调用 Semgrep
        try:
            result = subprocess.run(
                ['semgrep', '--json', '--config', 'auto', file_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                semgrep_output = json.loads(result.stdout)
                
                for finding in semgrep_output.get('results', []):
                    diagnostic = Diagnostic(
                        file=file_path,
                        line=finding.get('start', {}).get('line', 0),
                        column=finding.get('start', {}).get('col', 0),
                        end_line=finding.get('end', {}).get('line', 0),
                        end_column=finding.get('end', {}).get('col', 0),
                        message=finding.get('extra', {}).get('message', ''),
                        source='Semgrep',
                        code=finding.get('check_id', ''),
                        severity=self._map_severity(finding.get('extra', {}).get('severity', 'WARNING')),
                        quick_fixes=self._generate_quick_fixes(finding)
                    )
                    diagnostics.append(diagnostic)
        except Exception as e:
            pass
        
        return diagnostics
    
    def _run_security_check(self, file_path: str, content: str) -> List[Diagnostic]:
        """运行安全检查"""
        diagnostics = []
        
        # 简单模式匹配检查
        security_patterns = [
            (r'f"SELECT.*\{', 'SQL 注入风险', DiagnosticSeverity.ERROR),
            (r'eval\(', 'eval 使用风险', DiagnosticSeverity.ERROR),
            (r'password\s*=\s*"', '硬编码密码', DiagnosticSeverity.ERROR),
            (r'api_key\s*=\s*"', '硬编码 API 密钥', DiagnosticSeverity.ERROR),
        ]
        
        import re
        for line_num, line in enumerate(content.split('\n'), 1):
            for pattern, message, severity in security_patterns:
                if re.search(pattern, line):
                    diagnostics.append(Diagnostic(
                        file=file_path,
                        line=line_num,
                        column=0,
                        end_line=line_num,
                        end_column=len(line),
                        message=message,
                        source='Security Check',
                        code='security-check',
                        severity=severity,
                        quick_fixes=[]
                    ))
        
        return diagnostics
    
    def _run_quality_check(self, file_path: str, content: str) -> List[Diagnostic]:
        """运行质量检查"""
        diagnostics = []
        
        # 检查长函数
        lines = content.split('\n')
        in_function = False
        function_start = 0
        function_name = ''
        
        for i, line in enumerate(lines, 1):
            if line.strip().startswith('def '):
                if in_function and (i - function_start) > 50:
                    diagnostics.append(Diagnostic(
                        file=file_path,
                        line=function_start,
                        column=0,
                        end_line=i,
                        end_column=0,
                        message=f'函数 {function_name} 过长 ({i - function_start} 行)',
                        source='Quality Check',
                        code='too-long-function',
                        severity=DiagnosticSeverity.WARNING,
                        quick_fixes=[]
                    ))
                in_function = True
                function_start = i
                function_name = line.split('def ')[1].split('(')[0]
        
        return diagnostics
    
    def _map_severity(self, severity: str) -> DiagnosticSeverity:
        """映射严重性"""
        severity_map = {
            'ERROR': DiagnosticSeverity.ERROR,
            'WARNING': DiagnosticSeverity.WARNING,
            'INFO': DiagnosticSeverity.INFO
        }
        return severity_map.get(severity, DiagnosticSeverity.WARNING)
    
    def _generate_quick_fixes(self, finding: Dict) -> List[Dict]:
        """生成快速修复"""
        quick_fixes = []
        
        rule_id = finding.get('check_id', '')
        
        # SQL 注入修复
        if 'sql-injection' in rule_id:
            quick_fixes.append({
                'title': '使用参数化查询',
                'edit': {
                    'newText': 'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))'
                }
            })
        
        # 硬编码密码修复
        if 'hardcoded' in rule_id:
            quick_fixes.append({
                'title': '使用环境变量',
                'edit': {
                    'newText': 'import os\npassword = os.environ.get("PASSWORD")'
                }
            })
        
        return quick_fixes


class QuickFixProvider:
    """快速修复提供者"""
    
    def __init__(self):
        """初始化快速修复提供者"""
        self.fix_templates = self._load_fix_templates()
    
    def _load_fix_templates(self) -> Dict:
        """加载修复模板"""
        return {
            'sql-injection': {
                'title': '使用参数化查询',
                'pattern': r'execute\(f"(.*?)"\)',
                'replacement': 'execute("{}", ())'
            },
            'hardcoded-password': {
                'title': '使用环境变量',
                'pattern': r'password\s*=\s*"(.*?)"',
                'replacement': 'password = os.environ.get("PASSWORD")'
            },
            'bare-except': {
                'title': '捕获具体异常',
                'pattern': r'except:',
                'replacement': 'except Exception as e:'
            }
        }
    
    def get_quick_fixes(self, diagnostic: Diagnostic) -> List[Dict]:
        """
        获取快速修复
        
        Args:
            diagnostic: 诊断信息
            
        Returns:
            快速修复列表
        """
        fixes = []
        
        # 基于规则 ID 的修复
        if diagnostic.code in self.fix_templates:
            template = self.fix_templates[diagnostic.code]
            fixes.append({
                'title': template['title'],
                'kind': 'quickfix',
                'diagnostics': [{
                    'file': diagnostic.file,
                    'range': {
                        'start': {'line': diagnostic.line, 'character': diagnostic.column},
                        'end': {'line': diagnostic.end_line, 'character': diagnostic.end_column}
                    }
                }],
                'edit': {
                    'changes': {
                        diagnostic.file: [{
                            'range': {
                                'start': {'line': diagnostic.line, 'character': diagnostic.column},
                                'end': {'line': diagnostic.end_line, 'character': diagnostic.end_column}
                            },
                            'newText': template['replacement']
                        }]
                    }
                }
            })
        
        # 添加诊断自带的修复
        fixes.extend(diagnostic.quick_fixes)
        
        return fixes


# Flask 应用
app = Flask(__name__)
CORS(app)

# 初始化组件
analyzer = None
quick_fix_provider = QuickFixProvider()


@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({'status': 'healthy'})


@app.route('/analyze', methods=['POST'])
def analyze():
    """分析文件"""
    data = request.json
    file_path = data.get('file')
    content = data.get('content', '')
    
    if not file_path:
        return jsonify({'error': 'File path required'}), 400
    
    global analyzer
    if analyzer is None:
        analyzer = RealTimeAnalyzer('.')
    
    diagnostics = analyzer.analyze_file(file_path, content)
    
    return jsonify({
        'diagnostics': [
            {
                'file': d.file,
                'line': d.line,
                'column': d.column,
                'end_line': d.end_line,
                'end_column': d.end_column,
                'message': d.message,
                'source': d.source,
                'code': d.code,
                'severity': d.severity.value,
                'quick_fixes': d.quick_fixes
            }
            for d in diagnostics
        ]
    })


@app.route('/quick-fixes', methods=['POST'])
def get_quick_fixes():
    """获取快速修复"""
    data = request.json
    diagnostic = data.get('diagnostic')
    
    if not diagnostic:
        return jsonify({'error': 'Diagnostic required'}), 400
    
    fixes = quick_fix_provider.get_quick_fixes(Diagnostic(
        file=diagnostic.get('file', ''),
        line=diagnostic.get('line', 0),
        column=diagnostic.get('column', 0),
        end_line=diagnostic.get('end_line', 0),
        end_column=diagnostic.get('end_column', 0),
        message=diagnostic.get('message', ''),
        source=diagnostic.get('source', ''),
        code=diagnostic.get('code', ''),
        severity=DiagnosticSeverity(diagnostic.get('severity', 2)),
        quick_fixes=diagnostic.get('quick_fixes', [])
    ))
    
    return jsonify({'quick_fixes': fixes})


@app.route('/batch-fix', methods=['POST'])
def batch_fix():
    """批量修复"""
    data = request.json
    file_path = data.get('file')
    fixes = data.get('fixes', [])
    
    if not file_path:
        return jsonify({'error': 'File path required'}), 400
    
    # 读取文件
    with open(file_path, 'r') as f:
        content = f.read()
    
    # 应用修复
    for fix in fixes:
        # 简单字符串替换
        if 'old_text' in fix and 'new_text' in fix:
            content = content.replace(fix['old_text'], fix['new_text'])
    
    # 写回文件
    with open(file_path, 'w') as f:
        f.write(content)
    
    return jsonify({'success': True, 'message': 'Batch fix applied'})


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='VS Code 插件后端服务')
    parser.add_argument('--host', default='127.0.0.1', help='监听地址')
    parser.add_argument('--port', type=int, default=8765, help='监听端口')
    parser.add_argument('--debug', action='store_true', help='调试模式')
    
    args = parser.parse_args()
    
    logging.info(f"\n🚀 VS Code 插件后端服务启动")
    logging.info(f"监听地址：http://{args.host}:{args.port}")
    logging.info(f"健康检查：http://{args.host}:{args.port}/health")
    logging.info(f"分析接口：http://{args.host}:{args.port}/analyze")
    logging.info(f"快速修复：http://{args.host}:{args.port}/quick-fixes")
    logging.info(f"批量修复：http://{args.host}:{args.port}/batch-fix")
    logging.info(f"\n按 Ctrl+C 停止服务\n")
    
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == '__main__':
    main()
