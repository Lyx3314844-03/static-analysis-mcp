"""
JWT 认证中间件
"""
from functools import wraps
from flask import request, jsonify, current_app
import jwt
import os
from datetime import datetime, timedelta
import hashlib


def generate_token(user_id: str, email: str, role: str = 'user') -> str:
    """生成 JWT Token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=int(os.getenv('JWT_EXPIRATION', 3600))),
        'iat': datetime.utcnow(),
        'jti': hashlib.md5(f"{user_id}{datetime.utcnow()}".encode()).hexdigest()
    }
    
    token = jwt.encode(
        payload,
        os.getenv('JWT_SECRET'),
        algorithm=os.getenv('JWT_ALGORITHM', 'HS256')
    )
    
    return token


def verify_token(token: str) -> dict:
    """验证 JWT Token"""
    try:
        payload = jwt.decode(
            token,
            os.getenv('JWT_SECRET'),
            algorithms=[os.getenv('JWT_ALGORITHM', 'HS256')]
        )
        return {'valid': True, 'payload': payload}
    except jwt.ExpiredSignatureError:
        return {'valid': False, 'error': 'Token expired'}
    except jwt.InvalidTokenError:
        return {'valid': False, 'error': 'Invalid token'}


def require_auth(f):
    """需要认证的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Authorization header missing'}), 401
        
        try:
            scheme, token = auth_header.split()
            if scheme.lower() != 'bearer':
                return jsonify({'error': 'Invalid authorization scheme'}), 401
        except ValueError:
            return jsonify({'error': 'Invalid authorization header format'}), 401
        
        result = verify_token(token)
        
        if not result['valid']:
            return jsonify({'error': result['error']}), 401
        
        request.user = result['payload']
        return f(*args, **kwargs)
    
    return decorated_function


def require_role(required_role: str):
    """需要特定角色的装饰器"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(request, 'user') or request.user.get('role') != required_role:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def optional_auth(f):
    """可选认证的装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if auth_header:
            try:
                scheme, token = auth_header.split()
                result = verify_token(token)
                if result['valid']:
                    request.user = result['payload']
            except ValueError:
                pass
        
        return f(*args, **kwargs)
    
    return decorated_function
