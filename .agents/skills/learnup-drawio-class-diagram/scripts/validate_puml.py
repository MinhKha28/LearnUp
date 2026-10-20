#!/usr/bin/env python3
"""Stdlib-only structural checks for this skill's PlantUML class subset.

Does not prove source fidelity, ownership, full PlantUML syntax, or rendering.
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass, field
from pathlib import Path

ALIAS = r"[A-Za-z_][A-Za-z0-9_]*"
DECLARATION = re.compile(
    rf'^(abstract class|class|interface|enum)\s+'
    rf'(?:"([^"]+)"\s+as\s+({ALIAS})|({ALIAS}))\s*'
    r'(?:<<([^<>]+)>>\s*)?\{$'
)
RELATION = re.compile(
    rf'^({ALIAS})\s+(?:"([^"]+)"\s+)?(\S+)\s+'
    rf'(?:"([^"]+)"\s+)?({ALIAS})(?:\s*:\s*(.+))?$'
)
PACKAGE = re.compile(r'^package\s+"([^"]+)"\s*\{$')
HEADERS = (
    'skinparam monochrome true', 'skinparam backgroundColor white',
    'skinparam classBackgroundColor white', 'skinparam classBorderColor black',
    'skinparam classFontColor black', 'skinparam ArrowColor black',
    'skinparam shadowing false', 'skinparam roundcorner 0',
    'skinparam classAttributeIconSize 0', 'hide circle', 'show empty members',
)
DIRECTIONS = {'top to bottom direction', 'left to right direction'}
EXTRA_STYLE = re.compile(
    r'^skinparam (?:(?:nodesep|ranksep|padding|classFontSize) [1-9][0-9]*|'
    r'packageBackgroundColor white|packageBorderColor black|packageStyle rectangle)$'
)
ARROWS = {
    '--|>': ('generalization', False), '<|--': ('generalization', True),
    '..|>': ('realization', False), '<|..': ('realization', True),
    '..>': ('dependency', False), '<..': ('dependency', True),
    '-->': ('association', False), '<--': ('association', True),
    '--': ('undirected association', False),
    'o--': ('aggregation', False), '--o': ('aggregation', True),
    '*--': ('composition', False), '--*': ('composition', True),
}
HIDDEN = {'-[hidden]right->', '-[hidden]down->'}


@dataclass
class Result:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def validate_text(text: str, mode: str = 'overview') -> Result:
    result = Result()
    if mode not in {'overview', 'detailed'}:
        result.errors.append('Mode must be overview or detailed')
        return result

    lines: list[tuple[int, str]] = []
    in_comment = False
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if in_comment:
            in_comment = "'/" not in line
            continue
        if line.startswith("/'"):
            in_comment = "'/" not in line[2:]
            continue
        if line and not line.startswith("'"):
            lines.append((number, line))
    if in_comment:
        result.errors.append('Unterminated block comment')
    statements = [line for _, line in lines]
    if statements.count('@startuml') != 1 or not statements or statements[0] != '@startuml':
        result.errors.append('Use exactly one @startuml as the first statement')
    if statements.count('@enduml') != 1 or not statements or statements[-1] != '@enduml':
        result.errors.append('Use exactly one @enduml as the last statement')
    titles = [line for line in statements if line.startswith('title ')]
    if len(titles) != 1 or not re.fullmatch(r'title [A-Za-z][\w.-]* - .+', titles[0]):
        result.errors.append('Use one title: SCOPE - Diagram Name')
    for header in HEADERS:
        if statements.count(header) != 1:
            result.errors.append(f'Required exactly once: {header}')
    if sum(line in DIRECTIONS for line in statements) != 1:
        result.errors.append('Choose exactly one layout direction')
    if re.search(r'\[[A-Z][A-Z0-9_]*\]', '\n'.join(statements)):
        result.errors.append('Unreplaced template placeholder')

    declarations: dict[str, str] = {}
    bodies: dict[str, list[tuple[int, str]]] = {}
    packages: list[str] = []
    active_class: str | None = None
    links: list[tuple[int, re.Match]] = []
    first_relation = False

    def fail(number: int, message: str) -> None:
        result.errors.append(f'Line {number}: {message}')

    for number, line in lines:
        if active_class is not None:
            if line == '}':
                active_class = None
            elif DECLARATION.match(line) or PACKAGE.match(line) or line in {'@startuml', '@enduml'}:
                fail(number, 'Class body was not closed before this statement')
            else:
                bodies[active_class].append((number, line))
            continue
        if line in HEADERS or line in DIRECTIONS or EXTRA_STYLE.fullmatch(line):
            if declarations or first_relation:
                fail(number, 'Style header must precede classifiers')
            continue
        if line in {'@startuml', '@enduml'} or line.startswith('title '):
            continue
        package = PACKAGE.fullmatch(line)
        if package:
            if first_relation:
                fail(number, 'Declare packages and classifiers before relationships')
            packages.append(package.group(1))
            continue
        if line == '}':
            if packages:
                packages.pop()
            else:
                fail(number, 'Unexpected closing brace')
            continue
        declaration = DECLARATION.fullmatch(line)
        if declaration:
            kind, display, alias, bare, _ = declaration.groups()
            alias = alias or bare
            display = display or bare
            if first_relation:
                fail(number, 'Classifier declared after relationships')
            if alias in declarations:
                fail(number, f'Duplicate alias {alias}')
            declarations[alias] = kind
            bodies[alias] = []
            active_class = alias
            plain_name = re.sub(r'<.*>', '', display)
            if display.startswith(':') or re.search(r'[/&+,]|\band\b', plain_name, re.I):
                fail(number, 'Use one classifier name per box, without an instance colon prefix')
            continue
        relation = RELATION.fullmatch(line)
        if relation:
            first_relation = True
            links.append((number, relation))
            continue
        fail(number, 'Unsupported statement in the static class-diagram subset')

    if active_class is not None:
        result.errors.append(f'Unclosed class body: {active_class}')
    if packages:
        result.errors.append('Unclosed package block')
    if not declarations:
        result.errors.append('Declare at least one classifier')
    for alias, body in bodies.items():
        if mode == 'overview' and [line for _, line in body] != ['--']:
            result.errors.append(f'{alias}: overview body must contain only one -- separator')
        if mode == 'detailed':
            if not body:
                result.errors.append(f'{alias}: keep a -- separator for empty compartments')
            for number, line in body:
                if line == '--':
                    continue
                if not re.match(r'^(?:(?:\{static\}|\{abstract\})\s*)?[+#~\w-]', line) or line.endswith('{'):
                    fail(number, 'Unsupported detailed member line')

    used: set[str] = set()
    seen: set[tuple[str, str, str, str]] = set()
    inheritance: dict[str, set[str]] = {}
    for number, relation in links:
        source, source_count, arrow, target_count, target, label = relation.groups()
        for alias in (source, target):
            if alias not in declarations:
                fail(number, f'Undeclared relationship endpoint {alias}')
        if arrow in HIDDEN:
            if source_count or target_count or label:
                fail(number, 'Hidden layout links cannot carry multiplicities or semantic labels')
            continue
        if arrow not in ARROWS:
            fail(number, f'Unsupported relationship arrow {arrow}')
            continue
        used.update((source, target))
        kind, reverse = ARROWS[arrow]
        if reverse:
            source, target = target, source
        for count in (source_count, target_count):
            if count and not re.fullmatch(r'\*|\d+(?:\.\.(?:\d+|\*))?', count):
                fail(number, f'Invalid UML multiplicity {count}')
            elif count and '..' in count:
                minimum, maximum = count.split('..')
                if maximum != '*' and int(minimum) > int(maximum):
                    fail(number, f'Reversed multiplicity range {count}')
        if kind in {'generalization', 'realization', 'dependency'} and (source_count or target_count):
            fail(number, f'{kind} cannot have multiplicities')
        if kind in {'generalization', 'realization'}:
            inheritance.setdefault(source, set()).add(target)
            child, parent = declarations.get(source), declarations.get(target)
            if kind == 'realization' and child and parent:
                if child not in {'class', 'abstract class'} or parent != 'interface':
                    fail(number, 'Realization must connect an implementing class to an interface')
            elif child and parent:
                allowed = ({'interface'} if child == 'interface' else {'class', 'abstract class'})
                if child == 'enum' or parent not in allowed:
                    fail(number, 'Generalization requires compatible parent and child classifier kinds')
        if kind == 'undirected association':
            source, target = sorted((source, target))
        key = (source, target, kind, label or '')
        if key in seen:
            fail(number, f'Duplicate {kind} relationship between {source} and {target}')
        seen.add(key)

    visiting: set[str] = set()
    visited: set[str] = set()

    def has_cycle(alias: str) -> bool:
        if alias in visiting:
            return True
        if alias in visited:
            return False
        visiting.add(alias)
        for parent in inheritance.get(alias, ()):
            if has_cycle(parent):
                return True
        visiting.remove(alias)
        visited.add(alias)
        return False

    if any(has_cycle(alias) for alias in declarations):
        result.errors.append('Inheritance/realization graph contains a cycle')
    if len(declarations) > 1:
        for alias in sorted(set(declarations) - used):
            result.warnings.append(f'{alias} has no semantic relationship; justify its inclusion or omit it')
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path', type=Path)
    parser.add_argument('--mode', choices=('overview', 'detailed'), default='overview')
    args = parser.parse_args(argv)
    try:
        text = args.path.read_text(encoding='utf-8-sig')
    except (OSError, UnicodeError) as exc:
        print(f'[FAIL] Cannot read {args.path}: {exc}')
        return 1
    result = validate_text(text, args.mode)
    if not re.fullmatch(r'[A-Za-z][\w.-]*_ClassDiagram\.puml', args.path.name):
        result.errors.append('Filename must be SCOPE_ClassDiagram.puml')
    title = re.search(r'^title ([A-Za-z][\w.-]*) - ', text, re.M)
    if title and args.path.name != f'{title.group(1)}_ClassDiagram.puml':
        result.errors.append('Title scope and filename must agree')
    for warning in result.warnings:
        print(f'[WARN] {warning}')
    for error in result.errors:
        print(f'[FAIL] {error}')
    if result.errors:
        return 1
    print(f'[OK] Static class validation passed ({args.mode}); source fidelity and render/import need separate review.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
