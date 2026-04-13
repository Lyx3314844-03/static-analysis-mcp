@echo off
REM Static Analysis MCP 快速配置脚本

echo.
echo ================================================================================
echo   Static Analysis MCP 快速配置
echo ================================================================================
echo.

REM 1. 检查 Python
echo [1/4] 检查 Python 安装...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Python 未安装或未添加到 PATH
    echo   请安装 Python 3.8+ 并重启终端
    pause
    exit /b 1
)
echo   OK: Python 已安装
echo.

REM 2. 安装依赖
echo [2/4] 安装 Python 依赖...
pip install -r requirements.txt >nul 2>&1
if %errorlevel% neq 0 (
    echo   WARNING: 依赖安装可能有问题，请手动运行：pip install -r requirements.txt
) else (
    echo   OK: 依赖已安装
)
echo.

REM 3. 验证安装
echo [3/4] 验证安装...
python scripts\final_verification.py >nul 2>&1
if %errorlevel% neq 0 (
    echo   WARNING: 验证未完全通过，但基本功能可用
) else (
    echo   OK: 验证通过
)
echo.

REM 4. 配置 Qwen CLI
echo [4/4] 配置 Qwen CLI...
echo.
echo   请选择配置方式:
echo.
echo   1. 直接使用 Python 脚本（推荐）
echo   2. 配置 MCP 服务器
echo   3. 跳过配置
echo.
set /p choice="请输入选择 (1-3): "

if "%choice%"=="2" (
    echo.
    echo   正在配置 MCP 服务器...
    echo.
    
    REM 检查 .mcp.json 是否存在
    if not exist .mcp.json (
        echo   创建 .mcp.json...
        echo { > .mcp.json
        echo   "mcpServers": { >> .mcp.json
        echo     "static-analysis": { >> .mcp.json
        echo       "command": "python", >> .mcp.json
        echo       "args": ["%CD%/static-analysis-mcp/mcp_server.py"] >> .mcp.json
        echo     } >> .mcp.json
        echo   } >> .mcp.json
        echo } >> .mcp.json
        echo   OK: .mcp.json 已创建
    ) else (
        echo   INFO: .mcp.json 已存在
    )
    echo.
    echo   配置完成！在 Qwen CLI 中可以使用：
    echo   /static-analysis scan_project
    echo   /static-analysis auto_fix
    echo   等命令
) else if "%choice%"=="1" (
    echo.
    echo   好的！在 Qwen CLI 中直接使用：
    echo   !python STATIC_ANALYSIS_TOOLS\parallel_scanner.py .
    echo   等命令
)

echo.
echo ================================================================================
echo   配置完成！
echo ================================================================================
echo.
echo   快速开始:
echo.
echo   1. 代码安全扫描:
echo      !python STATIC_ANALYSIS_TOOLS\parallel_scanner.py . -w 8
echo.
echo   2. 自动修复代码:
echo      !python STATIC_ANALYSIS_TOOLS\batch_auto_fix.py --project . --apply
echo.
echo   3. 启动 Web 仪表盘:
echo      !python STATIC_ANALYSIS_TOOLS\web_dashboard.py --port 8080
echo.
echo   4. 验证安装:
echo      !python scripts\final_verification.py
echo.
echo   完整文档：QWEN_CLI_CONFIG.md
echo.
echo ================================================================================
echo.

pause
