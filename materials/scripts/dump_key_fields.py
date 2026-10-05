import json

d = json.load(open("sample_v1_families.json", encoding="utf-8"))
fams = {f["family"]: f for f in d["families"]}

targets = ["wecstd", "wec_instantaneous", "site_instantaneous", "wec_availability", "wec_configuration", "site_configuration", "tep3c021", "wecshad"]
with open("key_fields_dump.txt", "w", encoding="utf-8") as out:
    for name in targets:
        fam = fams[name]
        out.write(f"=== {name} ({fam.get('scope')}) ===\n")
        for field in fam.get("fields", []):
            out.write(f"  {field['name']:28s} | {field.get('display_name','')!s:35s} | unit={field.get('unit')} | {field.get('description','')[:70]}\n")
        out.write("\n")
