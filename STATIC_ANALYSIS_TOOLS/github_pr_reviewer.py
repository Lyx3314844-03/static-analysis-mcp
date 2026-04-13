import logging

#!/usr/bin/env python3
"""
GitHub PR 自动审查工具
自动审查 Pull Request，提供问题反馈和修复建议
"""

import os
import json
from typing import List, Dict, Optional
from github import Github, PullRequest
import subprocess
import tempfile
from pathlib import Path
from dataclasses import dataclass


@dataclass
class ReviewComment:
    """审查评论"""
    file: str
    line: int
    body: str
    suggestion: Optional[str] = None


class GitHubPRReviewer:
    """GitHub PR 审查器"""
    
    def __init__(self, github_token: str, repo_name: str):
        """
        初始化审查器
        
        Args:
            github_token: GitHub Token
            repo_name: 仓库名称 (owner/repo)
        """
        self.g = Github(github_token)
        self.repo = self.g.get_repo(repo_name)
        self.temp_dir = tempfile.mkdtemp()
    
    def review_pr(self, pr_number: int) -> Dict:
        """
        审查 PR
        
        Args:
            pr_number: PR 编号
            
        Returns:
            审查结果
        """
        pr = self.repo.get_pull(pr_number)
        
        # 获取变更文件
        files = pr.get_files()
        
        review_comments = []
        summary = {
            'total_files': files.totalCount,
            'total_changes': 0,
            'issues_found': 0,
            'critical': 0,
            'warning': 0,
            'info': 0
        }
        
        # 审查每个文件
        for file in files:
            summary['total_changes'] += file.changes
            
            # 下载文件内容
            content = self._get_file_content(file)
            
            # 分析文件
            diagnostics = self._analyze_file(file.filename, content)
            
            # 生成评论
            for diagnostic in diagnostics:
                comment = ReviewComment(
                    file=file.filename,
                    line=diagnostic.get('line', 0),
                    body=diagnostic.get('message', ''),
                    suggestion=diagnostic.get('suggestion')
                )
                review_comments.append(comment)
                summary['issues_found'] += 1
                
                if diagnostic.get('severity') == 'ERROR':
                    summary['critical'] += 1
                elif diagnostic.get('severity') == 'WARNING':
                    summary['warning'] += 1
                else:
                    summary['info'] += 1
        
        # 提交审查
        self._submit_review(pr, review_comments, summary)
        
        return summary
    
    def _get_file_content(self, file) -> str:
        """获取文件内容"""
        try:
            # 从 GitHub 获取文件内容
            content = self.repo.get_contents(file.filename, ref=file.sha)
            return content.decoded_content.decode('utf-8')
        except Exception:
            return ""
    
    def _analyze_file(self, file_path: str, content: str) -> List[Dict]:
        """分析文件"""
        diagnostics = []
        
        # 运行 Semgrep
        diagnostics.extend(self._run_semgrep(file_path, content))
        
        # 运行安全检查
        diagnostics.extend(self._run_security_check(file_path, content))
        
        # 运行质量检查
        diagnostics.extend(self._run_quality_check(file_path, content))
        
        return diagnostics
    
    def _run_semgrep(self, file_path: str, content: str) -> List[Dict]:
        """运行 Semgrep"""
        diagnostics = []
        
        try:
            # 保存临时文件
            temp_file = Path(self.temp_dir) / file_path
            temp_file.parent.mkdir(parents=True, exist_ok=True)
            temp_file.write_text(content)
            
            # 运行 Semgrep
            result = subprocess.run(
                ['semgrep', '--json', '--config', 'auto', str(temp_file)],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                semgrep_output = json.loads(result.stdout)
                
                for finding in semgrep_output.get('results', []):
                    diagnostics.append({
                        'line': finding.get('start', {}).get('line', 0),
                        'message': finding.get('extra', {}).get('message', ''),
                        'severity': finding.get('extra', {}).get('severity', 'WARNING'),
                        'suggestion': self._generate_suggestion(finding)
                    })
        except Exception as e:
            pass
        
        return diagnostics
    
    def _run_security_check(self, file_path: str, content: str) -> List[Dict]:
        """运行安全检查"""
        diagnostics = []
        
        import re
        
        # 安全模式
        security_patterns = [
            (r'f"SELECT.*\{', '🔴 SQL 注入风险 - 请使用参数化查询', 'ERROR'),
            (r'eval\(', '🔴 eval 使用风险 - 避免使用 eval', 'ERROR'),
            (r'password\s*=\s*"', '🔴 硬编码密码 - 使用环境变量', 'ERROR'),
            (r'api_key\s*=\s*"', '🔴 硬编码 API 密钥 - 使用环境变量', 'ERROR'),
        ]
        
        for line_num, line in enumerate(content.split('\n'), 1):
            for pattern, message, severity in security_patterns:
                if re.search(pattern, line):
                    diagnostics.append({
                        'line': line_num,
                        'message': message,
                        'severity': severity,
                        'suggestion': self._get_security_suggestion(pattern)
                    })
        
        return diagnostics
    
    def _run_quality_check(self, file_path: str, content: str) -> List[Dict]:
        """运行质量检查"""
        diagnostics = []
        
        lines = content.split('\n')
        
        # 检查长函数
        in_function = False
        function_start = 0
        function_name = ''
        
        for i, line in enumerate(lines, 1):
            if line.strip().startswith('def '):
                if in_function and (i - function_start) > 50:
                    diagnostics.append({
                        'line': function_start,
                        'message': f'⚠️ 函数 `{function_name}` 过长 ({i - function_start} 行)，建议拆分',
                        'severity': 'WARNING',
                        'suggestion': '将函数拆分为多个小函数，每个函数不超过 20 行'
                    })
                in_function = True
                function_start = i
                function_name = line.split('def ')[1].split('(')[0]
        
        # 检查缺少文档字符串
        for i, line in enumerate(lines, 1):
            if line.strip().startswith('def ') and i < len(lines):
                next_line = lines[i].strip() if i < len(lines) else ''
                if not next_line.startswith('"""') and not next_line.startswith("'''"):
                    diagnostics.append({
                        'line': i,
                        'message': '📝 函数缺少文档字符串',
                        'severity': 'INFO',
                        'suggestion': '添加文档字符串说明函数功能、参数和返回值'
                    })
        
        return diagnostics
    
    def _generate_suggestion(self, finding: Dict) -> str:
        """生成修复建议"""
        rule_id = finding.get('check_id', '')
        
        suggestions = {
            'sql-injection': '使用参数化查询：cursor.execute("SELECT ... WHERE id = %s", (user_id,))',
            'hardcoded-password': '使用环境变量：os.environ.get("PASSWORD")',
            'bare-except': '捕获具体异常：except Exception as e:',
            'unused-import': '移除未使用的导入',
            'missing-type-hint': '添加类型提示：def func(param: str) -> int:'
        }
        
        for key, suggestion in suggestions.items():
            if key in rule_id:
                return suggestion
        
        return '请查看 Semgrep 文档获取修复建议'
    
    def _get_security_suggestion(self, pattern: str) -> str:
        """获取安全建议"""
        suggestions = {
            r'f"SELECT.*\{': '使用参数化查询：cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
            r'eval\(': '使用 ast.literal_eval() 或其他安全方法',
            r'password\s*=\s*"': '使用环境变量：import os; password = os.environ.get("PASSWORD")',
            r'api_key\s*=\s*"': '使用环境变量：import os; api_key = os.environ.get("API_KEY")'
        }
        
        return suggestions.get(pattern, '修复此安全问题')
    
    def _submit_review(self, pr: PullRequest, comments: List[ReviewComment], summary: Dict):
        """提交审查"""
        # 生成审查总结
        review_body = f"""
## 📊 Static Analysis MCP 审查报告

### 统计
- 📁 审查文件：{summary['total_files']}
- 📝 总变更：{summary['total_changes']}
- 🔍 发现问题：{summary['issues_found']}
  - 🔴 严重：{summary['critical']}
  - 🟡 警告：{summary['warning']}
  - ℹ️ 信息：{summary['info']}

### 建议
{self._generate_recommendations(summary)}
"""
        
        # 创建审查
        pr.create_review(
            body=review_body,
            event='COMMENT',
            comments=[
                {
                    'path': comment.file,
                    'position': comment.line,
                    'body': f"{comment.body}\n\n💡 **建议**: {comment.suggestion}" if comment.suggestion else comment.body
                }
                for comment in comments
            ]
        )
    
    def _generate_recommendations(self, summary: Dict) -> str:
        """生成建议"""
        recommendations = []
        
        if summary['critical'] > 0:
            recommendations.append("- ⚠️ **立即修复**所有严重安全问题")
        
        if summary['warning'] > 5:
            recommendations.append("- 📝 建议重构长函数和复杂代码")
        
        if summary['info'] > 10:
            recommendations.append("- 📚 添加更多文档字符串和类型提示")
        
        if not recommendations:
            recommendations.append("- ✅ 代码质量良好，继续保持！")
        
        return '\n'.join(recommendations)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='GitHub PR 自动审查工具')
    parser.add_argument('--token', type=str, required=True, help='GitHub Token')
    parser.add_argument('--repo', type=str, required=True, help='仓库名称 (owner/repo)')
    parser.add_argument('--pr', type=int, required=True, help='PR 编号')
    
    args = parser.parse_args()
    
    # 创建审查器
    reviewer = GitHubPRReviewer(args.token, args.repo)
    
    # 审查 PR
    logging.info(f"\n🔍 开始审查 PR #{args.pr}")
    summary = reviewer.review_pr(args.pr)
    
    # 打印结果
    logging.info(f"\n📊 审查结果:")
    logging.info(f"  审查文件：{summary['total_files']}")
    logging.info(f"  总变更：{summary['total_changes']}")
    logging.info(f"  发现问题：{summary['issues_found']}")
    logging.info(f"    🔴 严重：{summary['critical']}")
    logging.info(f"    🟡 警告：{summary['warning']}")
    logging.info(f"    ℹ️ 信息：{summary['info']}")
    logging.info(f"\n✅ 审查已提交到 PR #{args.pr}")


if __name__ == '__main__':
    main()
