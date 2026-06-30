@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 闲鱼自动回复系统 - 管理面板
set "COMPOSE=docker compose -f docker-compose.deploy.yml"

:menu
cls
echo ============================================================
echo            闲鱼自动回复系统  -  管理面板
echo ============================================================
echo.
echo    [1]  启动所有服务  (up -d)
echo    [2]  停止所有服务  (stop, 保留容器)
echo    [3]  重启所有服务  (restart)
echo    [4]  查看运行状态  (ps)
echo    [5]  查看实时日志 - 全部服务
echo    [6]  查看实时日志 - 单个服务
echo    [7]  更新镜像并重启 (pull + up -d)
echo    [8]  关闭并删除容器 (down, 保留数据卷)
echo    [9]  打开管理后台 (http://localhost:9000)
echo    [H]  健康检查 (各服务 /health)
echo    [0]  退出
echo.
echo ------------------------------------------------------------
set /p choice=请输入选项后回车: 

if /i "%choice%"=="1" goto start
if /i "%choice%"=="2" goto stop
if /i "%choice%"=="3" goto restart
if /i "%choice%"=="4" goto status
if /i "%choice%"=="5" goto logs_all
if /i "%choice%"=="6" goto logs_one
if /i "%choice%"=="7" goto update
if /i "%choice%"=="8" goto down
if /i "%choice%"=="9" goto open
if /i "%choice%"=="H" goto health
if /i "%choice%"=="0" exit
goto menu

:start
echo.
echo [启动中] 正在拉起所有容器...
%COMPOSE% up -d
echo.
echo [完成] 服务已启动。后台地址: http://localhost:9000
pause
goto menu

:stop
echo.
echo [停止中] 正在停止所有容器(数据保留)...
%COMPOSE% stop
echo.
echo [完成] 服务已停止。
pause
goto menu

:restart
echo.
echo [重启中] 正在重启所有容器...
%COMPOSE% restart
echo.
echo [完成] 服务已重启。
pause
goto menu

:status
echo.
%COMPOSE% ps
echo.
pause
goto menu

:logs_all
echo.
echo [实时日志-全部] 按 Ctrl+C 退出日志查看...
echo.
%COMPOSE% logs -f --tail=100
pause
goto menu

:logs_one
cls
echo ============================================================
echo    选择要查看日志的服务:
echo ------------------------------------------------------------
echo    [1] backend-web   后端主服务
echo    [2] websocket     消息服务
echo    [3] scheduler     定时任务
echo    [4] mysql         数据库
echo    [5] redis         缓存
echo    [6] frontend      前端
echo    [0] 返回上级菜单
echo ------------------------------------------------------------
set /p svc=请选择: 
if "%svc%"=="1" set "S=backend-web"
if "%svc%"=="2" set "S=websocket"
if "%svc%"=="3" set "S=scheduler"
if "%svc%"=="4" set "S=mysql"
if "%svc%"=="5" set "S=redis"
if "%svc%"=="6" set "S=frontend"
if "%svc%"=="0" goto menu
if not defined S goto logs_one
echo.
echo [实时日志-%S%] 按 Ctrl+C 退出...
echo.
%COMPOSE% logs -f --tail=100 %S%
set "S="
pause
goto menu

:update
echo.
echo [更新中] 拉取最新镜像...
%COMPOSE% pull
echo [重启中] 应用新镜像...
%COMPOSE% up -d
echo.
echo [完成] 已更新到最新镜像。
pause
goto menu

:down
echo.
echo [警告] 将删除容器(数据卷保留, 数据不丢失)。
set /p ok=确认执行? (Y/N): 
if /i not "%ok%"=="Y" goto menu
%COMPOSE% down
echo.
echo [完成] 容器已删除。下次用 [1] 重新启动即可。
pause
goto menu

:open
start "" "http://localhost:9000"
goto menu

:health
echo.
echo === backend-web ===
curl.exe -s http://localhost:8089/health
echo.
echo === websocket ===
curl.exe -s http://localhost:8090/health
echo.
echo === scheduler ===
curl.exe -s http://localhost:8091/health
echo.
echo.
pause
goto menu
