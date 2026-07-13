#!/bin/sh
# Runtime config generator for spin app
cat > /usr/share/nginx/html/config.js << EOF
window.__SPIN_CONFIG__ = {
  VITE_API_TOKEN: '${SPIN_API_TOKEN}',
  VITE_API_URL: '${SPIN_API_URL}',
  VITE_MOSHSPLIT_URL: '${SPIN_MOSHSPLIT_URL}',
};
EOF
exec "$@"
