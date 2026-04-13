#!/usr/bin/env python3
"""
Serena 代码分析集成模块
将 Serena 的代码符号分析、重构能力集成到 Static Analysis MCP
"""

import subprocess
import json
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class SerenaSymbol:
    """Serena 符号数据结构"""
    name: str
    kind: str  # function, class, method, variable, etc.
    file_path: str
    line: int
    column: int
    end_line: int
    end_column: int
    container_name: Optional[str] = None
    signature: Optional[str] = None
    documentation: Optional[str] = None


@dataclass
class SerenaReference:
    """Serena 引用数据结构"""
    symbol_name: str
    file_path: str
    line: int
    column: int
    context: str
    reference_type: str  # definition, reference, implementation


class SerenaIntegration:
    """Serena 集成类"""
    
    def __init__(self, project_root: str = None):
        """
        初始化 Serena 集成
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.serena_available = self._check_serena_available()
    
    def _check_serena_available(self) -> bool:
        """检查 Serena 是否可用"""
        try:
            # 尝试运行 serena 命令
            result = subprocess.run(
                ['serena', '--version'],
                capture_output=True,
                text=True,
                timeout=10
            )
            return result.returncode == 0
        except Exception as e:
            logger.warning(f"Serena 不可用：{e}")
            return False
    
    def _run_serena_command(self, command: str, args: List[str] = None) -> Optional[Dict]:
        """
        运行 Serena 命令
        
        Args:
            command: Serena 子命令
            args: 命令参数
            
        Returns:
            JSON 输出或 None
        """
        if not self.serena_available:
            logger.error("Serena 不可用")
            return None
        
        cmd = ['serena', command]
        if args:
            cmd.extend(args)
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=60,
                cwd=str(self.project_root)
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout) if result.stdout else {}
            else:
                logger.error(f"Serena 命令失败：{result.stderr}")
                return None
                
        except Exception as e:
            logger.error(f"Serena 命令异常：{e}")
            return None
    
    def get_symbols_overview(self, file_path: str) -> Optional[Dict]:
        """
        获取文件的符号概览
        
        Args:
            file_path: 文件路径
            
        Returns:
            符号概览信息
        """
        result = self._run_serena_command(
            'get-symbols-overview',
            ['--file', str(file_path)]
        )
        
        if result:
            return {
                'file': file_path,
                'symbols': result.get('symbols', []),
                'classes': result.get('classes', []),
                'functions': result.get('functions', []),
                'imports': result.get('imports', [])
            }
        return None
    
    def find_symbol(self, name: str, file_path: str = None) -> List[SerenaSymbol]:
        """
        查找符号
        
        Args:
            name: 符号名称
            file_path: 可选的文件路径限制
            
        Returns:
            符号列表
        """
        args = ['--name', name]
        if file_path:
            args.extend(['--file', str(file_path)])
        
        result = self._run_serena_command('find-symbol', args)
        
        if result:
            symbols = []
            for item in result.get('symbols', []):
                symbols.append(SerenaSymbol(
                    name=item.get('name', ''),
                    kind=item.get('kind', ''),
                    file_path=item.get('file', ''),
                    line=item.get('line', 0),
                    column=item.get('column', 0),
                    end_line=item.get('end_line', 0),
                    end_column=item.get('end_column', 0),
                    container_name=item.get('container_name'),
                    signature=item.get('signature'),
                    documentation=item.get('documentation')
                ))
            return symbols
        return []
    
    def find_references(self, symbol_name: str, file_path: str) -> List[SerenaReference]:
        """
        查找符号引用
        
        Args:
            symbol_name: 符号名称
            file_path: 文件路径
            
        Returns:
            引用列表
        """
        result = self._run_serena_command(
            'find-references',
            ['--symbol', symbol_name, '--file', str(file_path)]
        )
        
        if result:
            references = []
            for item in result.get('references', []):
                references.append(SerenaReference(
                    symbol_name=item.get('symbol_name', ''),
                    file_path=item.get('file', ''),
                    line=item.get('line', 0),
                    column=item.get('column', 0),
                    context=item.get('context', ''),
                    reference_type=item.get('type', 'reference')
                ))
            return references
        return []
    
    def rename_symbol(self, symbol_name: str, new_name: str, file_path: str) -> bool:
        """
        重命名符号
        
        Args:
            symbol_name: 原符号名称
            new_name: 新名称
            file_path: 文件路径
            
        Returns:
            是否成功
        """
        result = self._run_serena_command(
            'rename-symbol',
            [
                '--symbol', symbol_name,
                '--new-name', new_name,
                '--file', str(file_path)
            ]
        )
        
        return result is not None and result.get('success', False)
    
    def get_call_graph(self, function_name: str, depth: int = 2) -> Optional[Dict]:
        """
        获取函数调用图
        
        Args:
            function_name: 函数名称
            depth: 深度
            
        Returns:
            调用图数据
        """
        result = self._run_serena_command(
            'get-call-graph',
            ['--function', function_name, '--depth', str(depth)]
        )
        
        if result:
            return {
                'function': function_name,
                'callers': result.get('callers', []),
                'callees': result.get('callees', []),
                'graph': result.get('graph', {})
            }
        return None
    
    def analyze_complexity(self, file_path: str) -> Optional[Dict]:
        """
        分析代码复杂度
        
        Args:
            file_path: 文件路径
            
        Returns:
            复杂度分析结果
        """
        result = self._run_serena_command(
            'analyze-complexity',
            ['--file', str(file_path)]
        )
        
        if result:
            return {
                'file': file_path,
                'functions': result.get('functions', []),
                'average_complexity': result.get('average_complexity', 0),
                'max_complexity': result.get('max_complexity', 0),
                'high_complexity_functions': result.get('high_complexity_functions', [])
            }
        return None
    
    def extract_code(self, symbol_name: str, file_path: str) -> Optional[str]:
        """
        提取代码片段
        
        Args:
            symbol_name: 符号名称
            file_path: 文件路径
            
        Returns:
            代码字符串
        """
        result = self._run_serena_command(
            'extract-code',
            ['--symbol', symbol_name, '--file', str(file_path)]
        )
        
        if result:
            return result.get('code', '')
        return None
    
    def search_pattern(self, pattern: str, file_pattern: str = None) -> List[Dict]:
        """
        搜索代码模式
        
        Args:
            pattern: 搜索模式
            file_pattern: 文件模式
            
        Returns:
            匹配结果
        """
        args = ['--pattern', pattern]
        if file_pattern:
            args.extend(['--file-pattern', file_pattern])
        
        result = self._run_serena_command('search-pattern', args)
        
        if result:
            return result.get('matches', [])
        return []
    
    def get_file_context(self, file_path: str) -> Optional[Dict]:
        """
        获取文件上下文
        
        Args:
            file_path: 文件路径
            
        Returns:
            文件上下文信息
        """
        result = self._run_serena_command(
            'get-file-context',
            ['--file', str(file_path)]
        )
        
        if result:
            return {
                'file': file_path,
                'imports': result.get('imports', []),
                'exports': result.get('exports', []),
                'dependencies': result.get('dependencies', []),
                'dependents': result.get('dependents', [])
            }
        return None
    
    def analyze_dependencies(self) -> Optional[Dict]:
        """
        分析项目依赖
        
        Returns:
            依赖分析结果
        """
        result = self._run_serena_command('analyze-dependencies')
        
        if result:
            return {
                'modules': result.get('modules', []),
                'dependencies': result.get('dependencies', []),
                'circular_dependencies': result.get('circular_dependencies', []),
                'dependency_graph': result.get('graph', {})
            }
        return None
    
    def get_project_structure(self) -> Optional[Dict]:
        """
        获取项目结构
        
        Returns:
            项目结构信息
        """
        result = self._run_serena_command('get-project-structure')
        
        if result:
            return {
                'directories': result.get('directories', []),
                'modules': result.get('modules', []),
                'structure_tree': result.get('tree', {})
            }
        return None


class SerenaStaticAnalysisIntegration:
    """Serena 与 Static Analysis MCP 的集成类"""
    
    def __init__(self, project_root: str = None):
        """
        初始化集成
        
        Args:
            project_root: 项目根目录
        """
        self.serena = SerenaIntegration(project_root)
        self.project_root = Path(project_root) if project_root else Path.cwd()
    
    def enhanced_security_scan(self, file_path: str) -> Dict:
        """
        增强的安全扫描（结合 Serena 代码分析）
        
        Args:
            file_path: 文件路径
            
        Returns:
            扫描结果
        """
        # 获取符号概览
        symbols_overview = self.serena.get_symbols_overview(file_path)
        
        # 分析复杂度
        complexity = self.serena.analyze_complexity(file_path)
        
        # 获取文件上下文
        file_context = self.serena.get_file_context(file_path)
        
        return {
            'file': file_path,
            'symbols': symbols_overview,
            'complexity': complexity,
            'dependencies': file_context,
            'security_issues': [],  # 这里可以集成其他安全扫描工具
            'recommendations': self._generate_recommendations(symbols_overview, complexity)
        }
    
    def _generate_recommendations(self, symbols_overview: Dict, complexity: Dict) -> List[str]:
        """
        生成改进建议
        
        Args:
            symbols_overview: 符号概览
            complexity: 复杂度分析
            
        Returns:
            建议列表
        """
        recommendations = []
        
        if complexity and complexity.get('max_complexity', 0) > 10:
            high_complexity = complexity.get('high_complexity_functions', [])
            for func in high_complexity:
                recommendations.append(
                    f"函数 '{func.get('name')}' 复杂度过高 ({func.get('complexity')}), "
                    f"建议重构拆分为更小的函数"
                )
        
        if symbols_overview:
            imports = symbols_overview.get('imports', [])
            if len(imports) > 20:
                recommendations.append(
                    f"文件导入过多 ({len(imports)} 个), 建议模块化重构"
                )
        
        return recommendations
    
    def find_security_sensitive_code(self) -> List[Dict]:
        """
        查找安全敏感代码
        
        Returns:
            敏感代码位置列表
        """
        sensitive_patterns = [
            'password', 'secret', 'token', 'api_key', 'credential',
            'execute', 'eval', 'system', 'shell',
            'sql', 'query', 'database',
            'encrypt', 'decrypt', 'hash', 'cipher'
        ]
        
        sensitive_locations = []
        
        for pattern in sensitive_patterns:
            matches = self.serena.search_pattern(pattern)
            for match in matches:
                sensitive_locations.append({
                    'pattern': pattern,
                    'file': match.get('file', ''),
                    'line': match.get('line', 0),
                    'context': match.get('context', ''),
                    'severity': self._assess_severity(pattern)
                })
        
        return sensitive_locations
    
    def _assess_severity(self, pattern: str) -> str:
        """
        评估敏感度级别
        
        Args:
            pattern: 模式
            
        Returns:
            严重性级别
        """
        critical_patterns = ['password', 'secret', 'token', 'api_key']
        high_patterns = ['execute', 'eval', 'system', 'sql']
        
        if any(p in pattern.lower() for p in critical_patterns):
            return 'CRITICAL'
        elif any(p in pattern.lower() for p in high_patterns):
            return 'HIGH'
        else:
            return 'MEDIUM'
    
    def analyze_attack_surface(self) -> Dict:
        """
        分析攻击面
        
        Returns:
            攻击面分析结果
        """
        # 查找所有公开函数/API
        public_apis = self.serena.search_pattern('public|export|api|route')
        
        # 查找用户输入点
        user_inputs = self.serena.search_pattern('input|request|param|query|body')
        
        # 查找数据输出点
        outputs = self.serena.search_pattern('response|output|print|render')
        
        return {
            'public_apis': len(public_apis),
            'user_input_points': len(user_inputs),
            'output_points': len(outputs),
            'attack_surface_score': self._calculate_attack_score(
                len(public_apis), len(user_inputs), len(outputs)
            ),
            'details': {
                'apis': public_apis[:10],  # 限制返回数量
                'inputs': user_inputs[:10],
                'outputs': outputs[:10]
            }
        }
    
    def _calculate_attack_score(self, apis: int, inputs: int, outputs: int) -> float:
        """
        计算攻击面评分
        
        Args:
            apis: 公开 API 数量
            inputs: 输入点数量
            outputs: 输出点数量
            
        Returns:
            攻击面评分 (0-10)
        """
        # 简单加权计算
        score = (apis * 0.3 + inputs * 0.5 + outputs * 0.2) / 10
        return min(10.0, score)
    
    def generate_refactoring_plan(self, file_path: str) -> Dict:
        """
        生成重构计划
        
        Args:
            file_path: 文件路径
            
        Returns:
            重构计划
        """
        # 获取复杂度分析
        complexity = self.serena.analyze_complexity(file_path)
        
        # 获取符号信息
        symbols = self.serena.get_symbols_overview(file_path)
        
        # 获取依赖关系
        dependencies = self.serena.get_file_context(file_path)
        
        plan = {
            'file': file_path,
            'priority': 'HIGH' if complexity and complexity.get('max_complexity', 0) > 15 else 'MEDIUM',
            'issues': [],
            'suggestions': []
        }
        
        # 高复杂度函数
        if complexity and complexity.get('high_complexity_functions'):
            for func in complexity['high_complexity_functions']:
                plan['issues'].append({
                    'type': 'HIGH_COMPLEXITY',
                    'function': func.get('name'),
                    'complexity': func.get('complexity'),
                    'suggestion': f"将 {func.get('name')} 拆分为多个小函数"
                })
        
        # 过多依赖
        if dependencies and len(dependencies.get('imports', [])) > 15:
            plan['issues'].append({
                'type': 'TOO_MANY_IMPORTS',
                'count': len(dependencies['imports']),
                'suggestion': '考虑模块化重构，减少导入数量'
            })
        
        return plan


def main():
    """主函数 - 示例用法"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Serena 集成工具')
    parser.add_argument('project', nargs='?', default='.',
                       help='项目根目录')
    parser.add_argument('--command', choices=['overview', 'complexity', 'dependencies', 'security', 'attack-surface'],
                       default='overview',
                       help='执行的命令')
    parser.add_argument('--file', help='要分析的文件')
    
    args = parser.parse_args()
    
    integration = SerenaStaticAnalysisIntegration(args.project)
    
    if args.command == 'overview':
        if args.file:
            result = integration.serena.get_symbols_overview(args.file)
            logging.info(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            result = integration.serena.get_project_structure()
            logging.info(json.dumps(result, indent=2, ensure_ascii=False))
    
    elif args.command == 'complexity':
        if args.file:
            result = integration.serena.analyze_complexity(args.file)
            logging.info(json.dumps(result, indent=2, ensure_ascii=False))
    
    elif args.command == 'dependencies':
        result = integration.serena.analyze_dependencies()
        logging.info(json.dumps(result, indent=2, ensure_ascii=False))
    
    elif args.command == 'security':
        result = integration.find_security_sensitive_code()
        logging.info(json.dumps(result, indent=2, ensure_ascii=False))
    
    elif args.command == 'attack-surface':
        result = integration.analyze_attack_surface()
        logging.info(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
