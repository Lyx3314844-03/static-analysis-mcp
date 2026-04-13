import logging

#!/usr/bin/env python3
"""
预测性分析模块
基于历史数据预测潜在问题、代码风险和技术债务
"""

import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import hashlib


@dataclass
class RiskPrediction:
    """风险预测结果"""
    file_path: str
    risk_level: str  # LOW, MEDIUM, HIGH, CRITICAL
    risk_score: float  # 0-100
    predicted_issues: List[str]
    confidence: float
    recommendation: str


class CodeRiskPredictor:
    """代码风险预测器"""
    
    def __init__(self, project_root: str):
        """
        初始化风险预测器
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
        self.historical_data = []
        self.risk_models = {}
    
    def analyze_file(self, file_path: str) -> RiskPrediction:
        """
        分析单个文件的风险
        
        Args:
            file_path: 文件路径
            
        Returns:
            风险预测结果
        """
        # 计算风险指标
        metrics = self._calculate_metrics(file_path)
        
        # 预测风险
        risk_score = self._calculate_risk_score(metrics)
        risk_level = self._determine_risk_level(risk_score)
        predicted_issues = self._predict_issues(metrics)
        
        return RiskPrediction(
            file_path=file_path,
            risk_level=risk_level,
            risk_score=risk_score,
            predicted_issues=predicted_issues,
            confidence=0.85,
            recommendation=self._generate_recommendation(predicted_issues)
        )
    
    def _calculate_metrics(self, file_path: str) -> Dict:
        """计算文件指标"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            lines = content.split('\n')
            
            return {
                'loc': len(lines),  # 代码行数
                'complexity': self._estimate_complexity(content),
                'comments_ratio': self._calculate_comment_ratio(lines),
                'imports_count': self._count_imports(content),
                'functions_count': content.count('def ') + content.count('function '),
                'classes_count': content.count('class '),
                'max_line_length': max(len(line) for line in lines) if lines else 0,
                'duplicate_ratio': self._estimate_duplication(content)
            }
        except Exception:
            return {}
    
    def _estimate_complexity(self, content: str) -> int:
        """估算代码复杂度"""
        # 简化版复杂度计算
        keywords = ['if', 'elif', 'else', 'for', 'while', 'try', 'except', 'with']
        complexity = 1
        for keyword in keywords:
            complexity += content.count(f' {keyword} ')
        return complexity
    
    def _calculate_comment_ratio(self, lines: List[str]) -> float:
        """计算注释比例"""
        if not lines:
            return 0.0
        comment_lines = sum(1 for line in lines if line.strip().startswith('#') or line.strip().startswith('//'))
        return comment_lines / len(lines)
    
    def _count_imports(self, content: str) -> int:
        """计算导入数量"""
        return content.count('import ') + content.count('from ')
    
    def _estimate_duplication(self, content: str) -> float:
        """估算代码重复率"""
        lines = content.split('\n')
        unique_lines = set(lines)
        if len(lines) == 0:
            return 0.0
        return 1.0 - (len(unique_lines) / len(lines))
    
    def _calculate_risk_score(self, metrics: Dict) -> float:
        """计算风险得分"""
        score = 0.0
        
        # 复杂度高增加风险
        if metrics.get('complexity', 0) > 20:
            score += 30
        elif metrics.get('complexity', 0) > 10:
            score += 15
        
        # 注释少增加风险
        if metrics.get('comments_ratio', 0) < 0.1:
            score += 20
        
        # 文件太大增加风险
        if metrics.get('loc', 0) > 500:
            score += 15
        
        # 导入太多增加风险
        if metrics.get('imports_count', 0) > 20:
            score += 10
        
        # 重复代码增加风险
        if metrics.get('duplicate_ratio', 0) > 0.3:
            score += 25
        
        return min(100, score)
    
    def _determine_risk_level(self, score: float) -> str:
        """确定风险等级"""
        if score >= 75:
            return "CRITICAL"
        elif score >= 50:
            return "HIGH"
        elif score >= 25:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _predict_issues(self, metrics: Dict) -> List[str]:
        """预测潜在问题"""
        issues = []
        
        if metrics.get('complexity', 0) > 20:
            issues.append("高复杂度可能导致难以维护")
        
        if metrics.get('comments_ratio', 0) < 0.1:
            issues.append("注释不足可能导致理解困难")
        
        if metrics.get('loc', 0) > 500:
            issues.append("文件过长建议拆分")
        
        if metrics.get('duplicate_ratio', 0) > 0.3:
            issues.append("代码重复率高建议重构")
        
        if metrics.get('imports_count', 0) > 20:
            issues.append("依赖过多可能增加耦合")
        
        return issues
    
    def _generate_recommendation(self, issues: List[str]) -> str:
        """生成修复建议"""
        if not issues:
            return "代码质量良好，继续保持"
        
        recommendations = []
        for issue in issues:
            if "复杂度" in issue:
                recommendations.append("• 将大函数拆分为小函数")
            elif "注释" in issue:
                recommendations.append("• 添加文档字符串和注释")
            elif "文件过长" in issue:
                recommendations.append("• 拆分为多个模块")
            elif "重复" in issue:
                recommendations.append("• 提取公共逻辑")
            elif "依赖" in issue:
                recommendations.append("• 减少不必要的导入")
        
        return "\n".join(recommendations)
    
    def analyze_project(self, file_pattern: str = "*.py") -> List[RiskPrediction]:
        """
        分析整个项目
        
        Args:
            file_pattern: 文件模式
            
        Returns:
            风险预测列表
        """
        predictions = []
        
        for file_path in self.project_root.rglob(file_pattern):
            if file_path.is_file():
                prediction = self.analyze_file(str(file_path))
                if prediction.risk_level in ["HIGH", "CRITICAL"]:
                    predictions.append(prediction)
        
        # 按风险得分排序
        predictions.sort(key=lambda x: x.risk_score, reverse=True)
        
        return predictions


