/**
 * 安全工具模块
 * 提供路径验证、日志记录等安全相关功能
 */

import { resolve, relative } from 'path';
import { statSync, existsSync } from 'fs';
import { homedir } from 'os';

/**
 * 日志记录器
 */
export class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  log(level, message, metadata = {}) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...metadata,
    };

    const output = JSON.stringify(logEntry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  error(msg, meta = {}) { this.log('error', msg, meta); }
  warn(msg, meta = {}) { this.log('warn', msg, meta); }
  info(msg, meta = {}) { this.log('info', msg, meta); }
  debug(msg, meta = {}) { this.log('debug', msg, meta); }
}

export const logger = new Logger(process.env.LOG_LEVEL || 'info');

export function stripJsonComments(content) {
  let result = '';
  let inString = false;
  let stringChar = '';
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === '\\') {
        if (i + 1 < content.length) {
          result += content[i + 1];
          i++;
        }
        continue;
      }

      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      continue;
    }

    if (char === '"' || char === '\'' || char === '`') {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    result += char;
  }

  return result;
}

export function stripTrailingCommas(content) {
  return content.replace(/,\s*([}\]])/g, '$1');
}

export function parseJsonLike(content) {
  return JSON.parse(stripTrailingCommas(stripJsonComments(content)));
}

/**
 * 路径验证和沙箱化
 */
export class PathValidator {
  constructor(baseDir = process.cwd()) {
    this.baseDir = resolve(baseDir);
    this.allowedDirs = [
      this.baseDir,
      // 允许常见的项目目录
      resolve(this.baseDir, 'src'),
      resolve(this.baseDir, 'lib'),
      resolve(this.baseDir, 'test'),
      resolve(this.baseDir, 'tests'),
      resolve(this.baseDir, 'dist'),
      resolve(this.baseDir, 'build'),
    ];
  }

