import logging

#!/usr/bin/env python3
"""
Static Analysis MCP 功能完整性检查脚本
检查所有功能模块是否正常工作
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class FunctionChecker:
    """功能检查器"""
    
    def __init__(self):
        self.results = []
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        
        # 项目根目录
        self.root_dir = Path(__file__).parent.parent
        self.tools_dir = self.root_dir / 'STATIC_ANALYSIS_TOOLS'
        self.k8s_dir = self.root_dir / 'k8s'
        self.tests_dir = self.root_dir / 'tests'
    
    def check_file_exists(self, file_path: Path, description: str) -> bool:
        """检查文件是否存在"""
        exists = file_path.exists()
        self._record_result(description, exists, str(file_path))
        return exists
    
    def check_directory_exists(self, dir_path: Path, description: str) -> bool:
        """检查目录是否存在"""
        exists = dir_path.exists() and dir_path.is_dir()
        self._record_result(description, exists, str(dir_path))
        return exists
    
    def check_python_syntax(self, file_path: Path) -> bool:
        """检查 Python 语法"""
        try:
            result = subprocess.run(
                [sys.executable, '-m', 'py_compile', str(file_path)],
                capture_output=True,
                text=True,
                timeout=10
            )
            success = result.returncode == 0
            self._record_result(
                f"Python 语法检查：{file_path.name}",
                success,
                file_path.name,
                error=result.stderr if not success else None
            )
            return success
        except Exception as e:
            self._record_result(
                f"Python 语法检查：{file_path.name}",
                False,
                file_path.name,
                error=str(e)
            )
            return False
    
    def check_yaml_syntax(self, file_path: Path) -> bool:
        """检查 YAML 语法"""
        try:
            import yaml
            with open(file_path, 'r') as f:
                yaml.safe_load(f)
            success = True
        except Exception as e:
            success = False
            error = str(e)
        
        self._record_result(
            f"YAML 语法检查：{file_path.name}",
            success,
            file_path.name,
            error=None if success else error
        )
        return success
    
    def _record_result(self, description: str, passed: bool, location: str = '', error: str = None):
        """记录检查结果"""
        self.results.append({
            'description': description,
            'passed': passed,
            'location': location,
            'error': error,
            'timestamp': datetime.now().isoformat()
        })
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def check_core_modules(self):
        """检查核心功能模块"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查核心功能模块{Colors.RESET}")
        logging.info("=" * 60)
        
        modules = [
            ('auto_fix.py', '自动修复功能'),
            ('incremental_analyzer.py', '增量分析功能'),
            ('parallel_scanner.py', '并行扫描功能'),
            ('ai_fix_suggestion.py', 'AI 修复建议功能'),
            ('baseline_manager.py', '基线管理功能'),
            ('sarif_export.py', 'SARIF 导出功能'),
            ('web_dashboard.py', 'Web 仪表盘功能'),
            ('supply_chain_scanner.py', '供应链安全检查功能'),
        ]
        
        for filename, description in modules:
            file_path = self.tools_dir / filename
            self.check_file_exists(file_path, f"{description} ({filename})")
            if file_path.exists():
                self.check_python_syntax(file_path)
    
    def check_production_configs(self):
        """检查生产环境配置"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查生产环境配置{Colors.RESET}")
        logging.info("=" * 60)
        
        # Docker 配置
        docker_files = [
            ('Dockerfile', 'Docker 镜像配置'),
            ('docker-entrypoint.sh', 'Docker 启动脚本'),
            ('.dockerignore', 'Docker 忽略配置'),
        ]
        
        for filename, description in docker_files:
            file_path = self.tools_dir / filename
            self.check_file_exists(file_path, f"{description} ({filename})")
        
        # Docker Compose
        compose_path = self.root_dir / 'docker-compose.production.yml'
        self.check_file_exists(compose_path, 'Docker Compose 生产配置')
        if compose_path.exists():
            self.check_yaml_syntax(compose_path)
        
        # Kubernetes 配置
        k8s_files = [
            '01-namespace.yaml',
            '02-configmap.yaml',
            '03-secret.yaml',
            '04-deployment.yaml',
            '05-hpa.yaml',
            '06-service.yaml',
            '07-ingress.yaml',
            '08-postgres-statefulset.yaml',
        ]
        
        for filename in k8s_files:
            file_path = self.k8s_dir / filename
            self.check_file_exists(file_path, f"K8s 配置：{filename}")
            if file_path.exists():
                self.check_yaml_syntax(file_path)
    
    def check_monitoring_configs(self):
        """检查监控配置"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查监控配置{Colors.RESET}")
        logging.info("=" * 60)
        
        # Prometheus
        prometheus_dir = self.root_dir / 'prometheus'
        prom_files = [
            ('prometheus.yml', 'Prometheus 主配置'),
            ('alerts.yml', 'Prometheus 告警规则'),
            ('alertmanager.yml', 'Alertmanager 配置'),
        ]
        
        for filename, description in prom_files:
            file_path = prometheus_dir / filename
            self.check_file_exists(file_path, f"{description} ({filename})")
            if file_path.exists():
                self.check_yaml_syntax(file_path)
        
        # 日志聚合
        log_dirs = [
            ('fluentd', 'Fluentd 配置'),
            ('elasticsearch', 'Elasticsearch 配置'),
            ('kibana', 'Kibana 配置'),
        ]
        
        for dirname, description in log_dirs:
            dir_path = self.root_dir / dirname
            self.check_directory_exists(dir_path, description)
    
    def check_security_configs(self):
        """检查安全配置"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查安全配置{Colors.RESET}")
        logging.info("=" * 60)
        
        security_files = [
            ('auth.py', 'JWT 认证模块'),
            ('rate_limiter.py', '速率限制模块'),
            ('security_headers.py', '安全响应头模块'),
        ]
        
        for filename, description in security_files:
            file_path = self.tools_dir / filename
            self.check_file_exists(file_path, f"{description} ({filename})")
            if file_path.exists():
                self.check_python_syntax(file_path)
    
    def check_test_files(self):
        """检查测试文件"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查测试文件{Colors.RESET}")
        logging.info("=" * 60)
        
        test_files = [
            'test_ai_fix_suggestion.py',
            'test_parallel_scanner.py',
            'test_supply_chain_scanner.py',
            'test_integration.py',
        ]
        
        for filename in test_files:
            file_path = self.tests_dir / filename
            self.check_file_exists(file_path, f"测试文件：{filename}")
            if file_path.exists():
                self.check_python_syntax(file_path)
    
    def check_documentation(self):
        """检查文档"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查文档{Colors.RESET}")
        logging.info("=" * 60)
        
        docs = [
            ('STATIC_ANALYSIS_MCP_GUIDE.md', '主指南'),
            ('STATIC_ANALYSIS_QUICK_REFERENCE.md', '快速参考'),
            ('TEST_GUIDE.md', '测试指南'),
            ('PRODUCTION_DEPLOYMENT.md', '生产部署指南'),
            ('PRODUCTION_SETUP_COMPLETE.md', '部署完成总结'),
        ]
        
        for filename, description in docs:
            file_path = self.root_dir / filename
            self.check_file_exists(file_path, f"{description} ({filename})")
    
    def check_rule_files(self):
        """检查规则文件"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查规则文件{Colors.RESET}")
        logging.info("=" * 60)
        
        rules_dir = self.tools_dir / 'semgrep_rules'
        rule_files = [
            ('python_security.yaml', 'Python 安全规则'),
            ('javascript_security.yaml', 'JavaScript 安全规则'),
            ('compliance_rules.yaml', '合规性规则'),
            ('framework_rules.yaml', '框架规则'),
            ('language_extensions.yaml', '语言扩展规则'),
        ]
        
        for filename, description in rule_files:
            file_path = rules_dir / filename
            self.check_file_exists(file_path, f"{description} ({filename})")
            if file_path.exists():
                self.check_yaml_syntax(file_path)
    
    def check_github_actions(self):
        """检查 GitHub Actions"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}检查 GitHub Actions{Colors.RESET}")
        logging.info("=" * 60)
        
        workflow_path = self.root_dir / '.github' / 'workflows' / 'deploy.yml'
        self.check_file_exists(workflow_path, 'CI/CD 流水线配置')
        if workflow_path.exists():
            self.check_yaml_syntax(workflow_path)
    
    def run_all_checks(self):
        """运行所有检查"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.CYAN}Static Analysis MCP 功能完整性检查{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
        logging.info(f"检查时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logging.info(f"项目根目录：{self.root_dir}")
        
        self.check_core_modules()
        self.check_production_configs()
        self.check_monitoring_configs()
        self.check_security_configs()
        self.check_test_files()
        self.check_documentation()
        self.check_rule_files()
        self.check_github_actions()
        
        self._print_summary()
    
    def _print_summary(self):
        """打印检查摘要"""
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.CYAN}检查摘要{Colors.RESET}")
        logging.info(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.RESET}")
        
        total = self.passed + self.failed
        
        logging.info(f"\n总检查项：{total}")
        logging.info(f"{Colors.GREEN}✓ 通过：{self.passed}{Colors.RESET}")
        logging.info(f"{Colors.RED}✗ 失败：{self.failed}{Colors.RESET}")
        
        if self.warnings > 0:
            logging.info(f"{Colors.YELLOW}⚠ 警告：{self.warnings}{Colors.RESET}")
        
        pass_rate = (self.passed / total * 100) if total > 0 else 0
        logging.info(f"\n通过率：{pass_rate:.1f}%")
        
        # 显示失败项
        failed_items = [r for r in self.results if not r['passed']]
        if failed_items:
            logging.info(f"\n{Colors.RED}失败项:{Colors.RESET}")
            for item in failed_items:
                logging.info(f"  ✗ {item['description']}")
                if item.get('error'):
                    logging.info(f"    错误：{item['error']}")
        
        # 保存检查结果
        self._save_results()
        
        if self.failed == 0:
            logging.info(f"\n{Colors.BOLD}{Colors.GREEN}🎉 所有功能检查通过！{Colors.RESET}")
        else:
            logging.info(f"\n{Colors.BOLD}{Colors.YELLOW}⚠ 部分功能检查失败，请检查上述错误{Colors.RESET}")
    
    def _save_results(self):
        """保存检查结果"""
        results_file = self.root_dir / 'function_check_results.json'
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump({
                'check_time': datetime.now().isoformat(),
                'summary': {
                    'total': self.passed + self.failed,
                    'passed': self.passed,
                    'failed': self.failed,
                    'warnings': self.warnings,
                    'pass_rate': (self.passed / (self.passed + self.failed) * 100) if (self.passed + self.failed) > 0 else 0
                },
                'results': self.results
            }, f, indent=2, ensure_ascii=False)
        
        logging.info(f"\n检查结果已保存到：{results_file}")


def main():
    """主函数"""
    checker = FunctionChecker()
    checker.run_all_checks()


if __name__ == '__main__':
    main()
