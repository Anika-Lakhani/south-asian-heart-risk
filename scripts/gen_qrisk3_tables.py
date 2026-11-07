"""Regenerate the QRISK3 coefficient tables from ClinRisk's C source.

Usage: python scripts/gen_qrisk3_tables.py path/to/QRISK3_2017_src.c

The C source is available from https://qrisk.org. Paste the printed
``_COEFFICIENTS`` literal into src/heartrisk/models/qrisk3.py.
"""

import re
import sys


def parse_array(body: str, name: str) -> list[float]:
    match = re.search(name + r"\[\d+\]\s*=\s*\{([^}]*)\}", body)
    return [float(x) for x in match.group(1).replace("\n", "").split(",")]


def parse_sex(body: str) -> dict:
    centre = {k: float(v) for k, v in re.findall(r"(\w+) = \1 - ([\d.]+);", body)}
    main, age_1, age_2 = {}, {}, {}
    for line in re.findall(r"a \+= (.+?);", body):
        if "Iethrisk" in line or "Ismoke" in line:
            continue
        *factors, coef = [part.strip() for part in line.split("*")]
        factors = [re.sub(r"\(smoke_cat==(\d)\)", r"smoke_\1", f) for f in factors]
        if len(factors) == 1:
            main[factors[0]] = float(coef)
        elif factors[0] == "age_1":
            age_1[factors[1]] = float(coef)
        else:
            age_2[factors[1]] = float(coef)
    return {
        "survivor_10yr": parse_array(body, "survivor")[10],
        "ethnicity": parse_array(body, "Iethrisk"),
        "smoking": parse_array(body, "Ismoke"),
        "centre": centre,
        "main": main,
        "age_1_interactions": age_1,
        "age_2_interactions": age_2,
    }


def format_value(value, indent: int) -> str:
    pad = " " * indent
    if isinstance(value, dict):
        items = "".join(f"{pad}    {k!r}: {v!r},\n" for k, v in value.items())
        return "{\n" + items + pad + "}"
    if isinstance(value, list):
        return "[\n" + "".join(f"{pad}    {v!r},\n" for v in value) + pad + "]"
    return repr(value)


def main(path: str) -> None:
    source = open(path).read()
    parts = re.split(r"static double cvd_(female|male)_raw", source)
    print("_COEFFICIENTS: dict[bool, dict] = {")
    for sex, body in zip(parts[1::2], parts[2::2], strict=True):
        tables = parse_sex(body.split("static double", 1)[0])
        print(f"    {sex == 'female'!r}: {{")
        for key, value in tables.items():
            print(f"        {key!r}: {format_value(value, 8)},")
        print("    },")
    print("}")


if __name__ == "__main__":
    main(sys.argv[1])
