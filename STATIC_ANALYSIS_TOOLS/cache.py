"""
Redis 缓存优化配置
"""
import redis
import json
from functools import wraps
import hashlib
import logging
from typing import Any, Optional, Callable
import os

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis 客户端封装"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        self.client = self._create_client()
    
    def _create_client(self) -> redis.Redis:
        """创建 Redis 客户端"""
        return redis.from_url(
            self.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            max_connections=50,
            health_check_interval=30
        )
    
    def get(self, key: str) -> Optional[Any]:
        """获取缓存"""
        try:
            value = self.client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """设置缓存"""
        try:
            serialized = json.dumps(value, ensure_ascii=False)
            return self.client.setex(key, ttl, serialized)
        except Exception as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    def delete(self, *keys: str) -> int:
        """删除缓存"""
        try:
            return self.client.delete(*keys)
        except Exception as e:
            logger.error(f"Redis delete error: {e}")
            return 0
    
    def exists(self, *keys: str) -> int:
        """检查键是否存在"""
        try:
            return self.client.exists(*keys)
        except Exception as e:
            logger.error(f"Redis exists error: {e}")
            return 0
    
    def invalidate_pattern(self, pattern: str) -> int:
        """批量失效缓存"""
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Redis invalidate_pattern error: {e}")
            return 0
    
    def get_stats(self) -> dict:
        """获取 Redis 统计信息"""
        try:
            info = self.client.info('stats')
            return {
                'total_connections_received': info.get('total_connections_received', 0),
                'total_commands_processed': info.get('total_commands_processed', 0),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'hit_rate': info.get('keyspace_hits', 0) / max(
                    info.get('keyspace_hits', 0) + info.get('keyspace_misses', 1), 1
                )
            }
        except Exception as e:
            logger.error(f"Redis get_stats error: {e}")
            return {}
    
    def ping(self) -> bool:
        """健康检查"""
        try:
            return self.client.ping()
        except Exception:
            return False


class CacheManager:
    """缓存管理器"""
    
    def __init__(self, redis_client: RedisClient = None):
        self.client = redis_client or RedisClient()
    
    def cache_result(self, ttl: int = 3600, prefix: str = 'cache'):
        """
        缓存装饰器
        
        Args:
            ttl: 缓存过期时间 (秒)
            prefix: 缓存键前缀
        """
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                # 生成缓存键
                cache_key = self._generate_key(func.__name__, args, kwargs, prefix)
                
                # 尝试从缓存获取
                try:
                    cached = self.client.get(cache_key)
                    if cached is not None:
                        logger.debug(f"Cache hit: {cache_key}")
                        return cached
                except Exception as e:
                    logger.error(f"Cache get error: {e}")
                
                # 执行函数
                logger.debug(f"Cache miss: {cache_key}, executing function")
                result = func(*args, **kwargs)
                
                # 存入缓存
                try:
                    if result is not None:
                        self.client.set(cache_key, result, ttl)
                except Exception as e:
                    logger.error(f"Cache set error: {e}")
                
                return result
            return wrapper
        return decorator
    
    def _generate_key(self, func_name: str, args: tuple, kwargs: dict, prefix: str) -> str:
        """生成缓存键"""
        key_data = f"{prefix}:{func_name}:{str(args)}:{str(kwargs)}"
        key_hash = hashlib.md5(key_data.encode()).hexdigest()
        return f"{prefix}:{func_name}:{key_hash}"
    
    def warm_up(self, func: Callable, *args, **kwargs):
        """缓存预热"""
        cache_key = self._generate_key(func.__name__, args, kwargs, 'warmup')
        result = func(*args, **kwargs)
        self.client.set(cache_key, result, 3600)
        logger.info(f"Cache warmed up: {cache_key}")


# 全局缓存客户端
cache_manager = CacheManager()
