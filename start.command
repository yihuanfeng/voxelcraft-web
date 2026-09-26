#!/bin/bash
# 启动网页版我的世界本地服务器（no-cache）
cd "$(dirname "$0")"
nohup python3 server.py 8000 > /tmp/mc_http.log 2>&1 &
echo "已启动：http://localhost:8000/Minecraft.html"
