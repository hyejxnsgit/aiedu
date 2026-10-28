"""Read the generated review artifacts with the installed real Orange library."""
import json
from pathlib import Path
import Orange

root = Path(__file__).resolve().parent / 'results' / 'review'
tables = [Orange.data.Table(str(root / f'practice-{part}.tab')) for part in ('train', 'validation')]
expected = ['ego_speed_kmh', 'gap_m', 'lead_speed_kmh', 'road']
for table in tables:
    assert [v.name for v in table.domain.attributes] == expected
    assert table.domain.class_var.name == 'actual_delta_kmh'
    assert table.domain.class_var.is_continuous
    assert [v.name for v in table.domain.metas] == ['run_id', 't_s', 'source']
    assert tuple(table.domain['road'].values) == ('dry', 'wet')
    assert not table.has_missing()
assert len(tables[0]) == 8 and len(tables[1]) == 10
assert set(tables[0].metas[:, 0]).isdisjoint(tables[1].metas[:, 0])
report = dict(orange_version=Orange.__version__, train_rows=8, validation_rows=10,
              features=expected, target='actual_delta_kmh',
              metadata=['run_id', 't_s', 'source'], run_overlap=False,
              note='Concept exercise only. This validates file roles, not model quality or GUI workflow.')
(root / 'orange-import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
