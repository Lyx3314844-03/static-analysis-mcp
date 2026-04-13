"""
安全响应头中间件
"""
from flask import make_response
from functools import wraps
import os


def add_security_headers(f):
    """添加安全响应头的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        response = make_response(f(*args, **kwargs))
        
        # HSTS - 强制 HTTPS
        response.headers['Strict-Transport-Security'] = (
            'max-age=31536000; includeSubDomains; preload'
        )
        
        # 防止点击劫持
        response.headers['X-Frame-Options'] = 'DENY'
        
        # 防止 MIME 类型嗅探
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # XSS 防护
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # 内容安全策略
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )
        
        # Referrer 策略
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # 权限策略
        response.headers['Permissions-Policy'] = (
            'geolocation=(), microphone=(), camera=(), payment=(), usb=()'
        )
        
        # 缓存控制 (敏感数据)
        if request.endpoint in ['login', 'register', 'profile']:
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        
        return response
    
    return decorated_function


def add_cors_headers(allowed_origins: list = None):
    """添加 CORS 响应头"""
    if allowed_origins is None:
        allowed_origins = [os.getenv('CORS_ORIGINS', '*')]
    
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            response = make_response(f(*args, **kwargs))
            
            origin = request.headers.get('Origin', '*')
            
            if '*' in allowed_origins or origin in allowed_origins:
                response.headers['Access-Control-Allow-Origin'] = origin
            
            response.headers['Access-Control-Allow-Headers'] = (
                'Content-Type,Authorization,X-Requested-With'
            )
            response.headers['Access-Control-Allow-Methods'] = (
                'GET,PUT,POST,DELETE,PATCH,OPTIONS'
            )
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Max-Age'] = '86400'
            
            # 处理预检请求
            if request.method == 'OPTIONS':
                return make_response('', 204)
            
            return response
        
        return decorated_function
    return decorator


def add_custom_headers(headers: dict):
    """添加自定义响应头"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            response = make_response(f(*args, **kwargs))
            for key, value in headers.items():
                response.headers[key] = value
            return response
        return decorated_function
    return decorator
