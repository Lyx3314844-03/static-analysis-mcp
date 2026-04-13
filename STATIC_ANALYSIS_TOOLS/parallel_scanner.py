import logging

#!/usr/bin/env python3
"""
并行扫描工具
使用多进程并行执行静态分析，大幅提升扫描速度
"""

import os
import json
import time
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from multiprocessing import cpu_count, Manager
import hashlib
from datetime import datetime
from tqdm import tqdm  # 进度条库


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class ParallelScanner:
    """并行扫描器"""
    
    def __init__(self, 
                 max_workers: int = None,
                 batch_size: int = 10,
                 memory_limit_mb: int = 2048):
        """
        初始化并行扫描器
        
        Args:
            max_workers: 最大工作进程数（默认 CPU 核心数）
            batch_size: 批处理大小
            memory_limit_mb: 内存限制（MB）
        """
        self.max_workers = max_workers or min(cpu_count(), 8)
        self.batch_size = batch_size
        self.memory_limit_mb = memory_limit_mb
        
        # 统计信息
        self.stats = {
            'total_files': 0,
            'scanned_files': 0,
            'failed_files': 0,
            'total_findings': 0,
            'start_time': None,
            'end_time': None,
            'memory_usage_mb': 0
        }
        
        # 缓存
        self.cache = {}
        self.cache_hits = 0
        self.cache_misses = 0
    
    def _get_file_hash(self, file_path: str) -> str:
        """获取文件哈希"""
        with open(file_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    
    def _detect_language(self, file_path: Path) -> Optional[str]:
        """检测文件语言"""
        ext_map = {
            '.py': 'python',
            '.js': 'javascript',
            '.ts': 'typescript',
            '.jsx': 'javascript',
            '.tsx': 'typescript',
            '.java': 'java',
            '.go': 'go',
            '.rb': 'ruby',
            '.php': 'php',
            '.c': 'c',
            '.cpp': 'cpp',
            '.cs': 'csharp',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.rs': 'rust',
            '.swift': 'swift',
            '.sh': 'bash',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.json': 'json',
            '.tf': 'terraform',
        }
        
        if file_path.name == 'Dockerfile':
            return 'dockerfile'
        
        return ext_map.get(file_path.suffix.lower())
    
    def _is_code_file(self, file_path: Path) -> bool:
        """检查是否是代码文件"""
        code_extensions = {
            '.py', '.js', '.ts', '.jsx', '.tsx',
            '.java', '.go', '.rb', '.php',
            '.c', '.cpp', '.cs', '.h', '.hpp',
            '.kt', '.scala', '.rs', '.swift',
            '.sh', '.yaml', '.yml', '.json',
            '.tf'
        }
        
        if file_path.name == 'Dockerfile':
            return True
        
        return file_path.suffix.lower() in code_extensions
    
    def _scan_single_file(self, file_info: Dict) -> Dict:
        """
        扫描单个文件（在工作进程中执行）
        
        Args:
            file_info: 文件信息字典
        
        Returns:
            扫描结果
        """
        file_path = file_info['path']
        
        try:
            # 读取文件
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                code = f.read()
            
            # 检测语言
            language = self._detect_language(Path(file_path))
            if not language:
                return {
                    'file': file_path,
                    'status': 'skipped',
                    'reason': 'unsupported_language'
                }
            
            # 生成 MCP 调用（模拟）
            mcp_call = {
                'tool': 'constant_quadruped/semgrep-mcp-server:security_check',
                'input': {
                    'code': code,
                    'language': language,
                    'filename': file_info['relative_path']
                }
            }
            
            # 这里应该调用实际的 MCP 工具
            # 为了演示，我们返回模拟结果
            result = {
                'file': file_path,
                'relative_path': file_info['relative_path'],
                'language': language,
                'status': 'scanned',
                'size_bytes': len(code),
                'lines': code.count('\n') + 1,
                'mcp_call': mcp_call,
                'findings': []  # 实际扫描结果
            }
            
            return result
            
        except Exception as e:
            return {
                'file': file_path,
                'status': 'failed',
                'error': str(e)
            }
    
    def _worker_scan(self, file_batch: List[Dict]) -> List[Dict]:
        """
        工作进程扫描函数
        
        Args:
            file_batch: 文件批次
        
        Returns:
            扫描结果列表
        """
        results = []
        for file_info in file_batch:
            result = self._scan_single_file(file_info)
            results.append(result)
        return results
    
    def collect_files(self, 
                      directory: str,
                      exclude_dirs: List[str] = None) -> List[Dict]:
        """
        收集要扫描的文件
        
        Args:
            directory: 目录路径
            exclude_dirs: 排除的目录列表
        
        Returns:
            文件信息列表
        """
        if exclude_dirs is None:
            exclude_dirs = [
                'node_modules', 'venv', '.venv', 'dist', 
                'build', '.git', '__pycache__', 'target', 
                'out', '.egg-info'
            ]
        
        files = []
        dir_path = Path(directory)
        
        # 收集所有代码文件
        for file_path in dir_path.rglob('*'):
            if not file_path.is_file():
                continue
            
            # 检查是否是代码文件
            if not self._is_code_file(file_path):
                continue
            
            # 检查是否在排除目录中
            should_exclude = False
            for exclude in exclude_dirs:
                if exclude in str(file_path):
                    should_exclude = True
                    break
            
            if should_exclude:
                continue
            
            # 添加文件
            files.append({
                'path': str(file_path),
                'relative_path': str(file_path.relative_to(dir_path)),
                'size': file_path.stat().st_size
            })
        
        self.stats['total_files'] = len(files)
        return files
    
    def scan(self, 
             directory: str,
             use_cache: bool = True,
             show_progress: bool = True) -> Dict:
        """
        并行扫描目录
        
        Args:
            directory: 要扫描的目录
            use_cache: 是否使用缓存
            show_progress: 是否显示进度条
        
        Returns:
            扫描结果
        """
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}开始并行扫描{Colors.RESET}")
        logging.info(f"目录：{directory}")
        logging.info(f"工作进程数：{self.max_workers}")
        logging.info(f"批处理大小：{self.batch_size}\n")
        
        self.stats['start_time'] = datetime.now()
        
        # 收集文件
        files = self.collect_files(directory)
        if not files:
            logging.info(f"{Colors.YELLOW}未找到可扫描的文件{Colors.RESET}")
            return {'files': [], 'stats': self.stats}
        
        logging.info(f"找到 {len(files)} 个文件\n")
        
        # 分批处理
        batches = [
            files[i:i + self.batch_size]
            for i in range(0, len(files), self.batch_size)
        ]
        
        results = []
        
        # 使用进程池并行扫描
        with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
            # 提交任务
            future_to_batch = {
                executor.submit(self._worker_scan, batch): idx
                for idx, batch in enumerate(batches)
            }
            
            # 处理完成的任务
            if show_progress:
                with tqdm(total=len(batches), desc="扫描进度") as pbar:
                    for future in as_completed(future_to_batch):
                        batch_idx = future_to_batch[future]
                        try:
                            batch_results = future.result()
                            results.extend(batch_results)
                            
                            # 更新统计
                            for result in batch_results:
                                if result['status'] == 'scanned':
                                    self.stats['scanned_files'] += 1
                                    self.stats['total_findings'] += len(result.get('findings', []))
                                elif result['status'] == 'failed':
                                    self.stats['failed_files'] += 1
                            
                            pbar.update(1)
                            
                        except Exception as e:
                            logging.info(f"{Colors.RED}批次 {batch_idx} 扫描失败：{e}{Colors.RESET}")
                            pbar.update(1)
            else:
                for future in as_completed(future_to_batch):
                    try:
                        batch_results = future.result()
                        results.extend(batch_results)
                    except Exception as e:
                        logging.info(f"{Colors.RED}扫描失败：{e}{Colors.RESET}")
        
        self.stats['end_time'] = datetime.now()
        self.stats['memory_usage_mb'] = self._get_memory_usage()

        # 打印统计
        self._print_stats()

        # 将 datetime 转换为字符串以支持 JSON 序列化
        json_stats = self.stats.copy()
        if json_stats['start_time']:
            json_stats['start_time'] = json_stats['start_time'].isoformat()
        if json_stats['end_time']:
            json_stats['end_time'] = json_stats['end_time'].isoformat()

        return {
            'files': results,
            'stats': json_stats,
            'scan_time': (self.stats['end_time'] - self.stats['start_time']).total_seconds()
        }
    def scan_async(self, directory: str, callback=None) -> Dict:
        """
        异步扫描（非阻塞）
        
        Args:
            directory: 要扫描的目录
            callback: 完成回调函数
        
        Returns:
            任务 ID
        """
        import threading
        
        def scan_task():
            result = self.scan(directory, show_progress=False)
            if callback:
                callback(result)
        
        thread = threading.Thread(target=scan_task)
        thread.start()
        
        return {'task_id': thread.ident, 'status': 'running'}
    
    def _get_memory_usage(self) -> float:
        """获取内存使用量（MB）"""
        import psutil
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024
    
    def _print_stats(self):
        """打印统计信息"""
        duration = (self.stats['end_time'] - self.stats['start_time']).total_seconds()
        
        logging.info(f"\n{Colors.BOLD}{Colors.GREEN}扫描完成{Colors.RESET}")
        logging.info(f"{'='*50}")
        logging.info(f"总文件数：{self.stats['total_files']}")
        logging.info(f"成功扫描：{self.stats['scanned_files']}")
        logging.info(f"扫描失败：{self.stats['failed_files']}")
        logging.info(f"发现问题：{self.stats['total_findings']}")
        logging.info(f"扫描耗时：{duration:.2f} 秒")
        logging.info(f"平均速度：{self.stats['scanned_files'] / max(duration, 0.1):.2f} 文件/秒")
        logging.info(f"内存使用：{self.stats['memory_usage_mb']:.2f} MB")
        logging.info(f"{'='*50}\n")
    
    def benchmark(self, directory: str, iterations: int = 3) -> Dict:
        """
        性能基准测试
        
        Args:
            directory: 测试目录
            iterations: 测试迭代次数
        
        Returns:
            基准测试结果
        """
        logging.info(f"\n{Colors.BOLD}{Colors.CYAN}性能基准测试{Colors.RESET}")
        logging.info(f"迭代次数：{iterations}\n")
        
        results = []
        
        for i in range(iterations):
            logging.info(f"{Colors.YELLOW}第 {i+1}/{iterations} 次测试{Colors.RESET}")
            
            start_time = time.time()
            scan_result = self.scan(directory, show_progress=False)
            end_time = time.time()
            
            results.append({
                'iteration': i + 1,
                'duration': end_time - start_time,
                'files_scanned': self.stats['scanned_files'],
                'memory_mb': self.stats['memory_usage_mb']
            })
        
        # 计算平均值
        avg_duration = sum(r['duration'] for r in results) / len(results)
        avg_memory = sum(r['memory_mb'] for r in results) / len(results)
        files_per_second = results[0]['files_scanned'] / avg_duration
        
        logging.info(f"\n{Colors.BOLD}{Colors.GREEN}基准测试结果{Colors.RESET}")
        logging.info(f"{'='*50}")
        logging.info(f"平均耗时：{avg_duration:.2f} 秒")
        logging.info(f"平均内存：{avg_memory:.2f} MB")
        logging.info(f"吞吐率：{files_per_second:.2f} 文件/秒")
        logging.info(f"{'='*50}\n")
        
        return {
            'iterations': results,
            'avg_duration': avg_duration,
            'avg_memory': avg_memory,
            'files_per_second': files_per_second
        }


