"""
速率限制配置
"""
from functools import wraps
from flask import request, jsonify, g
import time
from collections import defaultdict
import threading


class RateLimiter:
    """速率限制器"""
    
    def __init__(self):
        self.requests = defaultdict(list)
        self.lock = threading.Lock()
    
    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        """检查请求是否允许"""
        now = time.time()
        window_start = now - window_seconds
        
        with self.lock:
            # 清理过期请求
            self.requests[key] = [
                timestamp for timestamp in self.requests[key]
                if timestamp > window_start
            ]
            
            # 检查是否超过限制
            if len(self.requests[key]) >= max_requests:
                return False
            
            # 记录当前请求
            self.requests[key].append(now)
            return True
    
    def get_remaining(self, key: str, max_requests: int, window_seconds: int) -> int:
        """获取剩余请求数"""
        now = time.time()
        window_start = now - window_seconds
        
        with self.lock:
            current_requests = len([
                timestamp for timestamp in self.requests[key]
                if timestamp > window_start
            ])
            return max(0, max_requests - current_requests)


# 全局速率限制器
rate_limiter = RateLimiter()


def rate_limit(max_requests: int = 100, window_seconds: int = 60):
    """
    速率限制装饰器
    
    Args:
        max_requests: 最大请求数
        window_seconds: 时间窗口 (秒)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 获取客户端标识
            client_id = request.headers.get('X-Forwarded-For', request.remote_addr)
            key = f"{request.endpoint}:{client_id}"
            
            if not rate_limiter.is_allowed(key, max_requests, window_seconds):
                remaining = rate_limiter.get_remaining(key, max_requests, window_seconds)
                
                response = jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': window_seconds
                })
                response.status_code = 429
                response.headers['X-RateLimit-Limit'] = str(max_requests)
                response.headers['X-RateLimit-Remaining'] = str(remaining)
                response.headers['Retry-After'] = str(window_seconds)
                return response
            
            # 执行请求
            response = f(*args, **kwargs)
            
            # 添加速率限制头
            remaining = rate_limiter.get_remaining(key, max_requests, window_seconds)
            if hasattr(response, 'headers'):
                response.headers['X-RateLimit-Limit'] = str(max_requests)
                response.headers['X-RateLimit-Remaining'] = str(remaining)
            
            return response
        
        return decorated_function
    return decorator


def strict_rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """严格速率限制 (用于敏感操作)"""
    return rate_limit(max_requests, window_seconds)


def api_rate_limit(max_requests: int = 1000, window_seconds: int = 60):
    """API 速率限制"""
    return rate_limit(max_requests, window_seconds)
