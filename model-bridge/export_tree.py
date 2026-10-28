"""Restricted Orange native regression Tree -> portable JSON. No pickle loading."""
import math
import Orange
from Orange.tree import TreeModel, Node, NumericNode, DiscreteNode

FEATURES = ['ego_speed_kmh', 'gap_m', 'lead_speed_kmh', 'road']

def export_tree(model):
    if type(model) is not TreeModel or not model.domain.class_var.is_continuous:
        raise ValueError('Only native Orange regression Tree is supported')
    attrs = model.domain.attributes
    if [a.name for a in attrs] != FEATURES:
        raise ValueError('Input names/order must match the four-feature contract')
    if model.domain.class_var.name != 'actual_delta_kmh':
        raise ValueError('Unexpected target')
    if any(a.compute_value is not None for a in attrs):
        raise ValueError('Transformed/preprocessed attributes are not supported')
    if not all(a.is_continuous for a in attrs[:3]):
        raise ValueError('The first three inputs must be numeric')
    if not attrs[3].is_discrete or set(attrs[3].values) != {'dry', 'wet'}:
        raise ValueError('road must have exactly dry/wet categories')
    def encode(n):
        if n is None:
            return None
        val = float(n.value[0])
        if not math.isfinite(val):
            raise ValueError('Non-finite prediction')
        out = {'value': val}
        if type(n) is Node:
            out['kind'] = 'leaf'
        elif type(n) is NumericNode:
            if not math.isfinite(n.threshold):
                raise ValueError('Non-finite threshold')
            out.update(kind='numeric', feature=attrs[n.attr_idx].name,
                       threshold=float(n.threshold), children=[encode(c) for c in n.children])
        elif type(n) is DiscreteNode:
            out.update(kind='categorical', feature=attrs[n.attr_idx].name,
                       categories=list(n.attr.values), children=[encode(c) for c in n.children])
        else:
            raise ValueError(f'Unsupported node type: {type(n).__name__}')
        return out
    return {'schema_version': 1, 'model_type': 'orange-native-regression-tree',
            'orange_version': Orange.__version__, 'features': FEATURES,
            'target': 'actual_delta_kmh', 'units': 'km/h',
            'missing_policy': 'reject', 'tree': encode(model.root)}
