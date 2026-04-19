#!/bin/bash
export DISPLAY=:99
# Cleanup
sudo pkill -f Xvfb
sudo pkill -f xeyes
sudo pkill -f ffmpeg

echo "Starting Xvfb..."
Xvfb :99 -screen 0 1280x720x24 &
sleep 2

echo "Starting xeyes..."
xeyes &
sleep 1

echo "Starting ffmpeg stream..."
# Listen for 1 connection and serve the x11grab content
ffmpeg -f x11grab -video_size 1280x720 -i :99 -c:v libx264 -preset ultrafast -tune zerolatency -f mp4 -movflags frag_keyframe+empty_moov -listen 1 http://0.0.0.0:8080 &

sleep 5
echo "Casting to TV..."
catt -d "192.168.0.14" cast http://192.168.0.12:8080
