#!/bin/bash
cd /opt/moshsplit
docker compose ps
echo ""
echo "Resource Usage:"
docker stats --no-stream
