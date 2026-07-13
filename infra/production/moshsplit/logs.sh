#!/bin/bash
cd /opt/moshsplit
docker compose logs -f "$@"
