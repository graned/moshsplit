#!/usr/bin/env bash
# =============================================================================
# update_schema_patch.sh — Regenerate the Diesel schema.patch file
# =============================================================================
#
# Compares the raw Diesel-generated schema (without a patch) with the
# corrected schema.rs that lives in the repository.  The diff is written
# to `src/schema.patch` so that `diesel print-schema` re-applies the
# manual customisations after every re-generation.
#
# Prerequisites:
#   - diesel_cli  (cargo install diesel_cli --no-default-features --features postgres)
#   - diff
#
# Usage:
#   DATABASE_URL="postgresql://postgres:password@localhost:5432/moshsplit" \
#     ./update_schema_patch.sh
# =============================================================================

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@0.0.0.0:5432/moshsplit}"
OUTPUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RAW_SCHEMA="$(mktemp)"
CURRENT_SCHEMA="${OUTPUT_DIR}/src/schema.rs"
PATCH_FILE="${OUTPUT_DIR}/src/schema.patch"

cleanup() {
    rm -f "${RAW_SCHEMA}"
}
trap cleanup EXIT

# ── Validate prerequisites ───────────────────────────────────────────────────
command -v diesel >/dev/null 2>&1 || {
    echo "ERROR: 'diesel' CLI not found. Install with:"
    echo "  cargo install diesel_cli --no-default-features --features postgres"
    exit 1
}
command -v diff >/dev/null 2>&1 || {
    echo "ERROR: 'diff' not found. Install diffutils."
    exit 1
}

# ── Generate raw (unpatched) schema ──────────────────────────────────────────
echo "==> Generating raw schema from database ..."
diesel print-schema \
    --database-url "${DATABASE_URL}" \
    --schema app \
    > "${RAW_SCHEMA}"
echo "     ✓ raw schema generated"

# ── Verify current schema exists ─────────────────────────────────────────────
if [ ! -f "${CURRENT_SCHEMA}" ]; then
    echo "ERROR: ${CURRENT_SCHEMA} does not exist."
    echo "       Run \`diesel print-schema\` or \`scripts/gen_diesel_types.sh\` first."
    exit 1
fi

# ── Compute the patch ────────────────────────────────────────────────────────
echo "==> Computing patch from raw → current schema.rs ..."

# `diff` exits 1 when the files differ, so we suppress that "error".
# We only care about the case where both files are identical (no patch needed).
if diff -u "${RAW_SCHEMA}" "${CURRENT_SCHEMA}" > "${PATCH_FILE}"; then
    echo "     ✓ No differences — schema.patch is empty."
    # Write an empty patch so Diesel doesn't complain about a missing file.
    : > "${PATCH_FILE}"
else
    echo "     ✓ Patch written to ${PATCH_FILE}"
    echo ""
    echo "Preview of changes:"
    head -30 "${PATCH_FILE}"
fi
