export const FEATURES = ['ego_speed_kmh', 'gap_m', 'lead_speed_kmh', 'road'];

export function validateModel(m) {
  if (m?.schema_version !== 1 || m.model_type !== 'orange-native-regression-tree' ||
      JSON.stringify(m.features) !== JSON.stringify(FEATURES) ||
      m.target !== 'actual_delta_kmh' || m.units !== 'km/h' || m.missing_policy !== 'reject')
    throw new Error('지원하지 않는 모델 규격입니다.');
  let count = 0;
  function visit(n, depth) {
    if (++count > 10000 || depth > 64 || !n || !Number.isFinite(n.value))
      throw new Error('잘못된 트리입니다.');
    if (n.kind === 'leaf') return;
    if (n.kind === 'numeric') {
      if (!FEATURES.slice(0, 3).includes(n.feature) || !Number.isFinite(n.threshold) || n.children?.length !== 2)
        throw new Error('잘못된 수치 분기입니다.');
    } else if (n.kind === 'categorical') {
      if (n.feature !== 'road' || !Array.isArray(n.categories) ||
          [...n.categories].sort().join(',') !== 'dry,wet' || n.children?.length !== 2)
        throw new Error('잘못된 노면 분기입니다.');
    } else throw new Error('지원하지 않는 분기입니다.');
    for (const c of n.children) if (c !== null) visit(c, depth + 1);
  }
  visit(m.tree, 0);
  return m;
}

export function predict(m, row) {
  for (const f of FEATURES.slice(0, 3)) {
    if (!Number.isFinite(row?.[f]) || row[f] < 0) throw new Error(`잘못된 입력: ${f}`);
  }
  if (!['dry', 'wet'].includes(row.road)) throw new Error('노면은 dry/wet이어야 합니다.');
  let n = m.tree;
  for (let depth = 0; depth < 65; depth++) {
    if (n.kind === 'leaf') return n.value;
    const k = n.kind === 'numeric' ? Number(row[n.feature] > n.threshold) : n.categories.indexOf(row[n.feature]);
    const child = n.children[k];
    if (child === null) return n.value; // Native Orange empty branch fallback.
    if (!child) throw new Error('잘못된 분기입니다.');
    n = child;
  }
  throw new Error('트리가 너무 깊습니다.');
}
