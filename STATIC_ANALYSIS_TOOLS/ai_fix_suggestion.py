import logging

#!/usr/bin/env python3
"""
AI 修复建议生成器
使用 LLM 生成个性化的代码修复建议
"""

import json
import os
from typing import List, Dict, Optional
from pathlib import Path
import requests
from datetime import datetime


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class AIFixSuggestion:
    """AI 修复建议生成器"""
    
    def __init__(self, api_provider: str = 'openai', api_key: str = None, model: str = None):
        """
        初始化 AI 修复建议生成器
        
        Args:
            api_provider: LLM API 提供商 ('openai', 'claude', 'local')
            api_key: API 密钥
            model: 模型名称
        """
        self.api_provider = api_provider
        self.api_key = api_key or os.environ.get('LLM_API_KEY', '')
        self.model = model or self._get_default_model(api_provider)
        
        # API 端点配置
        self.api_endpoints = {
            'openai': 'https://api.openai.com/v1/chat/completions',
            'claude': 'https://api.anthropic.com/v1/messages',
            'local': 'http://localhost:11434/api/generate'  # Ollama
        }
        
        # 请求头
        self.headers = {
            'openai': {
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.api_key}'
            },
            'claude': {
                'Content-Type': 'application/json',
                'x-api-key': self.api_key,
                'anthropic-version': '2023-06-01'
            },
            'local': {
                'Content-Type': 'application/json'
            }
        }
        
        # 统计信息
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'total_time_ms': 0
        }
    
    def _get_default_model(self, provider: str) -> str:
        """获取默认模型"""
        models = {
            'openai': 'gpt-3.5-turbo',
            'claude': 'claude-3-sonnet-20240229',
            'local': 'qwen2.5-coder:7b'
        }
        return models.get(provider, 'gpt-3.5-turbo')
    
    def _build_prompt(self, finding: Dict, code_context: str, project_style: str = '') -> str:
        """
        构建 AI 提示词
        
        Args:
            finding: 问题发现信息
            code_context: 问题代码上下文
            project_style: 项目代码风格描述
        
        Returns:
            构建好的提示词
        """
        prompt = f"""你是一个专业的代码审查和安全专家。请分析以下代码问题并提供修复建议。

## 问题信息
- **规则 ID**: {finding.get('rule_id', 'unknown')}
- **严重性**: {finding.get('severity', 'WARNING')}
- **位置**: {finding.get('file', 'unknown')}:{finding.get('line', 0)}
- **分类**: {finding.get('cwe', '')} / {finding.get('owasp', '')}
- **描述**: {finding.get('message', 'No description')}

## 问题代码
```
{code_context}
```

{f"## 项目代码风格\n{project_style}\n" if project_style else ""}

## 请提供以下内容

### 1. 问题详细说明
- 问题的根本原因
- 可能导致的安全风险或后果
- 为什么这是一个问题

### 2. 至少 2 种修复方案
对每种方案，请提供：
- **方案描述**: 简要说明修复思路
- **修复代码**: 完整的修复后代码
- **优点**: 该方案的优势
- **缺点**: 该方案的不足
- **适用场景**: 什么时候应该选择这个方案

### 3. 推荐方案
- 明确推荐哪种方案
- 详细说明推荐理由

### 4. 额外建议
- 相关的最佳实践
- 如何预防类似问题
- 需要检查的其他地方

请使用以下 JSON 格式返回结果：
```json
{{
  "analysis": {{
    "root_cause": "...",
    "risks": ["...", "..."],
    "why_problem": "..."
  }},
  "fixes": [
    {{
      "id": 1,
      "name": "方案名称",
      "description": "...",
      "code": "修复后的完整代码",
      "pros": ["优点 1", "优点 2"],
      "cons": ["缺点 1"],
      "when_to_use": "适用场景"
    }},
    {{
      "id": 2,
      "name": "方案名称",
      "description": "...",
      "code": "修复后的完整代码",
      "pros": ["优点 1"],
      "cons": ["缺点 1", "缺点 2"],
      "when_to_use": "适用场景"
    }}
  ],
  "recommendation": {{
    "fix_id": 1,
    "reason": "推荐理由"
  }},
  "additional_advice": {{
    "best_practices": ["最佳实践 1", "最佳实践 2"],
    "prevention": "预防措施",
    "related_checks": ["需要检查的相关代码位置"]
  }}
}}
```

确保 JSON 格式正确，可以直接解析。"""
        
        return prompt
    
    def _call_llm(self, prompt: str) -> Optional[Dict]:
        """
        调用 LLM API
        
        Args:
            prompt: 提示词
        
        Returns:
            AI 响应解析后的字典，失败返回 None
        """
        self.stats['total_requests'] += 1
        start_time = datetime.now()
        
        try:
            if self.api_provider == 'openai':
                response = self._call_openai(prompt)
            elif self.api_provider == 'claude':
                response = self._call_claude(prompt)
            elif self.api_provider == 'local':
                response = self._call_local(prompt)
            else:
                logging.info(f"{Colors.RED}未知的 API 提供商：{self.api_provider}{Colors.RESET}")
                return None
            
            elapsed = (datetime.now() - start_time).total_seconds() * 1000
            self.stats['total_time_ms'] += elapsed
            self.stats['successful_requests'] += 1
            
            logging.info(f"{Colors.GREEN}AI 响应时间：{elapsed:.2f}ms{Colors.RESET}")
            return response
            
        except Exception as e:
            self.stats['failed_requests'] += 1
            logging.info(f"{Colors.RED}AI 调用失败：{e}{Colors.RESET}")
            return None
    
    def _call_openai(self, prompt: str) -> Optional[Dict]:
        """调用 OpenAI API"""
        payload = {
            'model': self.model,
            'messages': [
                {'role': 'system', 'content': '你是一个专业的代码审查和安全专家。'},
                {'role': 'user', 'content': prompt}
            ],
            'temperature': 0.3,
            'max_tokens': 2000
        }
        
        response = requests.post(
            self.api_endpoints['openai'],
            headers=self.headers['openai'],
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        content = result['choices'][0]['message']['content']
        
        return self._parse_json_response(content)
    
    def _call_claude(self, prompt: str) -> Optional[Dict]:
        """调用 Claude API"""
        payload = {
            'model': self.model,
            'max_tokens': 2000,
            'messages': [
                {'role': 'user', 'content': prompt}
            ]
        }
        
        response = requests.post(
            self.api_endpoints['claude'],
            headers=self.headers['claude'],
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        
        result = response.json()
        content = result['content'][0]['text']
        
        return self._parse_json_response(content)
    
    def _call_local(self, prompt: str) -> Optional[Dict]:
        """调用本地模型 (Ollama)"""
        payload = {
            'model': self.model,
            'prompt': prompt,
            'stream': False,
            'options': {
                'temperature': 0.3,
                'num_predict': 2000
            }
        }
        
        response = requests.post(
            self.api_endpoints['local'],
            headers=self.headers['local'],
            json=payload,
            timeout=60
        )
        response.raise_for_status()
        
        result = response.json()
        content = result['response']
        
        return self._parse_json_response(content)
    
    def _parse_json_response(self, content: str) -> Optional[Dict]:
        """解析 JSON 响应"""
        try:
            # 尝试直接解析
            return json.loads(content)
        except json.JSONDecodeError:
            # 尝试提取 JSON 代码块
            import re
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            
            # 尝试查找 { 和 }
            start = content.find('{')
            end = content.rfind('}') + 1
            if start != -1 and end > start:
                return json.loads(content[start:end])
            
            logging.info(f"{Colors.YELLOW}警告：无法解析 JSON 响应{Colors.RESET}")
            logging.info(f"原始内容：{content[:200]}...")
            return None
    
    def generate_fix(self, 
                     finding: Dict, 
                     code_context: str,
                     project_style: str = '') -> Optional[Dict]:
        """
        生成修复建议
        
        Args:
            finding: 问题发现信息
            code_context: 问题代码上下文
            project_style: 项目代码风格描述
        
        Returns:
            修复建议字典，包含分析、多种方案、推荐等
        """
        prompt = self._build_prompt(finding, code_context, project_style)
        result = self._call_llm(prompt)
        
        if result:
            # 添加元数据
            result['metadata'] = {
                'finding': finding,
                'generated_at': datetime.now().isoformat(),
                'model': self.model,
                'provider': self.api_provider
            }
        
        return result
    
    def generate_batch(self, 
                       findings: List[Dict], 
                       code_contexts: List[str],
                       max_concurrent: int = 3) -> List[Optional[Dict]]:
        """
        批量生成修复建议
        
        Args:
            findings: 问题发现列表
            code_contexts: 代码上下文列表
            max_concurrent: 最大并发数
        
        Returns:
            修复建议列表
        """
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        results = [None] * len(findings)
        
        with ThreadPoolExecutor(max_workers=max_concurrent) as executor:
            future_to_idx = {
                executor.submit(
                    self.generate_fix, 
                    findings[i], 
                    code_contexts[i]
                ): i
                for i in range(len(findings))
            }
            
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    results[idx] = future.result()
                except Exception as e:
                    logging.info(f"{Colors.RED}生成修复建议失败 (索引 {idx}): {e}{Colors.RESET}")
        
        return results
    
    def evaluate_fix_quality(self, fix_suggestion: Dict) -> Dict:
        """
        评估修复建议质量
        
        Args:
            fix_suggestion: AI 生成的修复建议
        
        Returns:
            质量评估结果
        """
        evaluation = {
            'score': 0,
            'max_score': 10,
            'criteria': {}
        }
        
        # 评估标准 1: 修复方案数量
        fix_count = len(fix_suggestion.get('fixes', []))
        if fix_count >= 2:
            evaluation['criteria']['fix_count'] = 2
            evaluation['score'] += 2
        elif fix_count == 1:
            evaluation['criteria']['fix_count'] = 1
            evaluation['score'] += 1
        
        # 评估标准 2: 包含代码示例
        has_code = any(
            'code' in fix and len(fix['code']) > 0
            for fix in fix_suggestion.get('fixes', [])
        )
        if has_code:
            evaluation['criteria']['has_code'] = True
            evaluation['score'] += 2
        else:
            evaluation['criteria']['has_code'] = False
        
        # 评估标准 3: 包含优缺点分析
        has_analysis = all(
            'pros' in fix and 'cons' in fix
            for fix in fix_suggestion.get('fixes', [])
        )
        if has_analysis:
            evaluation['criteria']['has_analysis'] = True
            evaluation['score'] += 2
        else:
            evaluation['criteria']['has_analysis'] = False
        
        # 评估标准 4: 有明确推荐
        if 'recommendation' in fix_suggestion:
            evaluation['criteria']['has_recommendation'] = True
            evaluation['score'] += 2
        else:
            evaluation['criteria']['has_recommendation'] = False
        
        # 评估标准 5: 响应时间
        avg_time = (
            self.stats['total_time_ms'] / max(self.stats['successful_requests'], 1)
        )
        if avg_time < 5000:  # < 5 秒
            evaluation['criteria']['fast_response'] = True
            evaluation['score'] += 2
        else:
            evaluation['criteria']['fast_response'] = False
        
        evaluation['quality'] = (
            '优秀' if evaluation['score'] >= 8 else
            '良好' if evaluation['score'] >= 6 else
            '及格' if evaluation['score'] >= 4 else
            '需改进'
        )
        
        return evaluation
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            **self.stats,
            'avg_time_ms': (
                self.stats['total_time_ms'] / max(self.stats['successful_requests'], 1)
            ),
            'success_rate': (
                self.stats['successful_requests'] / max(self.stats['total_requests'], 1)
            )
        }


def analyze_project_style(project_root: str) -> str:
    """
    分析项目代码风格
    
    Args:
        project_root: 项目根目录
    
    Returns:
        项目风格描述
    """
    style_description = []
    
    # 扫描项目中的 Python 文件
    py_files = list(Path(project_root).glob('**/*.py'))[:10]  # 限制文件数量
    
    if not py_files:
        return "未检测到 Python 文件"
    
    # 分析命名风格
    function_names = []
    class_names = []
    
    for file in py_files:
        content = file.read_text(errors='ignore')
        import re
        
        # 提取函数名
        functions = re.findall(r'def (\w+)\(', content)
        function_names.extend(functions)
        
        # 提取类名
        classes = re.findall(r'class (\w+)', content)
        class_names.extend(classes)
    
    # 分析命名约定
    snake_case = sum(1 for name in function_names if '_' in name and name.islower())
    camel_case = sum(1 for name in function_names if name[0].islower() and any(c.isupper() for c in name[1:]))
    
    if snake_case > camel_case:
        style_description.append("函数命名：snake_case（Python 风格）")
    else:
        style_description.append("函数命名：camelCase（JavaScript 风格）")
    
    # 分析文档字符串
    has_docstrings = sum(1 for file in py_files if '"""' in file.read_text(errors='ignore'))
    style_description.append(f"文档字符串：{has_docstrings}/{len(py_files)} 文件包含")
    
    # 分析类型注解
    has_type_hints = sum(1 for file in py_files if '->' in file.read_text(errors='ignore'))
    style_description.append(f"类型注解：{has_type_hints}/{len(py_files)} 文件使用")
    
    return "\n".join(style_description)


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI 修复建议生成器')
    parser.add_argument('--provider', choices=['openai', 'claude', 'local'],
                       default='local', help='LLM API 提供商')
    parser.add_argument('--model', help='模型名称')
    parser.add_argument('--api-key', help='API 密钥')
    parser.add_argument('--project', default='.', help='项目根目录')
    parser.add_argument('--test', action='store_true', help='运行测试')
    
    args = parser.parse_args()
    
    # 创建 AI 修复建议生成器
    ai_fixer = AIFixSuggestion(
        api_provider=args.provider,
        api_key=args.api_key,
        model=args.model
    )
    
    if args.test:
        # 运行测试
        logging.info(f"{Colors.BOLD}测试 AI 修复建议生成器{Colors.RESET}\n")
        
        # 示例问题
        test_finding = {
            'rule_id': 'python-sql-injection-fstring',
            'severity': 'ERROR',
            'file': 'src/auth.py',
            'line': 15,
            'cwe': 'CWE-89',
            'owasp': 'A03:2021-Injection',
            'message': '使用 f-string 构建 SQL 查询可能导致 SQL 注入'
        }
        
        test_code = """
def login(username, password):
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    cursor.execute(query)
    return cursor.fetchone()
"""
        
        logging.info(f"{Colors.CYAN}问题：{test_finding['message']}{Colors.RESET}")
        logging.info(f"{Colors.CYAN}代码：{test_code}{Colors.RESET}")
        logging.info(f"\n{Colors.YELLOW}正在生成 AI 修复建议...{Colors.RESET}\n")
        
        result = ai_fixer.generate_fix(test_finding, test_code)
        
        if result:
            logging.info(f"{Colors.GREEN}✓ AI 修复建议生成成功{Colors.RESET}\n")
            
            # 显示分析
            if 'analysis' in result:
                logging.info(f"{Colors.BOLD}问题分析:{Colors.RESET}")
                logging.info(f"  根本原因：{result['analysis'].get('root_cause', 'N/A')}")
                logging.info(f"  风险：{', '.join(result['analysis'].get('risks', []))}\n")
            
            # 显示修复方案
            if 'fixes' in result:
                logging.info(f"{Colors.BOLD}修复方案:{Colors.RESET}")
                for fix in result['fixes']:
                    logging.info(f"\n  方案 {fix['id']}: {fix.get('name', '未命名')}")
                    logging.info(f"  描述：{fix.get('description', 'N/A')}")
                    logging.info(f"  优点：{', '.join(fix.get('pros', []))}")
                    logging.info(f"  缺点：{', '.join(fix.get('cons', []))}")
                    logging.info(f"  适用场景：{fix.get('when_to_use', 'N/A')}")
                    logging.info(f"  代码:\n{fix.get('code', 'N/A')}")
            
            # 显示推荐
            if 'recommendation' in result:
                logging.info(f"\n{Colors.BOLD}推荐方案:{Colors.RESET}")
                rec = result['recommendation']
                logging.info(f"  推荐方案 ID: {rec.get('fix_id', 'N/A')}")
                logging.info(f"  理由：{rec.get('reason', 'N/A')}")
            
            # 质量评估
            evaluation = ai_fixer.evaluate_fix_quality(result)
            logging.info(f"\n{Colors.BOLD}质量评估:{Colors.RESET}")
            logging.info(f"  得分：{evaluation['score']}/{evaluation['max_score']}")
            logging.info(f"  等级：{evaluation['quality']}")
            logging.info(f"  详情：{evaluation['criteria']}")
            
            # 统计信息
            stats = ai_fixer.get_stats()
            logging.info(f"\n{Colors.BOLD}统计信息:{Colors.RESET}")
            logging.info(f"  总请求：{stats['total_requests']}")
            logging.info(f"  成功：{stats['successful_requests']}")
            logging.info(f"  失败：{stats['failed_requests']}")
            logging.info(f"  成功率：{stats['success_rate']:.1%}")
            logging.info(f"  平均时间：{stats['avg_time_ms']:.2f}ms")
        
        else:
            logging.info(f"{Colors.RED}✗ AI 修复建议生成失败{Colors.RESET}")
    
    else:
        # 分析项目风格
        logging.info(f"{Colors.CYAN}分析项目代码风格...{Colors.RESET}")
        style = analyze_project_style(args.project)
        logging.info(f"{style}\n")
        
        logging.info(f"{Colors.GREEN}AI 修复建议生成器已就绪{Colors.RESET}")
        logging.info(f"提供商：{args.provider}")
        logging.info(f"模型：{ai_fixer.model}")


if __name__ == '__main__':
    main()
