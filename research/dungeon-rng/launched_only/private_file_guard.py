"""Protect private save and evidence inputs against accidental output overwrite."""
from pathlib import Path

def assert_output_paths_safe(outputs: list[Path | None], protected_inputs: list[Path | None]) -> None:
    targets = [p.resolve() for p in outputs if p is not None]
    if len(targets) != len(set(targets)):
        raise ValueError('Output paths must be distinct')
    protected = {p.resolve() for p in protected_inputs if p is not None}
    if protected.intersection(targets):
        raise ValueError('Output path would overwrite a source save, ledger, registry, or source root')
    for target in targets:
        if target.exists() and target.is_dir():
            raise ValueError('Output path is a directory')
