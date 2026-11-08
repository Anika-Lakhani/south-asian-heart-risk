"""Download the CDC's 2025 Behavioral Risk Factor Surveillance System (BRFSS) data.

BRFSS is a yearly US telephone survey of about 400,000 adults. The public
file is ~65 MB zipped (~1 GB unzipped), so it's downloaded on demand into
ml/data/raw/ rather than committed.

Usage: python ml/download.py
"""

from __future__ import annotations

import shutil
import ssl
import urllib.request
import zipfile
from pathlib import Path

import certifi

URL = "https://www.cdc.gov/brfss/annual_data/2025/files/LLCP2025XPT.zip"
EXPECTED_BYTES = 64_642_184
RAW = Path(__file__).parent / "data" / "raw"


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    archive = RAW / "LLCP2025XPT.zip"
    if not archive.exists() or archive.stat().st_size != EXPECTED_BYTES:
        print(f"Downloading {URL} ...")
        # certifi's CA bundle: python.org's macOS Python doesn't use the system certificates.
        context = ssl.create_default_context(cafile=certifi.where())
        with urllib.request.urlopen(URL, context=context) as response, open(archive, "wb") as f:
            shutil.copyfileobj(response, f)
    size = archive.stat().st_size
    if size != EXPECTED_BYTES:
        raise SystemExit(f"Unexpected size {size:,} bytes (expected {EXPECTED_BYTES:,})")
    with zipfile.ZipFile(archive) as z:
        z.extractall(RAW)
        print("Extracted:", ", ".join(z.namelist()))


if __name__ == "__main__":
    main()
