#!/usr/bin/env bash
# Creates the Python 3.10 environment of the Recordings generator from the
# lockfile: CPU-only torch first, then every locked package (ADR 0083).
#
#   tools/recordings/setup.sh <venv-dir>
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
venv="${1:?Usage: setup.sh <venv-dir>}"

uv venv --clear --python 3.10 "$venv"
export VIRTUAL_ENV="$venv"
uv pip install --index-url https://download.pytorch.org/whl/cpu torch==2.2.2 torchaudio==2.2.2
uv pip install "setuptools<70" "numpy<1.25" cython wheel
uv pip install --no-build-isolation -r "$here/requirements.lock"
