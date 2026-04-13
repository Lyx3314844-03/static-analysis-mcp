#!/usr/bin/env python3
"""
团队代码质量仪表板
可视化团队代码质量、个人贡献、问题趋势等
"""

from flask import Flask, render_template, jsonify
from flask_cors import CORS
from pathlib import Path
import json
from datetime import datetime, timedelta
from typing import Dict, List


app = Flask(__name__)
CORS(app)


class TeamDashboard:
    """团队仪表板数据管理器"""
    
    def __init__(self, project_root: str):
        """
        初始化仪表板
        
        Args:
            project_root: 项目根目录
        """
        self.project_root = Path(project_root)
        self.data_file = self.project_root / '.quality_data.json'
        self.data = self._load_data()
    
    def _load_data(self) -> Dict:
        """加载数据"""
        if self.data_file.exists():
            with open(self.data_file, 'r') as f:
                return json.load(f)
        
        return {
            'team_members': {},
            'daily_metrics': [],
            'issues_history': [],
            'quality_scores': {}
        }
    
    def update_member_stats(self, author: str, issues: List[Dict]):
        """更新成员统计"""
        if author not in self.data['team_members']:
            self.data['team_members'][author] = {
                'total_commits': 0,
                'total_issues': 0,
                'fixed_issues': 0,
                'quality_score': 100
            }
        
        member = self.data['team_members'][author]
        member['total_commits'] += 1
        member['total_issues'] += len(issues)
        
        # 计算质量分数
        member['quality_score'] = max(0, 100 - len(issues) * 5)
        
        self._save_data()
    
    def get_team_overview(self) -> Dict:
        """获取团队概览"""
        members = self.data['team_members']
        
        if not members:
            return {
                'total_members': 0,
                'average_quality_score': 0,
                'total_issues': 0,
                'top_contributors': []
            }
        
        total_members = len(members)
        avg_quality = sum(m['quality_score'] for m in members.values()) / total_members
        total_issues = sum(m['total_issues'] for m in members.values())
        
        # 排名
        top_contributors = sorted(
            [(name, data) for name, data in members.items()],
            key=lambda x: x[1]['quality_score'],
            reverse=True
        )[:5]
        
        return {
            'total_members': total_members,
            'average_quality_score': round(avg_quality, 1),
            'total_issues': total_issues,
            'top_contributors': [
                {
                    'name': name,
                    'quality_score': data['quality_score'],
                    'total_commits': data['total_commits']
                }
                for name, data in top_contributors
            ]
        }
    
    def get_quality_trend(self, days: int = 30) -> List[Dict]:
        """获取质量趋势"""
        trend = []
        now = datetime.now()
        
        for i in range(days):
            date = now - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            
            # 模拟数据
            trend.append({
                'date': date_str,
                'quality_score': 85 + (i % 10),
                'issues_fixed': 5 + (i % 3),
                'new_issues': 3 + (i % 5)
            })
        
        return list(reversed(trend))
    
    def _save_data(self):
        """保存数据"""
        with open(self.data_file, 'w') as f:
            json.dump(self.data, f, indent=2)


# 初始化仪表板
dashboard = TeamDashboard('.')


@app.route('/')
def index():
    """仪表板首页"""
    return render_template('dashboard.html')


@app.route('/api/team-overview')
def team_overview():
    """团队概览"""
    return jsonify(dashboard.get_team_overview())


@app.route('/api/quality-trend')
def quality_trend():
    """质量趋势"""
    days = request.args.get('days', 30, type=int)
    return jsonify(dashboard.get_quality_trend(days))


@app.route('/api/member/<member_id>')
def member_stats(member_id):
    """成员统计"""
    member = dashboard.data['team_members'].get(member_id)
    if not member:
        return jsonify({'error': 'Member not found'}), 404
    return jsonify(member)


@app.route('/api/members')
def members_list():
    """成员列表"""
    return jsonify(list(dashboard.data['team_members'].keys()))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
