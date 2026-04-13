"""
数据库连接池配置
"""
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
import os

# 数据库 URL
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://user:password@localhost:5432/static_analysis'
)

# 创建引擎
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,  # 连接池大小
    max_overflow=40,  # 最大溢出连接数
    pool_timeout=30,  # 获取连接超时 (秒)
    pool_recycle=1800,  # 连接回收时间 (秒)
    pool_pre_ping=True,  # 连接前检查
    echo=False,  # SQL 日志
    connect_args={
        'connect_timeout': 10,
        'options': '-c statement_timeout=60000'  # 语句超时 60 秒
    },
    # 生产环境优化
    server_side_cursors=True,
    execution_options={
        'stream_results': True,
        'max_row_buffer': 1000
    }
)

# 创建会话工厂
SessionFactory = sessionmaker(bind=engine)

# 创建线程安全会话
Session = scoped_session(SessionFactory)

# 基础模型类
Base = declarative_base()

# 数据库初始化
def init_db():
    """初始化数据库"""
    Base.metadata.create_all(bind=engine)

# 获取数据库会话
def get_db():
    """获取数据库会话"""
    db = Session()
    try:
        yield db
    finally:
        db.close()

# 健康检查
def check_db_health():
    """检查数据库健康状态"""
    try:
        conn = engine.connect()
        conn.execute("SELECT 1")
        conn.close()
        return True
    except Exception:
        return False

# 连接池统计
def get_pool_stats():
    """获取连接池统计信息"""
    pool = engine.pool
    return {
        'pool_size': pool.size(),
        'checked_in': pool.checkedin(),
        'checked_out': pool.checkedout(),
        'overflow': pool.overflow(),
        'invalid': pool.invalidatedcount() if hasattr(pool, 'invalidatedcount') else 0
    }
