# Open Food Facts CSV export (tab-separated, 211 cols) -> API-shaped JSONL for scripts/nutrition/off.mts.
# Only rows whose countries_tags carry a Nordic tag are emitted; rows with a wrong column count are skipped.
import sys, json, gzip
TAGS = (b"en:finland", b"en:sweden", b"en:norway", b"en:denmark", b"en:estonia")
src = sys.argv[1]
f = gzip.open(src, "rb") if src.endswith(".gz") else open(src, "rb")
header = f.readline().rstrip(b"\n").split(b"\t")
idx = {name.decode(): i for i, name in enumerate(header)}
ncol = len(header)
n100 = [(i, name.decode()) for i, name in enumerate(header) if name.endswith(b"_100g")]
need = ["code", "product_name", "brands", "countries_tags", "quantity", "product_quantity", "serving_size", "serving_quantity", "last_modified_t", "image_small_url"]
ni = {k: idx[k] for k in need}
out = sys.stdout.buffer
n = kept = bad = 0
def s(v):
    v = v.strip()
    return v.decode("utf-8", "replace") if v else None
for line in f:
    n += 1
    if not any(t in line for t in TAGS):
        continue
    cols = line.rstrip(b"\n").split(b"\t")
    if len(cols) != ncol:
        bad += 1; continue
    tags = [t for t in cols[ni["countries_tags"]].decode("utf-8", "replace").split(",") if t]
    if not any(t in ("en:finland", "en:sweden", "en:norway", "en:denmark", "en:estonia") for t in tags):
        continue
    nut = {}
    for i, name in n100:
        v = cols[i].strip()
        if v:
            try: nut[name] = float(v)
            except ValueError: pass
    try: lm = int(cols[ni["last_modified_t"]] or 0)
    except ValueError: lm = 0
    sq = s(cols[ni["serving_quantity"]])
    try: sqv = float(sq) if sq else None
    except ValueError: sqv = None
    doc = {
        "code": s(cols[ni["code"]]), "product_name": s(cols[ni["product_name"]]), "brands": s(cols[ni["brands"]]),
        "countries_tags": tags, "quantity": s(cols[ni["quantity"]]), "product_quantity": s(cols[ni["product_quantity"]]),
        "serving_size": s(cols[ni["serving_size"]]), "serving_quantity": sqv, "last_modified_t": lm,
        "image_front_small_url": s(cols[ni["image_small_url"]]), "nutriments": nut,
    }
    out.write(json.dumps(doc, ensure_ascii=False).encode("utf-8") + b"\n"); kept += 1
    if kept % 5000 == 0: sys.stderr.write(f"{n} rows, {kept} kept, {bad} bad\n"); sys.stderr.flush()
sys.stderr.write(f"done: {n} rows, {kept} kept, {bad} bad\n")
