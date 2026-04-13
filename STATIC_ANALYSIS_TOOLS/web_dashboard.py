import logging

#!/usr/bin/env python3
"""
Static Analysis Web Dashboard
基于 Flask 的 Web 仪表盘，用于可视化静态分析结果
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
import plotly.graph_objects as go
import plotly.express as px
from plotly.utils import PlotlyJSONEncoder
import pandas as pd

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent))

# 尝试导入 baseline_manager，如果失败则使用占位类
try:
    from baseline_manager import BaselineManager
except ImportError:
    class BaselineManager:
        def __init__(self, *args, **kwargs):
            pass


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


app = Flask(__name__, 
            template_folder='dashboard_templates',
            static_folder='dashboard_static')
CORS(app)

# 配置
app.config['DATA_DIR'] = './analysis_data'
app.config['BASELINE_DIR'] = './.baselines'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

# 确保目录存在
Path(app.config['DATA_DIR']).mkdir(exist_ok=True)
Path(app.config['BASELINE_DIR']).mkdir(exist_ok=True)


# ==================== 数据加载函数 ====================

def load_analysis_results(filename: str = None) -> list:
    """加载分析结果"""
    data_dir = Path(app.config['DATA_DIR'])
    
    if filename:
        file_path = data_dir / filename
        if file_path.exists():
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    
    # 加载所有结果文件
    all_results = []
    for file in data_dir.glob('*.json'):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict):
                    data['source_file'] = file.name
                    all_results.append(data)
                elif isinstance(data, list):
                    for item in data:
                        item['source_file'] = file.name
                        all_results.append(item)
        except Exception as e:
            logging.info(f"{Colors.YELLOW}警告：加载文件失败 {file}: {e}{Colors.RESET}")
    
    return all_results


def load_baselines() -> list:
    """加载所有基线"""
    baseline_dir = Path(app.config['BASELINE_DIR'])
    baselines = []
    
    for file in baseline_dir.glob('*.json'):
        try:
            with open(file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                data['source_file'] = file.name
                baselines.append(data)
        except Exception as e:
            logging.info(f"{Colors.YELLOW}警告：加载基线失败 {file}: {e}{Colors.RESET}")
    
    return sorted(baselines, key=lambda x: x.get('created_at', ''), reverse=True)


def get_statistics(results: list) -> dict:
    """计算统计数据"""
    stats = {
        'total_files': 0,
        'total_findings': 0,
        'by_severity': {},
        'by_category': {},
        'top_rules': {},
        'trend_data': []
    }
    
    for result in results:
        findings = result.get('findings', [])
        stats['total_findings'] += len(findings)
        
        # 按严重性统计
        for finding in findings:
            severity = finding.get('severity', 'WARNING')
            stats['by_severity'][severity] = stats['by_severity'].get(severity, 0) + 1
            
            # 按类别统计
            category = finding.get('category', 'security')
            stats['by_category'][category] = stats['by_category'].get(category, 0) + 1
            
            # 规则统计
            rule_id = finding.get('rule_id', 'unknown')
            stats['top_rules'][rule_id] = stats['top_rules'].get(rule_id, 0) + 1
    
    # 排序规则
    stats['top_rules'] = dict(
        sorted(stats['top_rules'].items(), key=lambda x: x[1], reverse=True)[:10]
    )
    
    return stats


# ==================== 路由 ====================

@app.route('/')
def index():
    """仪表盘首页"""
    return render_template('index.html')


@app.route('/api/summary')
def api_summary():
    """获取摘要数据"""
    results = load_analysis_results()
    stats = get_statistics(results)
    baselines = load_baselines()
    
    return jsonify({
        'total_analyses': len(results),
        'total_findings': stats['total_findings'],
        'by_severity': stats['by_severity'],
        'by_category': stats['by_category'],
        'top_rules': stats['top_rules'],
        'baselines_count': len(baselines),
        'latest_baseline': baselines[0] if baselines else None
    })


@app.route('/api/findings')
def api_findings():
    """获取问题列表"""
    results = load_analysis_results()
    all_findings = []
    
    for result in results:
        findings = result.get('findings', [])
        for finding in findings:
            finding['source_file'] = result.get('source_file', 'unknown')
            all_findings.append(finding)
    
    # 分页
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    severity = request.args.get('severity', None)
    
    # 过滤
    if severity:
        all_findings = [f for f in all_findings if f.get('severity') == severity]
    
    # 排序
    all_findings.sort(key=lambda x: x.get('line', 0))
    
    # 分页
    start = (page - 1) * per_page
    end = start + per_page
    
    return jsonify({
        'total': len(all_findings),
        'page': page,
        'per_page': per_page,
        'findings': all_findings[start:end]
    })


@app.route('/api/trend')
def api_trend():
    """获取趋势数据"""
    results = load_analysis_results()
    
    # 按日期分组
    trend_data = {}
    for result in results:
        date = result.get('timestamp', '')[:10]  # 提取日期部分
        if date:
            if date not in trend_data:
                trend_data[date] = {
                    'total': 0,
                    'error': 0,
                    'warning': 0,
                    'info': 0
                }
            
            findings = result.get('findings', [])
            trend_data[date]['total'] += len(findings)
            
            for finding in findings:
                severity = finding.get('severity', 'WARNING').lower()
                if severity in trend_data[date]:
                    trend_data[date][severity] += 1
    
    # 转换为列表并排序
    trend_list = [
        {
            'date': date,
            **data
        }
        for date, data in trend_data.items()
    ]
    trend_list.sort(key=lambda x: x['date'])
    
    return jsonify(trend_list)


@app.route('/api/baselines')
def api_baselines():
    """获取基线列表"""
    baselines = load_baselines()
    return jsonify(baselines)


@app.route('/api/compare/<baseline_name>')
def api_compare(baseline_name: str):
    """对比基线"""
    from baseline_manager import BaselineManager
    
    manager = BaselineManager(app.config['BASELINE_DIR'])
    baseline = manager.load_baseline(baseline_name)
    
    if not baseline:
        return jsonify({'error': 'Baseline not found'}), 404
    
    # 加载最新结果
    results = load_analysis_results()
    if not results:
        return jsonify({'error': 'No recent results'}), 404
    
    # 使用最新的结果
    latest = results[-1]
    current_findings = latest.get('findings', [])
    
    # 对比
    comparison = manager.compare_with_baseline(current_findings, baseline_name)
    
    return jsonify(comparison)


@app.route('/api/upload', methods=['POST'])
def api_upload():
    """上传分析结果"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.endswith('.json'):
        # 保存文件
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{file.filename}"
        file_path = Path(app.config['DATA_DIR']) / filename
        file.save(str(file_path))
        
        return jsonify({
            'success': True,
            'filename': filename,
            'message': 'File uploaded successfully'
        })
    
    return jsonify({'error': 'Invalid file type'}), 400


