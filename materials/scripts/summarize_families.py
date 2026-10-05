import json

d = json.load(open("sample_v1_families.json", encoding="utf-8"))
fams = d["families"]
for fam in fams:
    caps = fam.get("capabilities", [])
    refreshes = [(c["resolution"], c.get("recommended_refresh_seconds")) for c in caps]
    print(
        "{:20s} | public={} | scope={} | types={} | fields={} | refresh={}".format(
            fam["family"],
            fam.get("public"),
            fam.get("scope"),
            fam.get("compatible_asset_types"),
            len(fam.get("fields", [])),
            refreshes,
        )
    )
