import logging

"""
Gunicorn 生产环境配置文件
"""
import multiprocessing
import os

# 服务器套接字
bind = '0.0.0.0:8000'

# 工作进程数
workers = multiprocessing.cpu_count() * 2 + 1

# 工作线程数 (gthread 模式)
threads = 2

# 工作进程类
worker_class = 'gthread'

# 超时配置
timeout = 120
keepalive = 5

# 工作进程连接数
worker_connections = 1000

# 最大请求数 (防止内存泄漏)
max_requests = 1000
max_requests_jitter = 50

# 进程命名
proc_name = 'static-analysis-mcp'

# 守护进程
daemon = False

# PID 文件
pidfile = '/tmp/gunicorn.pid'

# 用户和组
user = 'appuser'
group = 'appuser'

# 日志配置
accesslog = '-'
errorlog = '-'
loglevel = 'info'

# 临时目录
tmp_upload_dir = '/tmp'

# 进程管理
def on_starting(server):
    """服务器启动前"""
    logging.info("=" * 60)
    logging.info("Starting Static Analysis MCP Server")
    logging.info("=" * 60)

def on_reload(server):
    """服务器重载时"""
    logging.info("Server reloading...")

def when_ready(server):
    """服务器就绪时"""
    logging.info("Server is ready to accept connections")

def pre_fork(server, worker):
    """工作进程 fork 前"""
    logging.info(f"About to fork worker")

def post_fork(server, worker):
    """工作进程 fork 后"""
    logging.info(f"Worker {worker.pid} started")

def post_worker_init(worker):
    """工作进程初始化后"""
    logging.info(f"Worker {worker.pid} initialized")

def worker_int(worker):
    """工作进程收到 INT 信号"""
    logging.info(f"Worker {worker.pid} received INT signal")

def worker_abort(worker):
    """工作进程收到 ABORT 信号"""
    logging.info(f"Worker {worker.pid} received ABORT signal")

def pre_exec(server):
    """服务器执行新进程前"""
    logging.info("About to execute new process")

def child_exit(server, worker):
    """子进程退出时"""
    logging.info(f"Worker {worker.pid} exited")

def on_exit(server):
    """服务器退出时"""
    logging.info("Server shutting down")
