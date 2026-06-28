#!/usr/bin/env python3
"""Generate refrigerant_pt.json / .js — the offline P-T table the fieldapp uses *instead of* CoolProp.

A phone can't run CoolProp, so we precompute the saturation physics (CoolProp) into a static table the
app interpolates: gauge psig -> [bubble °F, dew °F]. Superheat reads the
dew (vapor) side, subcool the bubble (liquid) side; for zeotropic blends they differ (glide).

Run with any Python that has CoolProp installed (pip install CoolProp):
    python build_pt_table.py
Emits both .json (node test + reference) and .js (window.PT_DATA — a file:// WebView can't fetch).
"""
import json
import os

from CoolProp.CoolProp import PropsSI

# display name -> candidate CoolProp fluid / predefined-ASHRAE-mixture names (tried in order). CoolProp
# ships predefined mixtures by number (R404A, R410A, R454B…) and pure fluids. R-454B keeps an
# explicit mole-fraction blend as a fallback. Anything CoolProp can't resolve is skipped + reported.
REFRIGERANTS = {
    "R-22": ["R22"], "R-32": ["R32"], "R-134a": ["R134a"], "R-410A": ["R410A"], "R-407C": ["R407C"],
    "R-404A": ["R404A"], "R-407A": ["R407A"], "R-407F": ["R407F"], "R-507A": ["R507A"], "R-502": ["R502"],
    "R-12": ["R12"], "R-123": ["R123"], "R-124": ["R124"], "R-125": ["R125"], "R-143a": ["R143a"],
    "R-152a": ["R152a"], "R-290 (propane)": ["R290", "Propane"], "R-600a (isobutane)": ["R600a", "IsoButane"],
    "R-717 (ammonia)": ["R717", "Ammonia"], "R-744 (CO2)": ["R744", "CarbonDioxide"],
    "R-1234yf": ["R1234yf"], "R-1234ze": ["R1234ze(E)", "R1234ze"],
    # A2L / low-GWP blends. CoolProp lacks these as predefined names in this build, so they fall back
    # to explicit MOLE-fraction mixtures (converted from the published mass compositions). Only the
    # 2-component blends are hand-defined here (low risk); 3-5 component ones (R-448A/449A/452B…) are
    # a documented TODO — define + verify against published P-T before adding.
    "R-454A": ["R454A", "R32[0.5414]&R1234yf[0.4586]"],          # 35/65 mass
    "R-454B": ["R454B", "R32[0.8292]&R1234yf[0.1708]"],          # 68.9/31.1 mass
    "R-454C": ["R454C", "R32[0.3752]&R1234yf[0.6248]"],          # 21.5/78.5 mass
    "R-513A": ["R513A", "R1234yf[0.5324]&R134a[0.4676]"],        # 56/44 mass
    "R-452A": ["R452A"], "R-452B": ["R452B"], "R-448A": ["R448A"], "R-449A": ["R449A"],
    "R-450A": ["R450A"], "R-455A": ["R455A"], "R-422D": ["R422D"],
    "R-427A": ["R427A"], "R-438A": ["R438A"], "R-417A": ["R417A"], "R-421A": ["R421A"],
}
PSIG = list(range(5, 701, 5))
PA_PER_PSI = 6894.757
ATM_PSIA = 14.696


def _resolve(candidates):
    for name in candidates:
        try:
            PropsSI("T", "P", (100 + ATM_PSIA) * PA_PER_PSI, "Q", 1, name)
            return name
        except Exception:
            continue
    return None


def main():
    out = {}
    for disp, candidates in REFRIGERANTS.items():
        name = _resolve(candidates)
        if not name:
            print(f"  {disp:20} SKIP (CoolProp can't resolve {candidates})")
            continue
        rows = []
        for p in PSIG:
            p_abs = (p + ATM_PSIA) * PA_PER_PSI
            try:
                b = PropsSI("T", "P", p_abs, "Q", 0, name) - 273.15
                d = PropsSI("T", "P", p_abs, "Q", 1, name) - 273.15
            except Exception:
                continue
            rows.append([p, round(b * 9 / 5 + 32, 1), round(d * 9 / 5 + 32, 1)])
        if rows:
            out[disp] = rows
            print(f"  {disp:20} {len(rows):3} pts via {name}")

    here = os.path.dirname(os.path.abspath(__file__))
    payload = {"_doc": "psig -> [bubble_F, dew_F]. superheat uses dew, subcool uses bubble. "
                       "Generated from CoolProp by build_pt_table.py — do not hand-edit.",
               "refrigerants": out}
    with open(os.path.join(here, "refrigerant_pt.json"), "w") as f:
        json.dump(payload, f)
    with open(os.path.join(here, "refrigerant_pt.js"), "w") as f:
        f.write("window.PT_DATA = " + json.dumps(payload) + ";\n")
    print(f"wrote refrigerant_pt.json + refrigerant_pt.js — {len(out)} refrigerants")


if __name__ == "__main__":
    main()
