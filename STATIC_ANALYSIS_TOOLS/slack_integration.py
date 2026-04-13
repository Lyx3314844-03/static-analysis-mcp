import logging

#!/usr/bin/env python3
"""
Slack 通知集成
将代码质量问题、安全告警等推送到 Slack 频道
"""

import os
import json
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from typing import List, Dict
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Alert:
    """告警信息"""
    title: str
    message: str
    severity: str  # critical, warning, info
    file: str
    line: int
    fix_suggestion: str


class SlackNotifier:
    """Slack 通知器"""
    
    def __init__(self, bot_token: str, channel: str):
        """
        初始化 Slack 通知器
        
        Args:
            bot_token: Slack Bot Token
            channel: 频道名称
        """
        self.client = WebClient(token=bot_token)
        self.channel = channel
    
    def send_alert(self, alert: Alert):
        """发送告警"""
        color_map = {
            'critical': 'danger',
            'warning': 'warning',
            'info': 'good'
        }
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{'🔴' if alert.severity == 'critical' else '🟡' if alert.severity == 'warning' else '🔵'} {alert.title}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*文件:*\n{alert.file}:{alert.line}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*严重性:*\n{alert.severity.upper()}"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*问题:*\n{alert.message}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*💡 修复建议:*\n```\n{alert.fix_suggestion}\n```"
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "🔍 查看详情"
                        },
                        "url": f"vscode://file/{alert.file}:{alert.line}",
                        "action_id": "view_detail"
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "✨ 一键修复"
                        },
                        "value": "fix_now",
                        "action_id": "fix_now"
                    }
                ]
            }
        ]
        
        try:
            self.client.chat_postMessage(
                channel=self.channel,
                blocks=blocks,
                username="Static Analysis MCP"
            )
            logging.info(f"✅ Slack 通知已发送：{alert.title}")
        except SlackApiError as e:
            logging.info(f"❌ Slack 发送失败：{e.response['error']}")
    
    def send_daily_report(self, stats: Dict):
        """发送日报"""
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📊 Static Analysis MCP 日报"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*日期:* {datetime.now().strftime('%Y-%m-%d')}"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*📁 扫描文件:*\n{stats.get('files_scanned', 0)}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*🔍 发现问题:*\n{stats.get('issues_found', 0)}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*✨ 已修复:*\n{stats.get('fixed', 0)}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*⏱️ 节省时间:*\n{stats.get('time_saved', 0)} 分钟"
                    }
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*📈 质量趋势:*\n代码质量评分：{stats.get('quality_score', 0)}/100"
                }
            }
        ]
        
        try:
            self.client.chat_postMessage(
                channel=self.channel,
                blocks=blocks,
                username="Static Analysis MCP"
            )
            logging.info("✅ Slack 日报已发送")
        except SlackApiError as e:
            logging.info(f"❌ Slack 发送失败：{e.response['error']}")


def main():
    """示例用法"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Slack 通知集成')
    parser.add_argument('--token', type=str, required=True, help='Slack Bot Token')
    parser.add_argument('--channel', type=str, default='#code-quality', help='频道名称')
    parser.add_argument('--type', choices=['alert', 'report'], default='alert', help='通知类型')
    
    args = parser.parse_args()
    
    notifier = SlackNotifier(args.token, args.channel)
    
    if args.type == 'alert':
        # 发送测试告警
        alert = Alert(
            title="发现 SQL 注入风险",
            message="使用 f-string 构建 SQL 查询可能导致 SQL 注入",
            severity="critical",
            file="src/auth.py",
            line=15,
            fix_suggestion='cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))'
        )
        notifier.send_alert(alert)
    
    elif args.type == 'report':
        # 发送日报
        stats = {
            'files_scanned': 150,
            'issues_found': 45,
            'fixed': 38,
            'time_saved': 76,
            'quality_score': 87
        }
        notifier.send_daily_report(stats)


if __name__ == '__main__':
    main()
