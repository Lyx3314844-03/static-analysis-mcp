import logging

"""
Serena 集成 MCP 工具
将 Serena 的代码分析能力封装为 MCP 工具
"""

from typing import Dict, List, Optional
import json
from pathlib import Path
import sys

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入 Serena 集成模块
try:
    from serena_integration import SerenaIntegration, SerenaStaticAnalysisIntegration
except ImportError:
    # 如果无法导入，定义占位类
    class SerenaIntegration:
        def __init__(self, *args, **kwargs):
            pass
    
    class SerenaStaticAnalysisIntegration:
        def __init__(self, *args, **kwargs):
            pass


class SerenaMCPTools:
    """Serena MCP 工具类"""
    
    def __init__(self, project_root: str = None):
        """
        初始化 Serena MCP 工具
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root) if project_root else Path.cwd()
        self.serena = SerenaIntegration(str(self.project_root))
        self.integration = SerenaStaticAnalysisIntegration(str(self.project_root))
    
    def get_symbols_overview(self, file_path: str) -> Dict:
        """
        获取文件符号概览
        
        Args:
            file_path: 文件路径
            
        Returns:
            符号概览信息
        """
        result = self.serena.get_symbols_overview(file_path)
        
        return {
            'success': result is not None,
            'data': result,
            'message': '获取符号概览成功' if result else '获取符号概览失败'
        }
    
    def find_symbol(self, name: str, file_path: Optional[str] = None) -> Dict:
        """
        查找符号
        
        Args:
            name: 符号名称
            file_path: 可选的文件路径
            
        Returns:
            符号列表
        """
        symbols = self.serena.find_symbol(name, file_path)
        
        return {
            'success': True,
            'count': len(symbols),
            'symbols': [
                {
                    'name': s.name,
                    'kind': s.kind,
                    'file': s.file_path,
                    'line': s.line,
                    'signature': s.signature,
                    'documentation': s.documentation
                }
                for s in symbols
            ]
        }
    
    def find_references(self, symbol_name: str, file_path: str) -> Dict:
        """
        查找符号引用
        
        Args:
            symbol_name: 符号名称
            file_path: 文件路径
            
        Returns:
            引用列表
        """
        references = self.serena.find_references(symbol_name, file_path)
        
        return {
            'success': True,
            'count': len(references),
            'references': [
                {
                    'file': r.file_path,
                    'line': r.line,
                    'type': r.reference_type,
                    'context': r.context
                }
                for r in references
            ]
        }
    
    def get_call_graph(self, function_name: str, depth: int = 2) -> Dict:
        """
        获取函数调用图
        
        Args:
            function_name: 函数名称
            depth: 深度
            
        Returns:
            调用图数据
        """
        result = self.serena.get_call_graph(function_name, depth)
        
        return {
            'success': result is not None,
            'data': result,
            'message': '获取调用图成功' if result else '获取调用图失败'
        }
    
    def analyze_complexity(self, file_path: str) -> Dict:
        """
        分析代码复杂度
        
        Args:
            file_path: 文件路径
            
        Returns:
            复杂度分析结果
        """
        result = self.serena.analyze_complexity(file_path)
        
        return {
            'success': result is not None,
            'data': result,
            'message': '复杂度分析成功' if result else '复杂度分析失败'
        }
    
    def extract_code(self, symbol_name: str, file_path: str) -> Dict:
        """
        提取代码片段
        
        Args:
            symbol_name: 符号名称
            file_path: 文件路径
            
        Returns:
            代码字符串
        """
        code = self.serena.extract_code(symbol_name, file_path)
        
        return {
            'success': code is not None,
            'code': code or '',
            'message': '代码提取成功' if code else '代码提取失败'
        }
    
    def rename_symbol(self, symbol_name: str, new_name: str, file_path: str) -> Dict:
        """
        重命名符号
        
        Args:
            symbol_name: 原符号名称
            new_name: 新名称
            file_path: 文件路径
            
        Returns:
            操作结果
        """
        success = self.serena.rename_symbol(symbol_name, new_name, file_path)
        
        return {
            'success': success,
            'message': f'符号重命名{"成功" if success else "失败"}',
            'old_name': symbol_name,
            'new_name': new_name
        }
    
    def search_pattern(self, pattern: str, file_pattern: Optional[str] = None) -> Dict:
        """
        搜索代码模式
        
        Args:
            pattern: 搜索模式
            file_pattern: 文件模式
            
        Returns:
            匹配结果
        """
        matches = self.serena.search_pattern(pattern, file_pattern)
        
        return {
            'success': True,
            'count': len(matches),
            'matches': matches
        }
    
    def get_file_context(self, file_path: str) -> Dict:
        """
        获取文件上下文
        
        Args:
            file_path: 文件路径
            
        Returns:
            文件上下文信息
        """
        result = self.serena.get_file_context(file_path)
        
        return {
            'success': result is not None,
            'data': result,
            'message': '获取文件上下文成功' if result else '获取文件上下文失败'
        }
    
    def analyze_dependencies(self) -> Dict:
        """
        分析项目依赖
        
        Returns:
            依赖分析结果
        """
        result = self.serena.analyze_dependencies()
        
        return {
            'success': result is not None,
            'data': result,
            'message': '依赖分析成功' if result else '依赖分析失败'
        }
    
    def enhanced_security_scan(self, file_path: str) -> Dict:
        """
        增强的安全扫描
        
        Args:
            file_path: 文件路径
            
        Returns:
            扫描结果
        """
        result = self.integration.enhanced_security_scan(file_path)
        
        return {
            'success': True,
            'data': result,
            'message': '增强安全扫描完成'
        }
    
    def find_security_sensitive_code(self) -> Dict:
        """
        查找安全敏感代码
        
        Returns:
            敏感代码位置
        """
        locations = self.integration.find_security_sensitive_code()
        
        return {
            'success': True,
            'count': len(locations),
            'locations': locations
        }
    
    def analyze_attack_surface(self) -> Dict:
        """
        分析攻击面
        
        Returns:
            攻击面分析结果
        """
        result = self.integration.analyze_attack_surface()
        
        return {
            'success': True,
            'data': result,
            'message': '攻击面分析完成'
        }
    
    def generate_refactoring_plan(self, file_path: str) -> Dict:
        """
        生成重构计划
        
        Args:
            file_path: 文件路径
            
        Returns:
            重构计划
        """
        result = self.integration.generate_refactoring_plan(file_path)
        
        return {
            'success': True,
            'data': result,
            'message': '重构计划生成完成'
        }
    
    def get_project_structure(self) -> Dict:
        """
        获取项目结构
        
        Returns:
            项目结构信息
        """
        result = self.serena.get_project_structure()
        
        return {
            'success': result is not None,
            'data': result,
            'message': '获取项目结构成功' if result else '获取项目结构失败'
        }


# MCP 工具定义
MCP_TOOLS = {
    'serena-get-symbols-overview': {
        'description': '获取文件的符号概览（函数、类、导入等）',
        'input_schema': {
            'type': 'object',
            'properties': {
                'file_path': {
                    'type': 'string',
                    'description': '要分析的文件路径'
                }
            },
            'required': ['file_path']
        },
        'method': 'get_symbols_overview'
    },
    'serena-find-symbol': {
        'description': '查找符号定义',
        'input_schema': {
            'type': 'object',
            'properties': {
                'name': {
                    'type': 'string',
                    'description': '符号名称'
                },
                'file_path': {
                    'type': 'string',
                    'description': '可选的文件路径限制'
                }
            },
            'required': ['name']
        },
        'method': 'find_symbol'
    },
    'serena-find-references': {
        'description': '查找符号的所有引用',
        'input_schema': {
            'type': 'object',
            'properties': {
                'symbol_name': {
                    'type': 'string',
                    'description': '符号名称'
                },
                'file_path': {
                    'type': 'string',
                    'description': '文件路径'
                }
            },
            'required': ['symbol_name', 'file_path']
        },
        'method': 'find_references'
    },
    'serena-get-call-graph': {
        'description': '获取函数调用图',
        'input_schema': {
            'type': 'object',
            'properties': {
                'function_name': {
                    'type': 'string',
                    'description': '函数名称'
                },
                'depth': {
                    'type': 'integer',
                    'description': '调用图深度',
                    'default': 2
                }
            },
            'required': ['function_name']
        },
        'method': 'get_call_graph'
    },
    'serena-analyze-complexity': {
        'description': '分析代码复杂度',
        'input_schema': {
            'type': 'object',
            'properties': {
                'file_path': {
                    'type': 'string',
                    'description': '文件路径'
                }
            },
            'required': ['file_path']
        },
        'method': 'analyze_complexity'
    },
    'serena-extract-code': {
        'description': '提取符号的代码',
        'input_schema': {
            'type': 'object',
            'properties': {
                'symbol_name': {
                    'type': 'string',
                    'description': '符号名称'
                },
                'file_path': {
                    'type': 'string',
                    'description': '文件路径'
                }
            },
            'required': ['symbol_name', 'file_path']
        },
        'method': 'extract_code'
    },
    'serena-rename-symbol': {
        'description': '重命名符号',
        'input_schema': {
            'type': 'object',
            'properties': {
                'symbol_name': {
                    'type': 'string',
                    'description': '原符号名称'
                },
                'new_name': {
                    'type': 'string',
                    'description': '新名称'
                },
                'file_path': {
                    'type': 'string',
                    'description': '文件路径'
                }
            },
            'required': ['symbol_name', 'new_name', 'file_path']
        },
        'method': 'rename_symbol'
    },
    'serena-search-pattern': {
        'description': '搜索代码模式',
        'input_schema': {
            'type': 'object',
            'properties': {
                'pattern': {
                    'type': 'string',
                    'description': '搜索模式'
                },
                'file_pattern': {
                    'type': 'string',
                    'description': '文件模式'
                }
            },
            'required': ['pattern']
        },
        'method': 'search_pattern'
    },
    'serena-get-file-context': {
        'description': '获取文件上下文（导入、导出、依赖）',
        'input_schema': {
            'type': 'object',
            'properties': {
                'file_path': {
                    'type': 'string',
                    'description': '文件路径'
                }
            },
            'required': ['file_path']
        },
        'method': 'get_file_context'
    },
    'serena-analyze-dependencies': {
        'description': '分析项目依赖关系',
        'input_schema': {
            'type': 'object',
            'properties': {}
        },
        'method': 'analyze_dependencies'
    },
    'serena-enhanced-security-scan': {
        'description': '增强的安全扫描（结合 Serena 代码分析）',
        'input_schema': {
            'type': 'object',
            'properties': {
                'file_path': {
                    'type': 'string',
                    'description': '文件路径'
                }
            },
            'required': ['file_path']
        },
        'method': 'enhanced_security_scan'
    },
    'serena-find-security-sensitive-code': {
        'description': '查找安全敏感代码',
        'input_schema': {
            'type': 'object',
            'properties': {}
        },
        'method': 'find_security_sensitive_code'
    },
    'serena-analyze-attack-surface': {
        'description': '分析攻击面',
        'input_schema': {
            'type': 'object',
            'properties': {}
        },
        'method': 'analyze_attack_surface'
    },
    'serena-generate-refactoring-plan': {
        'description': '生成重构计划',
        'input_schema': {
            'type': 'object',
            'properties': {
                'file_path': {
                    'type': 'string',
                    'description': '文件路径'
                }
            },
            'required': ['file_path']
        },
        'method': 'generate_refactoring_plan'
    },
    'serena-get-project-structure': {
        'description': '获取项目结构',
        'input_schema': {
            'type': 'object',
            'properties': {}
        },
        'method': 'get_project_structure'
    }
}


def execute_mcp_tool(tool_name: str, arguments: Dict, project_root: str = None) -> Dict:
    """
    执行 MCP 工具
    
    Args:
        tool_name: 工具名称
        arguments: 工具参数
        project_root: 项目根目录
        
    Returns:
        工具执行结果
    """
    tools = SerenaMCPTools(project_root)
    
    if tool_name not in MCP_TOOLS:
        return {
            'success': False,
            'error': f'未知工具：{tool_name}'
        }
    
    tool_config = MCP_TOOLS[tool_name]
    method_name = tool_config['method']
    
    if not hasattr(tools, method_name):
        return {
            'success': False,
            'error': f'方法不存在：{method_name}'
        }
    
    method = getattr(tools, method_name)
    
    try:
        result = method(**arguments)
        return result
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


if __name__ == '__main__':
    # 测试示例
    tools = SerenaMCPTools()
    
    # 测试获取项目结构
    result = tools.get_project_structure()
    logging.info(json.dumps(result, indent=2, ensure_ascii=False))