  /**
   * 验证文件路径是否安全
   * @throws {Error} 如果路径不安全
   */
  validateFilePath(filePath, options = {}) {
    const {
      allowSymlinks = false,
      allowDirectories = false,
      checkExists = true,
    } = options;

    if (typeof filePath !== 'string') {
      throw new Error('File path must be a string');
    }

    if (filePath.trim().length === 0) {
      throw new Error('File path cannot be empty');
    }

    // 解析绝对路径
    let absolutePath;
    try {
      absolutePath = resolve(filePath);
    } catch (error) {
      throw new Error(`Invalid file path: ${error.message}`);
    }

    // 检查路径遍历攻击
    const pathRelative = relative(this.baseDir, absolutePath);
    if (pathRelative.startsWith('..')) {
      throw new Error(`Access denied: path outside base directory (${this.baseDir})`);
    }

    // 检查是否在允许的目录内
    const isAllowed = this.allowedDirs.some(dir => {
      const rel = relative(dir, absolutePath);
      return !rel.startsWith('..');
    });

    if (!isAllowed) {
      throw new Error(`Access denied: path not in allowed directories`);
    }

    // 检查文件是否存在
    if (checkExists && !existsSync(absolutePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 检查文件属性
    if (checkExists) {
      try {
        const stats = statSync(absolutePath);

        // 检查符号链接
        if (!allowSymlinks && stats.isSymbolicLink()) {
          throw new Error('Access denied: symbolic links are not allowed');
        }

        // 检查是否为目录
        if (!allowDirectories && stats.isDirectory()) {
          throw new Error('Access denied: directories are not allowed, only files');
        }

        // 检查文件大小（防止大文件分析）
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        if (stats.size > MAX_FILE_SIZE) {
          throw new Error(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`);
        }
      } catch (error) {
        if (error.message.startsWith('Access denied:')) throw error;
        throw new Error(`Cannot access file: ${error.message}`);
      }
    }

    return absolutePath;
  }

  /**
   * 验证目录路径
   */
  validateDirectoryPath(dirPath, options = {}) {
    const {
      checkExists = true,
    } = options;

    if (typeof dirPath !== 'string') {
      throw new Error('Directory path must be a string');
    }

    if (dirPath.trim().length === 0) {
      throw new Error('Directory path cannot be empty');
    }

    // 解析绝对路径
    let absolutePath;
    try {
      absolutePath = resolve(dirPath);
    } catch (error) {
      throw new Error(`Invalid directory path: ${error.message}`);
    }

    // 检查路径遍历
    const pathRelative = relative(this.baseDir, absolutePath);
    if (pathRelative.startsWith('..')) {
      throw new Error(`Access denied: path outside base directory (${this.baseDir})`);
    }

    // 检查目录存在
    if (checkExists) {
      try {
        const stats = statSync(absolutePath);
        if (!stats.isDirectory()) {
          throw new Error('Path is not a directory');
        }
      } catch (error) {
        if (error.message === 'Path is not a directory') throw error;
        throw new Error(`Cannot access directory: ${error.message}`);
      }
    }

    return absolutePath;
  }

  /**
   * 添加允许的目录
   */
  addAllowedDirectory(dirPath) {
    const absolutePath = resolve(dirPath);
    if (!this.allowedDirs.includes(absolutePath)) {
      this.allowedDirs.push(absolutePath);
    }
  }
}

/**
 * 安全的 JSON 序列化
 * P2-2: 增强循环引用检测和 JSON 序列化错误处理
 */
export function safeJsonStringify(obj, maxDepth = 10) {
  const seen = new WeakSet();

  function sanitize(value, depth = 0) {
    if (depth > maxDepth) {
      return '[Depth Exceeded]';
    }

    if (value instanceof Error) {
      return {
        message: value.message,
        code: value.code || 'UNKNOWN',
        stack: process.env.NODE_ENV === 'development' ? value.stack : undefined,
      };
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value === undefined) {
      return '[undefined]';
    }

    if (typeof value === 'function') {
      return '[Function]';
    }

    if (typeof value === 'symbol') {
      return `[Symbol(${value.toString()})]`;
    }

    if (typeof value !== 'object' || value === null) {
      return value;
    }

    if (seen.has(value)) {
      return '[Circular Reference]';
    }

    seen.add(value);

    if (Array.isArray(value)) {
      return value.map(item => sanitize(item, depth + 1));
    }

    const result = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = sanitize(nestedValue, depth + 1);
    }
    return result;
  }

  try {
    return JSON.stringify(sanitize(obj), null, 2);
  } catch (error) {
    try {
      // 第一层回退：尝试序列化基本信息
      return JSON.stringify(
        {
          error: 'Cannot serialize result',
          reason: error.message,
          type: obj?.constructor?.name || typeof obj,
        },
        null,
        2
      );
    } catch (fallbackError) {
      // 最终回退：字符串表示
      return JSON.stringify({
        error: 'Fatal serialization error',
        reason: fallbackError.message,
        originalError: String(error),
      }, null, 2);
    }
  }
}

/**
 * 错误处理助手
 */
export class ErrorHandler {
  static formatError(error, options = {}) {
    const {
      includePath = true,
      includeStack = process.env.NODE_ENV === 'development',
    } = options;

    return {
      message: error.message || 'Unknown error',
      code: error.code || 'UNKNOWN',
      type: error.constructor.name,
      ...(includePath && error.filePath && { filePath: error.filePath }),
      ...(includeStack && error.stack && { stack: error.stack }),
    };
  }

  static createErrorResponse(error, statusCode = 'error') {
    return {
      content: [
        {
          type: 'text',
          text: safeJsonStringify({
            status: statusCode,
            error: this.formatError(error),
          }),
        },
      ],
    };
  }
}

/**
 * 缓存管理器
 */
export class CacheManager {
  constructor(config = {}) {
    this.cache = new Map();
    this.config = {
      ttl: config.ttl || 5 * 60 * 1000, // 5分钟
      maxSize: config.maxSize || 1000,
      version: config.version || 1,
      cleanupInterval: config.cleanupInterval || 1 * 60 * 1000, // 1分钟
    };

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };

    // 启动定期清理
    this.cleanupIntervalId = setInterval(() => this.cleanup(), this.config.cleanupInterval);
  }

  /**
   * 获取缓存键
   */
  getCacheKey(primaryKey, options = {}) {
    const optionsStr = Object.keys(options).length > 0 
      ? `:${JSON.stringify(options)}`
      : '';
    return `v${this.config.version}:${primaryKey}${optionsStr}`;
  }

  /**
   * 获取缓存值
   */
  get(key, options = {}) {
    const cacheKey = this.getCacheKey(key, options);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查 TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.cache.delete(cacheKey);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    entry.accessCount = (entry.accessCount || 0) + 1;
    entry.lastAccess = Date.now();
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key, value, options = {}) {
    const cacheKey = this.getCacheKey(key, options);

    this.cache.set(cacheKey, {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now(),
    });

    // 检查大小限制
    if (this.cache.size > this.config.maxSize) {
      this.evict();
    }
  }

  /**
   * 驱逐缓存项（LRU 策略）
   */
  evict() {
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cache cleanup: removed ${cleaned} expired entries`, {
        cacheSize: this.cache.size,
      });
    }
  }

  /**
   * 清空缓存
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared`, { removedEntries: size });
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * 销毁缓存管理器
   */
  destroy() {
    clearInterval(this.cleanupIntervalId);
    this.clear();
  }
}
