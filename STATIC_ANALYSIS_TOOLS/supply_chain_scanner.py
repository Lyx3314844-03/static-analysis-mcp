import logging

#!/usr/bin/env python3
"""
供应链安全检查工具
检测依赖项中的恶意包、漏洞和风险
"""

import json
import os
import subprocess
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import requests
import hashlib


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class SupplyChainScanner:
    """供应链安全扫描器"""
    
    def __init__(self):
        self.osv_api = 'https://api.osv.dev/v1/query'
        self.npm_api = 'https://registry.npmjs.org'
        self.pypi_api = 'https://pypi.org/pypi'
        self.results = []
    
    def parse_requirements(self, file_path: str) -> List[Dict]:
        """解析 Python requirements.txt"""
        dependencies = []
        
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                
                # 解析包名和版本
                if '==' in line:
                    name, version = line.split('==')
                elif '>=' in line:
                    name, version = line.split('>=')
                else:
                    name = line.split()[0]
                    version = 'latest'
                
                dependencies.append({
                    'name': name.strip(),
                    'version': version.strip(),
                    'ecosystem': 'PyPI'
                })
        
        return dependencies
    
    def parse_package_json(self, file_path: str) -> List[Dict]:
        """解析 Node.js package.json"""
        dependencies = []
        
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # 解析 dependencies
        for name, version in data.get('dependencies', {}).items():
            dependencies.append({
                'name': name,
                'version': version.lstrip('^~'),
                'ecosystem': 'npm'
            })
        
        # 解析 devDependencies
        for name, version in data.get('devDependencies', {}).items():
            dependencies.append({
                'name': name,
                'version': version.lstrip('^~'),
                'ecosystem': 'npm',
                'dev': True
            })
        
        return dependencies
    
    def parse_cargo_toml(self, file_path: str) -> List[Dict]:
        """解析 Rust Cargo.toml"""
        dependencies = []
        
        with open(file_path, 'r') as f:
            content = f.read()
        
        in_dependencies = False
        for line in content.split('\n'):
            if '[dependencies]' in line:
                in_dependencies = True
                continue
            elif line.startswith('['):
                in_dependencies = False
                continue
            
            if in_dependencies and '=' in line:
                parts = line.split('=')
                name = parts[0].strip()
                version = parts[1].strip().strip('"')
                
                dependencies.append({
                    'name': name,
                    'version': version,
                    'ecosystem': 'crates.io'
                })
        
        return dependencies
    
    def check_vulnerabilities(self, package: str, version: str, ecosystem: str) -> List[Dict]:
        """检查已知漏洞（使用 OSV 数据库）"""
        vulnerabilities = []
        
        try:
            payload = {
                'package': {
                    'name': package,
                    'ecosystem': ecosystem
                },
                'version': version
            }
            
            response = requests.post(self.osv_api, json=payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                for vuln in data.get('vulns', []):
                    vulnerabilities.append({
                        'id': vuln.get('id', 'Unknown'),
                        'summary': vuln.get('summary', 'No summary'),
                        'severity': vuln.get('severity', 'UNKNOWN'),
                        'database_specific': vuln.get('database_specific', {})
                    })
        except Exception as e:
            logging.info(f"{Colors.YELLOW}警告：检查漏洞失败 {package}: {e}{Colors.RESET}")
        
        return vulnerabilities
    
    def check_package_health(self, package: str, ecosystem: str) -> Dict:
        """检查包健康度（维护状态、下载量等）"""
        health = {
            'is_abandoned': False,
            'last_update': None,
            'download_count': 0,
            'maintainer_count': 0,
            'risk_score': 0
        }
        
        try:
            if ecosystem == 'PyPI':
                response = requests.get(f'{self.pypi_api}/{package}/json', timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    info = data.get('info', {})
                    
                    # 检查最后更新时间
                    time_field = info.get('time', {})
                    health['last_update'] = time_field.get('modified')
                    
                    # 检查维护者数量
                    health['maintainer_count'] = len(info.get('maintainers', []))
                    
                    # 如果超过 1 年未更新，标记为可能废弃
                    if health['last_update']:
                        last_update = datetime.fromisoformat(health['last_update'].replace('Z', '+00:00'))
                        days_since_update = (datetime.now(last_update.tzinfo) - last_update).days
                        if days_since_update > 365:
                            health['is_abandoned'] = True
                            health['risk_score'] += 30
            
            elif ecosystem == 'npm':
                response = requests.get(f'{self.npm_api}/{package}', timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    
                    # 检查最后更新时间
                    health['last_update'] = data.get('time', {}).get('modified')
                    
                    # 检查维护者数量
                    health['maintainer_count'] = len(data.get('maintainers', []))
                    
                    # 下载量
                    health['download_count'] = data.get('downloads', {}).get('weekly', 0)
        
        except Exception as e:
            logging.info(f"{Colors.YELLOW}警告：检查包健康度失败 {package}: {e}{Colors.RESET}")
        
        return health
    
    def check_typosquatting(self, package: str, ecosystem: str) -> List[str]:
        """检查 typosquatting 风险（相似包名）"""
        risks = []
        
        # 常见 typosquatting 模式
        patterns = [
            package.replace('-', ''),  # 移除连字符
            package.replace('-', '_'),  # 连字符变下划线
            package + 'js',  # 添加后缀
            package + 'lib',
            package + 'official',
        ]
        
        # 检查这些包是否存在
        for pattern in patterns:
            if pattern == package:
                continue
            
            try:
                if ecosystem == 'PyPI':
                    response = requests.get(f'{self.pypi_api}/{pattern}/json', timeout=5)
                    if response.status_code == 200:
                        risks.append(f"相似包名：{pattern} (可能是 typosquatting)")
                elif ecosystem == 'npm':
                    response = requests.get(f'{self.npm_api}/{pattern}', timeout=5)
                    if response.status_code == 200:
                        risks.append(f"相似包名：{pattern} (可能是 typosquatting)")
            except Exception as e:
                pass
        
        return risks
    
    def scan_requirements(self, file_path: str) -> Dict:
        """扫描 Python requirements.txt"""
        logging.info(f"\n{Colors.CYAN}扫描 {file_path}{Colors.RESET}")
        
        dependencies = self.parse_requirements(file_path)
        results = {
            'file': file_path,
            'ecosystem': 'PyPI',
            'total_packages': len(dependencies),
            'vulnerable_packages': [],
            'abandoned_packages': [],
            'typosquatting_risks': [],
            'scan_time': datetime.now().isoformat()
        }
        
        for dep in dependencies:
            logging.info(f"  检查：{dep['name']}@{dep['version']}")
            
            # 检查漏洞
            vulns = self.check_vulnerabilities(dep['name'], dep['version'], dep['ecosystem'])
            if vulns:
                results['vulnerable_packages'].append({
                    'name': dep['name'],
                    'version': dep['version'],
                    'vulnerabilities': vulns
                })
                logging.info(f"    {Colors.RED}✗ 发现 {len(vulns)} 个漏洞{Colors.RESET}")
            
            # 检查健康度
            health = self.check_package_health(dep['name'], dep['ecosystem'])
            if health['is_abandoned']:
                results['abandoned_packages'].append({
                    'name': dep['name'],
                    'last_update': health['last_update']
                })
                logging.info(f"    {Colors.YELLOW}⚠ 可能已废弃{Colors.RESET}")
            
            # 检查 typosquatting
            risks = self.check_typosquatting(dep['name'], dep['ecosystem'])
            if risks:
                results['typosquatting_risks'].extend([
                    {'package': dep['name'], 'risk': risk}
                    for risk in risks
                ])
        
        self.results.append(results)
        return results
    
    def scan_package_json(self, file_path: str) -> Dict:
        """扫描 Node.js package.json"""
        logging.info(f"\n{Colors.CYAN}扫描 {file_path}{Colors.RESET}")
        
        dependencies = self.parse_package_json(file_path)
        results = {
            'file': file_path,
            'ecosystem': 'npm',
            'total_packages': len(dependencies),
            'vulnerable_packages': [],
            'abandoned_packages': [],
            'typosquatting_risks': [],
            'scan_time': datetime.now().isoformat()
        }
        
        for dep in dependencies:
            logging.info(f"  检查：{dep['name']}@{dep['version']}")
            
            # 检查漏洞
            vulns = self.check_vulnerabilities(dep['name'], dep['version'], dep['ecosystem'])
            if vulns:
                results['vulnerable_packages'].append({
                    'name': dep['name'],
                    'version': dep['version'],
                    'vulnerabilities': vulns
                })
                logging.info(f"    {Colors.RED}✗ 发现 {len(vulns)} 个漏洞{Colors.RESET}")
            
            # 检查健康度
            health = self.check_package_health(dep['name'], dep['ecosystem'])
            if health['is_abandoned']:
                results['abandoned_packages'].append({
                    'name': dep['name'],
                    'last_update': health['last_update']
                })
                logging.info(f"    {Colors.YELLOW}⚠ 可能已废弃{Colors.RESET}")
        
        self.results.append(results)
        return results
    
    def scan_directory(self, directory: str) -> List[Dict]:
        """扫描目录中的所有依赖文件"""
        all_results = []
        
        # 查找依赖文件
        patterns = ['requirements.txt', 'package.json', 'Cargo.toml']
        
        for pattern in patterns:
            for file_path in Path(directory).rglob(pattern):
                if file_path.is_file():
                    if pattern == 'requirements.txt':
                        result = self.scan_requirements(str(file_path))
                    elif pattern == 'package.json':
                        result = self.scan_package_json(str(file_path))
                    elif pattern == 'Cargo.toml':
                        # Rust 支持待实现
                        logging.info(f"\n{Colors.YELLOW}跳过：{file_path} (Rust 支持待实现){Colors.RESET}")
                        continue
                    
                    all_results.append(result)
        
        return all_results
    
    def generate_report(self, output_file: str = None) -> str:
        """生成扫描报告"""
        report = []
        report.append("# 供应链安全扫描报告\n")
        report.append(f"**扫描时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        total_vulns = 0
        total_abandoned = 0
        total_typosquatting = 0
        
        for result in self.results:
            report.append(f"\n## 文件：{result['file']}\n")
            report.append(f"- 生态系统：{result['ecosystem']}")
            report.append(f"- 总包数：{result['total_packages']}")
            
            total_vulns += len(result['vulnerable_packages'])
            total_abandoned += len(result['abandoned_packages'])
            total_typosquatting += len(result['typosquatting_risks'])
            
            # 漏洞详情
            if result['vulnerable_packages']:
                report.append(f"\n### 🔴 漏洞包 ({len(result['vulnerable_packages'])})\n")
                for pkg in result['vulnerable_packages']:
                    report.append(f"\n#### {pkg['name']}@{pkg['version']}\n")
                    for vuln in pkg['vulnerabilities']:
                        report.append(f"- **{vuln['id']}**: {vuln['summary']}")
                        report.append(f"  - 严重性：{vuln['severity']}")
            
            # 废弃包
            if result['abandoned_packages']:
                report.append(f"\n### 🟡 可能废弃的包 ({len(result['abandoned_packages'])})\n")
                for pkg in result['abandoned_packages']:
                    report.append(f"- {pkg['name']} (最后更新：{pkg['last_update']})")
            
            # Typosquatting 风险
            if result['typosquatting_risks']:
                report.append(f"\n### 🟠 Typosquatting 风险 ({len(result['typosquatting_risks'])})\n")
                for risk in result['typosquatting_risks']:
                    report.append(f"- {risk['package']}: {risk['risk']}")
        
        # 总结
        report.append(f"\n## 📊 总结\n")
        report.append(f"- 🔴 漏洞包：{total_vulns}")
        report.append(f"- 🟡 废弃包：{total_abandoned}")
        report.append(f"- 🟠 Typosquatting 风险：{total_typosquatting}")
        
        report_content = '\n'.join(report)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(report_content)
            logging.info(f"\n{Colors.GREEN}报告已保存到：{output_file}{Colors.RESET}")
        
        return report_content


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='供应链安全检查工具')
    parser.add_argument('path', nargs='?', default='.',
                       help='要扫描的文件或目录')
    parser.add_argument('-o', '--output',
                       help='输出报告文件')
    parser.add_argument('--type', choices=['file', 'dir'], default='auto',
                       help='扫描类型')
    
    args = parser.parse_args()
    
    scanner = SupplyChainScanner()
    path = Path(args.path)
    
    logging.info(f"\n{Colors.BOLD}{Colors.CYAN}供应链安全检查{Colors.RESET}")
    logging.info(f"{'='*60}")
    logging.info(f"扫描目标：{path.absolute()}")
    logging.info(f"{'='*60}\n")
    
    if path.is_file() or args.type == 'file':
        # 扫描单个文件
        filename = path.name
        if filename == 'requirements.txt':
            scanner.scan_requirements(str(path))
        elif filename == 'package.json':
            scanner.scan_package_json(str(path))
        else:
            logging.info(f"{Colors.RED}错误：不支持的文件类型{Colors.RESET}")
            return
    else:
        # 扫描目录
        scanner.scan_directory(str(path))
    
    # 生成报告
    if scanner.results:
        report = scanner.generate_report(args.output)
        logging.info(f"\n{report}")
    else:
        logging.info(f"\n{Colors.YELLOW}未找到依赖文件{Colors.RESET}")


if __name__ == '__main__':
    main()