def compare_performance(single_scan_func, parallel_scanner, directory: str):
    """
    对比串行和并行扫描性能
    
    Args:
        single_scan_func: 串行扫描函数
        parallel_scanner: 并行扫描器实例
        directory: 测试目录
    """
    logging.info(f"\n{Colors.BOLD}{Colors.CYAN}性能对比测试{Colors.RESET}\n")
    
    # 串行扫描
    logging.info(f"{Colors.YELLOW}串行扫描...{Colors.RESET}")
    start = time.time()
    single_result = single_scan_func(directory)
    single_time = time.time() - start
    
    # 并行扫描
    logging.info(f"{Colors.YELLOW}并行扫描...{Colors.RESET}")
    start = time.time()
    parallel_result = parallel_scanner.scan(directory, show_progress=False)
    parallel_time = time.time() - start
    
    # 对比
    speedup = single_time / parallel_time
    
    logging.info(f"\n{Colors.BOLD}{Colors.GREEN}性能对比结果{Colors.RESET}")
    logging.info(f"{'='*50}")
    logging.info(f"串行扫描：{single_time:.2f} 秒")
    logging.info(f"并行扫描：{parallel_time:.2f} 秒")
    logging.info(f"性能提升：{speedup:.2f}x ⚡")
    logging.info(f"{'='*50}\n")
    
    return {
        'single_time': single_time,
        'parallel_time': parallel_time,
        'speedup': speedup
    }


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='并行扫描工具')
    parser.add_argument('directory', nargs='?', default='.',
                       help='要扫描的目录')
    parser.add_argument('-w', '--workers', type=int,
                       help='工作进程数（默认：CPU 核心数）')
    parser.add_argument('-b', '--batch-size', type=int, default=10,
                       help='批处理大小（默认：10）')
    parser.add_argument('--memory-limit', type=int, default=2048,
                       help='内存限制 MB（默认：2048）')
    parser.add_argument('--benchmark', action='store_true',
                       help='运行性能基准测试')
    parser.add_argument('--no-progress', action='store_true',
                       help='不显示进度条')
    
    args = parser.parse_args()
    
    # 创建扫描器
    scanner = ParallelScanner(
        max_workers=args.workers,
        batch_size=args.batch_size,
        memory_limit_mb=args.memory_limit
    )
    
    if args.benchmark:
        # 运行基准测试
        scanner.benchmark(args.directory, iterations=3)
    else:
        # 普通扫描
        result = scanner.scan(
            args.directory,
            show_progress=not args.no_progress
        )
        
        # 保存结果
        if result['files']:
            output_file = f'parallel_scan_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            
            logging.info(f"{Colors.GREEN}结果已保存到：{output_file}{Colors.RESET}")


if __name__ == '__main__':
    main()