# ==================== 图表生成 ====================

@app.route('/api/chart/severity')
def chart_severity():
    """生成严重性分布图"""
    results = load_analysis_results()
    stats = get_statistics(results)
    
    fig = go.Figure(data=[
        go.Pie(
            labels=list(stats['by_severity'].keys()),
            values=list(stats['by_severity'].values()),
            hole=.3,
            marker_colors=['#EF5350', '#FFA726', '#42A5F5']
        )
    ])
    fig.update_layout(title_text='问题严重性分布')
    
    return jsonify(json.dumps(fig, cls=PlotlyJSONEncoder))


@app.route('/api/chart/trend')
def chart_trend():
    """生成趋势图"""
    trend_data = api_trend().get_json()
    
    if not trend_data:
        return jsonify({'error': 'No trend data'}), 404
    
    df = pd.DataFrame(trend_data)
    
    fig = px.line(
        df, 
        x='date', 
        y=['total', 'error', 'warning'],
        title='问题趋势分析',
        labels={'date': '日期', 'value': '数量'},
        color_discrete_sequence=['#666666', '#EF5350', '#FFA726']
    )
    fig.update_layout(xaxis_title='日期', yaxis_title='问题数量')
    
    return jsonify(json.dumps(fig, cls=PlotlyJSONEncoder))


@app.route('/api/chart/category')
def chart_category():
    """生成类别分布图"""
    results = load_analysis_results()
    stats = get_statistics(results)
    
    fig = go.Figure(data=[
        go.Bar(
            x=list(stats['by_category'].keys()),
            y=list(stats['by_category'].values()),
            marker_color='#42A5F5'
        )
    ])
    fig.update_layout(
        title_text='问题类别分布',
        xaxis_title='类别',
        yaxis_title='数量'
    )
    
    return jsonify(json.dumps(fig, cls=PlotlyJSONEncoder))


# ==================== 错误处理 ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


# ==================== 主函数 ====================

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Static Analysis Web Dashboard')
    parser.add_argument('--host', default='0.0.0.0', help='Host')
    parser.add_argument('--port', type=int, default=5000, help='Port')
    parser.add_argument('--debug', action='store_true', help='Debug mode')
    parser.add_argument('--data-dir', default='./analysis_data', help='Data directory')
    
    args = parser.parse_args()
    
    app.config['DATA_DIR'] = args.data_dir
    
    logging.info(f"\n{Colors.BOLD}{Colors.CYAN}Static Analysis Web Dashboard{Colors.RESET}")
    logging.info(f"{'='*50}")
    logging.info(f"数据目录：{args.data_dir}")
    logging.info(f"访问地址：http://{args.host}:{args.port}")
    logging.info(f"{'='*50}\n")
    
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == '__main__':
    main()