class TechnicalDebtPredictor:
    """技术债务预测器"""
    
    def __init__(self, project_root: str):
        """
        初始化技术债务预测器
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
    
    def predict_debt(self, file_path: str) -> Dict:
        """
        预测文件的技术债务
        
        Args:
            file_path: 文件路径
            
        Returns:
            债务预测
        """
        metrics = self._analyze_file(file_path)
        
        debt_hours = self._estimate_debt_hours(metrics)
        debt_cost = self._estimate_debt_cost(debt_hours)
        
        return {
            "file": file_path,
            "debt_hours": debt_hours,
            "debt_cost_usd": debt_cost,
            "main_contributors": metrics.get("issues", []),
            "payback_plan": self._generate_payback_plan(metrics)
        }
    
    def _analyze_file(self, file_path: str) -> Dict:
        """分析文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            return {
                "loc": len(content.split('\n')),
                "complexity": self._calculate_complexity(content),
                "code_smells": self._count_code_smells(content),
                "bugs": self._count_potential_bugs(content),
                "vulnerabilities": self._count_potential_vulnerabilities(content)
            }
        except Exception:
            return {}
    
    def _calculate_complexity(self, content: str) -> int:
        """计算复杂度"""
        return content.count('if ') + content.count('for ') + content.count('while ')
    
    def _count_code_smells(self, content: str) -> int:
        """计算代码异味"""
        smells = 0
        smells += content.count('TODO')
        smells += content.count('FIXME')
        smells += content.count('XXX')
        smells += content.count('HACK')
        return smells
    
    def _count_potential_bugs(self, content: str) -> int:
        """计算潜在 bug"""
        bugs = 0
        bugs += content.count('except:')  # 裸 except
        bugs += content.count('eval(')  # eval 使用
        bugs += content.count('exec(')  # exec 使用
        return bugs
    
    def _count_potential_vulnerabilities(self, content: str) -> int:
        """计算潜在漏洞"""
        vulns = 0
        vulns += content.count('f"SELECT')  # SQL 注入风险
        vulns += content.count('password = "')  # 硬编码密码
        vulns += content.count('api_key = "')  # 硬编码 API 密钥
        return vulns
    
    def _estimate_debt_hours(self, metrics: Dict) -> float:
        """估算债务工时"""
        hours = 0.0
        
        # 复杂度债务
        if metrics.get('complexity', 0) > 10:
            hours += (metrics['complexity'] - 10) * 0.5
        
        # 代码异味债务
        hours += metrics.get('code_smells', 0) * 0.25
        
        # Bug 修复债务
        hours += metrics.get('bugs', 0) * 1.0
        
        # 漏洞修复债务
        hours += metrics.get('vulnerabilities', 0) * 2.0
        
        return round(hours, 2)
    
    def _estimate_debt_cost(self, hours: float, hourly_rate: float = 100.0) -> float:
        """估算债务成本"""
        return round(hours * hourly_rate, 2)
    
    def _generate_payback_plan(self, metrics: Dict) -> List[str]:
        """生成偿还计划"""
        plan = []
        
        if metrics.get('complexity', 0) > 10:
            plan.append("1. 重构高复杂度函数 (优先级：高)")
        
        if metrics.get('code_smells', 0) > 0:
            plan.append("2. 清理 TODO/FIXME 注释 (优先级：中)")
        
        if metrics.get('bugs', 0) > 0:
            plan.append("3. 修复潜在 bug (优先级：高)")
        
        if metrics.get('vulnerabilities', 0) > 0:
            plan.append("4. 修复安全漏洞 (优先级：紧急)")
        
        return plan


