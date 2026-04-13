import logging

#!/usr/bin/env python3
"""
基线管理工具
用于创建、管理和对比静态分析基线
"""

import json
import os
import hashlib
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict
import difflib


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


@dataclass
class BaselineFinding:
    """基线中的问题发现"""
    id: str
    rule_id: str
    severity: str
    file: str
    line: int
    column: int
    message: str
    cwe: str = ''
    owasp: str = ''
    hash: str = ''
    created_at: str = ''
    status: str = 'open'  # open, fixed, false_positive


@dataclass
class Baseline:
    """基线数据结构"""
    name: str
    version: str
    created_at: str
    updated_at: str
    project_root: str
    total_files: int
    total_findings: int
    findings: Dict[str, BaselineFinding]  # key: finding id
    metadata: Dict
    statistics: Dict


class BaselineManager:
    """基线管理器"""
    
    def __init__(self, baseline_dir: str = None):
        """
        初始化基线管理器
        
        Args:
            baseline_dir: 基线存储目录
        """
        self.baseline_dir = Path(baseline_dir) if baseline_dir else Path('./.baselines')
        self.baseline_dir.mkdir(exist_ok=True)
        
        self.current_baseline: Optional[Baseline] = None
        self.baselines = self._list_baselines()
    
    def _generate_finding_id(self, finding: Dict) -> str:
        """
        生成问题唯一 ID
        
        基于规则 ID、文件、行号、列号生成哈希
        """
        key = f"{finding.get('rule_id', '')}:{finding.get('file', '')}:{finding.get('line', 0)}:{finding.get('column', 0)}"
        return hashlib.md5(key.encode()).hexdigest()
    
    def _list_baselines(self) -> List[Dict]:
        """列出所有基线"""
        baselines = []
        
        for file in self.baseline_dir.glob('*.json'):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                baselines.append({
                    'name': data.get('name', file.stem),
                    'version': data.get('version', '1.0'),
                    'created_at': data.get('created_at', ''),
                    'total_findings': data.get('total_findings', 0),
                    'file': str(file)
                })
            except Exception as e:
                logging.info(f"{Colors.YELLOW}警告：读取基线失败 {file}: {e}{Colors.RESET}")
        
        return sorted(baselines, key=lambda x: x['created_at'], reverse=True)
    
    def create_baseline(self, 
                       name: str,
                       findings: List[Dict],
                       project_root: str = None,
                       metadata: Dict = None) -> Baseline:
        """
        创建基线
        
        Args:
            name: 基线名称
            findings: 问题发现列表
            project_root: 项目根目录
            metadata: 元数据
        
        Returns:
            创建的基线对象
        """
        logging.info(f"\n{Colors.CYAN}创建基线：{name}{Colors.RESET}")
        
        now = datetime.now().isoformat()
        
        # 转换问题发现
        baseline_findings = {}
        for finding in findings:
            finding_id = self._generate_finding_id(finding)
            baseline_findings[finding_id] = BaselineFinding(
                id=finding_id,
                rule_id=finding.get('rule_id', ''),
                severity=finding.get('severity', 'WARNING'),
                file=finding.get('file', ''),
                line=finding.get('line', 0),
                column=finding.get('column', 0),
                message=finding.get('message', ''),
                cwe=finding.get('cwe', ''),
                owasp=finding.get('owasp', ''),
                hash=finding.get('hash', ''),
                created_at=now,
                status='open'
            )
        
        # 统计数据
        statistics = self._calculate_statistics(list(baseline_findings.values()))
        
        # 创建基线对象
        baseline = Baseline(
            name=name,
            version='1.0',
            created_at=now,
            updated_at=now,
            project_root=project_root or str(Path.cwd()),
            total_files=len(set(f.file for f in baseline_findings.values())),
            total_findings=len(baseline_findings),
            findings=baseline_findings,
            metadata=metadata or {},
            statistics=statistics
        )
        
        # 保存到文件
        self._save_baseline(baseline)
        
        logging.info(f"{Colors.GREEN}✓ 基线创建成功{Colors.RESET}")
        logging.info(f"  文件：{self.baseline_dir / f'{name.replace(' ', '_')}.json'}")
        logging.info(f"  问题数：{baseline.total_findings}")
        logging.info(f"  时间：{baseline.created_at}")
        
        return baseline
    
    def _calculate_statistics(self, findings: List[BaselineFinding]) -> Dict:
        """计算统计数据"""
        stats = {
            'by_severity': {},
            'by_status': {},
            'by_file': {},
            'top_rules': {}
        }
        
        # 按严重性统计
        for finding in findings:
            severity = finding.severity
            stats['by_severity'][severity] = stats['by_severity'].get(severity, 0) + 1
        
        # 按状态统计
        for finding in findings:
            status = finding.status
            stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
        
        # 按文件统计
        for finding in findings:
            file = finding.file
            stats['by_file'][file] = stats['by_file'].get(file, 0) + 1
        
        # 按规则统计
        for finding in findings:
            rule = finding.rule_id
            stats['top_rules'][rule] = stats['top_rules'].get(rule, 0) + 1
        
        # 排序
        stats['top_rules'] = dict(
            sorted(stats['top_rules'].items(), key=lambda x: x[1], reverse=True)[:10]
        )
        
        return stats
    
    def _save_baseline(self, baseline: Baseline):
        """保存基线到文件"""
        file_path = self.baseline_dir / f"{baseline.name.replace(' ', '_')}.json"
        
        # 转换为字典
        data = asdict(baseline)
        
        # 序列化
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        
        self.baselines = self._list_baselines()
    
    def load_baseline(self, name: str) -> Optional[Baseline]:
        """
        加载基线
        
        Args:
            name: 基线名称
        
        Returns:
            基线对象，不存在返回 None
        """
        file_path = self.baseline_dir / f"{name.replace(' ', '_')}.json"
        
        if not file_path.exists():
            logging.info(f"{Colors.RED}基线不存在：{name}{Colors.RESET}")
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 转换回 Baseline 对象
            findings = {
                k: BaselineFinding(**v)
                for k, v in data.get('findings', {}).items()
            }
            data['findings'] = findings
            
            baseline = Baseline(**data)
            self.current_baseline = baseline
            
            logging.info(f"{Colors.GREEN}✓ 基线已加载：{name}{Colors.RESET}")
            return baseline
            
        except Exception as e:
            logging.info(f"{Colors.RED}加载基线失败：{e}{Colors.RESET}")
            return None
    
    def compare_with_baseline(self, 
                             current_findings: List[Dict],
                             baseline_name: str = None) -> Dict:
        """
        与基线对比
        
        Args:
            current_findings: 当前问题发现列表
            baseline_name: 基线名称（默认使用当前基线）
        
        Returns:
            对比结果
        """
        if baseline_name:
            baseline = self.load_baseline(baseline_name)
        else:
            baseline = self.current_baseline
        
        if not baseline:
            logging.info(f"{Colors.RED}错误：未指定基线{Colors.RESET}")
            return {}
        
        logging.info(f"\n{Colors.CYAN}与基线对比：{baseline.name}{Colors.RESET}")
        
        # 生成当前问题 ID 映射
        current_by_id = {}
        for finding in current_findings:
            finding_id = self._generate_finding_id(finding)
            current_by_id[finding_id] = finding
        
        baseline_ids = set(baseline.findings.keys())
        current_ids = set(current_by_id.keys())
        
        # 分类
        new_issue_ids = current_ids - baseline_ids
        fixed_issue_ids = baseline_ids - current_ids
        persistent_issue_ids = baseline_ids & current_ids
        
        # 构建结果
        result = {
            'baseline_name': baseline.name,
            'baseline_date': baseline.created_at,
            'compare_date': datetime.now().isoformat(),
            'summary': {
                'baseline_total': len(baseline.findings),
                'current_total': len(current_findings),
                'new_issues': len(new_issue_ids),
                'fixed_issues': len(fixed_issue_ids),
                'persistent_issues': len(persistent_issue_ids)
            },
            'new_issues': [current_by_id[id] for id in new_issue_ids],
            'fixed_issues': [asdict(baseline.findings[id]) for id in fixed_issue_ids],
            'persistent_issues': [
                {
                    'baseline': asdict(baseline.findings[id]),
                    'current': current_by_id[id]
                }
                for id in persistent_issue_ids
            ],
            'trend': self._calculate_trend(baseline, current_findings)
        }
        
        # 打印摘要
        self._print_compare_summary(result)
        
        return result
    
    def _calculate_trend(self, baseline: Baseline, current_findings: List[Dict]) -> Dict:
        """计算趋势"""
        baseline_count = baseline.total_findings
        current_count = len(current_findings)
        
        if baseline_count == 0:
            change_percent = 100 if current_count > 0 else 0
        else:
            change_percent = ((current_count - baseline_count) / baseline_count) * 100
        
        trend = {
            'direction': 'improving' if change_percent < 0 else 'worsening' if change_percent > 0 else 'stable',
            'change_percent': round(change_percent, 2),
            'change_absolute': current_count - baseline_count
        }
        
        return trend
    
    def _print_compare_summary(self, result: Dict):
        """打印对比摘要"""
        logging.info(f"\n{Colors.BOLD}对比摘要{Colors.RESET}")
        logging.info(f"{'='*60}")
        logging.info(f"基线：{result['baseline_name']} ({result['baseline_date']})")
        logging.info(f"当前：{result['compare_date']}")
        logging.info(f"{'='*60}")
        
        summary = result['summary']
        logging.info(f"\n基线问题数：{summary['baseline_total']}")
        logging.info(f"当前问题数：{summary['current_total']}")
        
        # 新增问题
        if summary['new_issues'] > 0:
            logging.info(f"\n{Colors.RED}+ 新增问题：{summary['new_issues']}{Colors.RESET}")
        else:
            logging.info(f"\n{Colors.GREEN}✓ 无新增问题{Colors.RESET}")
        
        # 修复问题
        if summary['fixed_issues'] > 0:
            logging.info(f"{Colors.GREEN}✓ 已修复：{summary['fixed_issues']}{Colors.RESET}")
        else:
            logging.info(f"{Colors.YELLOW}- 无修复问题{Colors.RESET}")
        
        # 持续存在
        logging.info(f"\n持续存在：{summary['persistent_issues']}")
        
        # 趋势
        trend = result['trend']
        trend_emoji = {'improving': '📉', 'worsening': '📈', 'stable': '➡️'}
        logging.info(f"\n趋势：{trend_emoji.get(trend['direction'], '')} {trend['direction']} ({trend['change_percent']:+.2f}%)")
        
        logging.info(f"{'='*60}\n")
    
    def list_baselines(self) -> List[Dict]:
        """列出所有基线"""
        return self.baselines
    
    def delete_baseline(self, name: str) -> bool:
        """删除基线"""
        file_path = self.baseline_dir / f"{name.replace(' ', '_')}.json"
        
        if not file_path.exists():
            logging.info(f"{Colors.RED}基线不存在：{name}{Colors.RESET}")
            return False
        
        file_path.unlink()
        self.baselines = self._list_baselines()
        logging.info(f"{Colors.GREEN}✓ 基线已删除：{name}{Colors.RESET}")
        return True
    
    def export_comparison(self, 
                         result: Dict, 
                         output_file: str,
                         format: str = 'markdown') -> str:
        """
        导出对比结果
        
        Args:
            result: 对比结果
            output_file: 输出文件
            format: 导出格式（markdown, json, html）
        
        Returns:
            输出文件路径
        """
        if format == 'markdown':
            content = self._export_markdown(result)
        elif format == 'json':
            content = json.dumps(result, indent=2, ensure_ascii=False)
        else:
            content = self._export_markdown(result)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logging.info(f"{Colors.GREEN}对比结果已导出：{output_file}{Colors.RESET}")
        return output_file
    
    def _export_markdown(self, result: Dict) -> str:
        """导出为 Markdown"""
        lines = []
        lines.append("# 基线对比报告\n")
        lines.append(f"**基线**: {result['baseline_name']}  \n")
        lines.append(f"**对比时间**: {result['compare_date']}\n")
        
        # 摘要
        lines.append("\n## 摘要\n")
        summary = result['summary']
        lines.append(f"| 指标 | 数量 |")
        lines.append(f"|------|------|")
        lines.append(f"| 基线问题数 | {summary['baseline_total']} |")
        lines.append(f"| 当前问题数 | {summary['current_total']} |")
        lines.append(f"| 新增问题 | {summary['new_issues']} |")
        lines.append(f"| 已修复 | {summary['fixed_issues']} |")
        lines.append(f"| 持续存在 | {summary['persistent_issues']} |")
        
        # 趋势
        trend = result['trend']
        lines.append(f"\n## 趋势\n")
        lines.append(f"- 方向：{trend['direction']}")
        lines.append(f"- 变化：{trend['change_percent']:+.2f}%")
        lines.append(f"- 绝对变化：{trend['change_absolute']:+d}\n")
        
        # 新增问题
        if result['new_issues']:
            lines.append("\n## 新增问题\n")
            for i, issue in enumerate(result['new_issues'][:20], 1):  # 限制显示 20 个
                lines.append(f"### {i}. {issue.get('rule_id', 'unknown')}")
                lines.append(f"- **文件**: `{issue.get('file', 'unknown')}:{issue.get('line', 0)}`")
                lines.append(f"- **严重性**: {issue.get('severity', 'WARNING')}")
                lines.append(f"- **描述**: {issue.get('message', 'N/A')}\n")
        
        # 已修复问题
        if result['fixed_issues']:
            lines.append("\n## 已修复问题\n")
            for i, issue in enumerate(result['fixed_issues'][:20], 1):
                lines.append(f"### {i}. {issue.get('rule_id', 'unknown')}")
                lines.append(f"- **文件**: `{issue.get('file', 'unknown')}:{issue.get('line', 0)}`")
                lines.append(f"- **严重性**: {issue.get('severity', 'WARNING')}\n")
        
        return '\n'.join(lines)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='基线管理工具')
    parser.add_argument('command', 
                       choices=['create', 'list', 'compare', 'delete', 'show'],
                       help='命令')
    parser.add_argument('--name', help='基线名称')
    parser.add_argument('--input', help='输入文件（JSON 格式的问题列表）')
    parser.add_argument('--output', help='输出文件')
    parser.add_argument('--baseline', help='对比的基线名称')
    parser.add_argument('--format', choices=['markdown', 'json'], default='markdown',
                       help='导出格式')
    
    args = parser.parse_args()
    
    manager = BaselineManager()
    
    if args.command == 'create':
        # 创建基线
        if not args.input:
            logging.info(f"{Colors.RED}错误：需要指定输入文件 --input{Colors.RESET}")
            return
        
        with open(args.input, 'r', encoding='utf-8') as f:
            findings = json.load(f)
        
        if isinstance(findings, dict):
            findings = findings.get('findings', [])
        
        baseline_name = args.name or f"baseline_{datetime.now().strftime('%Y%m%d')}"
        manager.create_baseline(baseline_name, findings)
    
    elif args.command == 'list':
        # 列出基线
        baselines = manager.list_baselines()
        if baselines:
            logging.info(f"\n{Colors.BOLD}可用基线:{Colors.RESET}\n")
            for b in baselines:
                logging.info(f"  {Colors.CYAN}{b['name']}{Colors.RESET}")
                logging.info(f"    版本：{b['version']}")
                logging.info(f"    创建：{b['created_at']}")
                logging.info(f"    问题数：{b['total_findings']}")
                logging.info()
        else:
            logging.info(f"{Colors.YELLOW}暂无基线{Colors.RESET}")
    
    elif args.command == 'compare':
        # 对比
        if not args.input:
            logging.info(f"{Colors.RED}错误：需要指定当前问题文件 --input{Colors.RESET}")
            return
        
        with open(args.input, 'r', encoding='utf-8') as f:
            current_findings = json.load(f)
        
        if isinstance(current_findings, dict):
            current_findings = current_findings.get('findings', [])
        
        result = manager.compare_with_baseline(
            current_findings,
            baseline_name=args.baseline
        )
        
        if result and args.output:
            manager.export_comparison(result, args.output, args.format)
    
    elif args.command == 'delete':
        # 删除基线
        if not args.name:
            logging.info(f"{Colors.RED}错误：需要指定基线名称 --name{Colors.RESET}")
            return
        manager.delete_baseline(args.name)
    
    elif args.command == 'show':
        # 显示基线详情
        if not args.name:
            logging.info(f"{Colors.RED}错误：需要指定基线名称 --name{Colors.RESET}")
            return
        
        baseline = manager.load_baseline(args.name)
        if baseline:
            logging.info(f"\n{Colors.BOLD}基线详情:{Colors.RESET}")
            logging.info(f"名称：{baseline.name}")
            logging.info(f"版本：{baseline.version}")
            logging.info(f"创建时间：{baseline.created_at}")
            logging.info(f"项目根目录：{baseline.project_root}")
            logging.info(f"总文件数：{baseline.total_files}")
            logging.info(f"总问题数：{baseline.total_findings}")
            
            logging.info(f"\n{Colors.BOLD}按严重性统计:{Colors.RESET}")
            for severity, count in baseline.statistics['by_severity'].items():
                logging.info(f"  {severity}: {count}")


if __name__ == '__main__':
    main()
