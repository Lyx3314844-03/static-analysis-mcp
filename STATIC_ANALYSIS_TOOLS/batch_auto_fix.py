#!/usr/bin/env python3
"""
批量自动修复工具
一键修复所有可自动修复的问题
目标：开发效率 +30%
"""

import os
import re
from pathlib import Path
from typing import List, Dict, Tuple
from dataclasses import dataclass
import difflib


@dataclass
class AutoFix:
    """自动修复定义"""
    name: str
    description: str
    pattern: str
    replacement: str
    file_pattern: str = "*.py"
    severity: str = "WARNING"


class BatchAutoFixer:
    """批量自动修复器"""
    
    def __init__(self, project_root: str):
        """
        初始化批量修复器
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
        self.fixes_applied = []
        self.stats = {
            'files_scanned': 0,
            'files_modified': 0,
            'issues_fixed': 0,
            'time_saved_minutes': 0
        }
        
        # 定义自动修复规则
        self.auto_fixes = self._define_auto_fixes()
    
    def _define_auto_fixes(self) -> List[AutoFix]:
        """定义自动修复规则"""
        return [
            # 代码质量修复
            AutoFix(
                name="Add Type Hints",
                description="添加类型提示",
                pattern=r'def (\w+)\(([^)]*)\):',
                replacement=r'def \1(\2) -> None:',
                file_pattern="*.py",
                severity="INFO"
            ),
            AutoFix(
                name="Fix Bare Except",
                description="修复裸 except",
                pattern=r'except:',
                replacement='except Exception as e:',
                file_pattern="*.py",
                severity="ERROR"
            ),
            AutoFix(
                name="Fix Print Statement",
                description="修复 print 语句",
                pattern=r'print\((.*?)\)',
                replacement=r'logging.info(\1)',
                file_pattern="*.py",
                severity="WARNING"
            ),
            AutoFix(
                name="Fix String Format",
                description="修复字符串格式化",
                pattern=r'"%s" % (.*?)',
                replacement=r'f"{\1}"',
                file_pattern="*.py",
                severity="INFO"
            ),
            AutoFix(
                name="Fix Old Style Class",
                description="修复旧式类定义",
                pattern=r'class (\w+):',
                replacement=r'class \1(object):',
                file_pattern="*.py",
                severity="INFO"
            ),
            
            # 安全修复
            AutoFix(
                name="Fix Hardcoded Password",
                description="修复硬编码密码",
                pattern=r'password\s*=\s*"[^"]+"',
                replacement='password = os.environ.get("PASSWORD")',
                file_pattern="*.py",
                severity="ERROR"
            ),
            AutoFix(
                name="Fix Hardcoded API Key",
                description="修复硬编码 API 密钥",
                pattern=r'api_key\s*=\s*"[^"]+"',
                replacement='api_key = os.environ.get("API_KEY")',
                file_pattern="*.py",
                severity="ERROR"
            ),
            AutoFix(
                name="Add Import OS",
                description="添加 os 导入",
                pattern=r'(import logging)',
                replacement=r'\1\nimport os',
                file_pattern="*.py",
                severity="INFO"
            ),
            
            # 性能修复
            AutoFix(
                name="Fix List Comprehension",
                description="优化列表推导式",
                pattern=r'for (\w+) in (.*):\n\s+(\[\w+\])\.append\(\1\)',
                replacement=r'[\1 for \1 in \2]',
                file_pattern="*.py",
                severity="INFO"
            ),
            AutoFix(
                name="Fix String Concatenation",
                description="修复字符串拼接",
                pattern=r'(\w+) \+= (\w+) \+ (\w+)',
                replacement=r'\1 = "".join([\1, \2, \3])',
                file_pattern="*.py",
                severity="WARNING"
            ),
            
            # 文档修复
            AutoFix(
                name="Add Docstring Template",
                description="添加文档字符串模板",
                pattern=r'(def \w+\([^)]*\):)\n(\s+)',
                replacement=r'\1\n\2"""TODO: Add docstring."""\n\2',
                file_pattern="*.py",
                severity="INFO"
            ),
        ]
    
    def scan_and_fix_project(self, dry_run: bool = True) -> Dict:
        """
        扫描并修复整个项目
        
        Args:
            dry_run: 是否只预览不实际修改
            
        Returns:
            修复统计
        """
        logging.info(f"\n🔍 开始扫描项目：{self.project_root}")
        logging.info(f"{'干跑模式' if dry_run else '实际修复模式'}")
        logging.info("="*70)
        
        # 扫描 Python 文件
        py_files = list(self.project_root.rglob("*.py"))
        
        self.stats['files_scanned'] = len(py_files)
        
        for py_file in py_files:
            # 跳过特定目录
            if any(part.startswith('.') for part in py_file.parts):
                continue
            if 'node_modules' in str(py_file):
                continue
            if '__pycache__' in str(py_file):
                continue
            
            self._scan_and_fix_file(py_file, dry_run)
        
        # 计算时间节省
        self.stats['time_saved_minutes'] = self.stats['issues_fixed'] * 2  # 每个问题节省 2 分钟
        
        return self.stats
    
    def _scan_and_fix_file(self, file_path: Path, dry_run: bool):
        """扫描并修复单个文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            content = original_content
            file_fixes = 0
            
            # 应用每个修复规则
            for auto_fix in self.auto_fixes:
                matches = re.finditer(auto_fix.pattern, content, re.MULTILINE)
                match_count = sum(1 for _ in matches)
                
                if match_count > 0:
                    content = re.sub(auto_fix.pattern, auto_fix.replacement, content)
                    file_fixes += match_count
                    
                    if not dry_run:
                        self.fixes_applied.append({
                            'file': str(file_path),
                            'fix': auto_fix.name,
                            'count': match_count
                        })
            
            # 如果内容有变化，保存文件
            if content != original_content:
                self.stats['files_modified'] += 1
                self.stats['issues_fixed'] += file_fixes
                
                if not dry_run:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    logging.info(f"✅ 修复：{file_path} ({file_fixes} 个问题)")
                else:
                    logging.info(f"📝 将修复：{file_path} ({file_fixes} 个问题)")
        
        except Exception as e:
            logging.info(f"❌ 错误：{file_path} - {e}")
    
    def generate_report(self) -> str:
        """生成修复报告"""
        report = []
        report.append("="*70)
        report.append("📊 批量自动修复报告")
        report.append("="*70)
        report.append(f"\n扫描文件数：{self.stats['files_scanned']}")
        report.append(f"修改文件数：{self.stats['files_modified']}")
        report.append(f"修复问题数：{self.stats['issues_fixed']}")
        report.append(f"节省时间：{self.stats['time_saved_minutes']} 分钟 ({self.stats['time_saved_minutes']/60:.1f} 小时)")
        
        if self.fixes_applied:
            report.append(f"\n修复详情:")
            for fix in self.fixes_applied[:20]:  # 只显示前 20 个
                report.append(f"  - {fix['file']}: {fix['fix']} ({fix['count']}次)")
        
        return "\n".join(report)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='批量自动修复工具')
    parser.add_argument('--project', type=str, default='.', help='项目根目录')
    parser.add_argument('--dry-run', action='store_true', help='只预览不实际修改')
    parser.add_argument('--output', type=str, help='输出报告文件')
    
    args = parser.parse_args()
    
    # 创建修复器
    fixer = BatchAutoFixer(args.project)
    
    # 执行修复
    stats = fixer.scan_and_fix_project(dry_run=args.dry_run)
    
    # 生成报告
    report = fixer.generate_report()
    logging.info("\n" + report)
    
    # 保存报告
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        logging.info(f"\n报告已保存到：{args.output}")
    
    # 显示效率提升
    logging.info(f"\n⚡ 开发效率提升：+{min(30, stats['time_saved_minutes'] // 10)}%")
    logging.info(f"🎯 目标达成：开发效率 +30% {'✅' if stats['time_saved_minutes'] >= 300 else '⏳'}")


if __name__ == '__main__':
    main()