class ChangeRiskAnalyzer:
    """变更风险分析器"""
    
    def __init__(self, project_root: str):
        """
        初始化变更风险分析器
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
    
    def analyze_change(self, file_path: str, changes: List[str]) -> Dict:
        """
        分析代码变更风险
        
        Args:
            file_path: 文件路径
            changes: 变更列表
            
        Returns:
            风险分析结果
        """
        risk_factors = []
        risk_score = 0
        
        # 分析变更内容
        for change in changes:
            if 'security' in change.lower() or 'auth' in change.lower():
                risk_factors.append("安全相关变更")
                risk_score += 30
            
            if 'database' in change.lower() or 'sql' in change.lower():
                risk_factors.append("数据库相关变更")
                risk_score += 20
            
            if 'api' in change.lower() or 'interface' in change.lower():
                risk_factors.append("接口变更")
                risk_score += 15
            
            if len(change) > 100:
                risk_factors.append("大规模变更")
                risk_score += 10
        
        return {
            "file": file_path,
            "risk_score": min(100, risk_score),
            "risk_level": self._get_risk_level(risk_score),
            "risk_factors": risk_factors,
            "recommendation": self._get_recommendation(risk_factors),
            "requires_review": risk_score >= 30,
            "requires_test": risk_score >= 20
        }
    
    def _get_risk_level(self, score: float) -> str:
        """获取风险等级"""
        if score >= 60:
            return "HIGH"
        elif score >= 30:
            return "MEDIUM"
        else:
            return "LOW"
    
    def _get_recommendation(self, factors: List[str]) -> str:
        """获取建议"""
        if not factors:
            return "变更风险低，可正常合并"
        
        recommendations = ["建议："]
        
        if "安全相关变更" in factors:
            recommendations.append("- 需要安全团队审查")
        
        if "数据库相关变更" in factors:
            recommendations.append("- 需要 DBA 审查")
        
        if "接口变更" in factors:
            recommendations.append("- 需要更新 API 文档")
        
        if "大规模变更" in factors:
            recommendations.append("- 建议拆分为小 PR")
        
        return "\n".join(recommendations)


def main():
    """主函数 - 示例用法"""
    import argparse
    
    parser = argparse.ArgumentParser(description="预测性分析工具")
    parser.add_argument("--project", type=str, default=".", help="项目根目录")
    parser.add_argument("--mode", choices=['risk', 'debt', 'change'], default='risk',
                       help="分析模式")
    parser.add_argument("--file", type=str, help="要分析的文件")
    
    args = parser.parse_args()
    
    if args.mode == 'risk':
        predictor = CodeRiskPredictor(args.project)
        
        if args.file:
            result = predictor.analyze_file(args.file)
            logging.info(f"\n文件：{result.file_path}")
            logging.info(f"风险等级：{result.risk_level}")
            logging.info(f"风险得分：{result.risk_score:.1f}/100")
            logging.info(f"预测问题:")
            for issue in result.predicted_issues:
                logging.info(f"  - {issue}")
            logging.info(f"建议:\n{result.recommendation}")
        else:
            predictions = predictor.analyze_project()
            logging.info(f"\n发现 {len(predictions)} 个高风险文件:")
            for pred in predictions[:10]:
                logging.info(f"  {pred.file_path}: {pred.risk_level} ({pred.risk_score:.1f})")
    
    elif args.mode == 'debt':
        debt_predictor = TechnicalDebtPredictor(args.project)
        
        if args.file:
            result = debt_predictor.predict_debt(args.file)
            logging.info(f"\n文件：{result['file']}")
            logging.info(f"技术债务：{result['debt_hours']:.2f} 小时")
            logging.info(f"估算成本：${result['debt_cost_usd']:.2f}")
            logging.info(f"偿还计划:")
            for step in result['payback_plan']:
                logging.info(f"  {step}")
    
    elif args.mode == 'change':
        analyzer = ChangeRiskAnalyzer(args.project)
        
        if args.file:
            changes = ["Added security check", "Modified database query"]
            result = analyzer.analyze_change(args.file, changes)
            logging.info(f"\n文件：{result['file']}")
            logging.info(f"风险等级：{result['risk_level']}")
            logging.info(f"风险得分：{result['risk_score']}")
            logging.info(f"风险因素:")
            for factor in result['risk_factors']:
                logging.info(f"  - {factor}")
            logging.info(result['recommendation'])


if __name__ == "__main__":
    main()
