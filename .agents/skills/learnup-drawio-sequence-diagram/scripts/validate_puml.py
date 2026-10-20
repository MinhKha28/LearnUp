#!/usr/bin/env python3
"""Static checks for this skill's explicit PlantUML sequence subset (stdlib only).

Not a PlantUML parser or draw.io renderer. Branches are interpreted as alternative
activation states while render activations follow source order. At each operand,
explicitly restore the incoming render depths before starting branch work.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ALIAS = r"[A-Za-z_][A-Za-z0-9_]*"
DECLARATION = re.compile(
    rf'^(actor|boundary|participant|database|control|entity|queue)\s+'
    rf'(?:"([^"]+)"\s+as\s+({ALIAS})|({ALIAS}))\s*$', re.I
)
MESSAGE = re.compile(rf"^({ALIAS})\s+(\S+)\s+({ALIAS})\s*:\s*(.+)$")
ACTIVATION = re.compile(rf"^(activate|deactivate)\s+({ALIAS})\s*$", re.I)
BRANCH_OUTCOME = re.compile(r"\b(?:successfully|failed)\b", re.I)
FILENAME = re.compile(r"UC\d+(?:[._-]\d+)*_SequenceDiagram\.puml")
HEADERS = (
    'autonumber "<b>0.</b> "', "hide footbox", "skinparam backgroundColor white",
    "skinparam ParticipantBackgroundColor white", "skinparam ActorBackgroundColor white",
    "skinparam BoundaryBackgroundColor white", "skinparam DatabaseBackgroundColor white",
    "skinparam LifeLineBackgroundColor white", "skinparam LifeLineBorderColor black",
    "skinparam ArrowColor black", "skinparam ParticipantBorderColor black",
    "skinparam sequenceMessageAlign center", "skinparam responseMessageBelowArrow true",
    "skinparam BoxPadding 10",
    "skinparam MaxMessageSize 200",
)


@dataclass
class Fragment:
    kind: str
    entry: dict[str, int]
    line: int
    exits: list[dict[str, int]] = field(default_factory=list)
    has_else: bool = False


def validate_text(text: str) -> list[str]:
    errors: list[str] = []
    lines: list[tuple[int, str]] = []
    block_comment = False
    block_note = False
    for number, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if block_comment:
            if "'/" in line:
                block_comment = False
            continue
        if line.startswith("/'"):
            block_comment = "'/" not in line[2:]
            continue
        if block_note:
            if line.lower() in {"end note", "endnote", "endhnote", "endrnote", "end hnote", "end rnote"}:
                block_note = False
            continue
        if not line or line.startswith("'"):
            continue
        if re.match(r"^(?:note|hnote|rnote)\b", line, re.I):
            errors.append(f"Line {number}: Do not render notes; move explanations into source comments")
            block_note = ":" not in line
            continue
        lines.append((number, line))
    if block_comment or block_note:
        errors.append("Unterminated comment or note")

    statements = [line for _, line in lines]
    starts = [line for line in statements if line.startswith("@startuml")]
    if len(starts) != 1 or not statements or statements[0] not in starts:
        errors.append("Exactly one @startuml must be the first statement")
    if statements.count("@enduml") != 1 or not statements or statements[-1] != "@enduml":
        errors.append("Exactly one @enduml must be the last statement")
    for required in HEADERS:
        if statements.count(required) != 1:
            errors.append(f"Required exactly once: {required}")
    if re.search(r"\[[A-Z][A-Z0-9_]*\]", "\n".join(statements)):
        errors.append("Unreplaced template placeholder")

    declarations: dict[str, tuple[str, str]] = {}
    used: set[str] = set()
    activated: set[str] = set()
    processing_targets: set[str] = set()
    depths: dict[str, int] = {}
    render_depths: dict[str, int] = {}
    restore_target: dict[str, int] | None = None
    fragments: list[Fragment] = []
    first_message = False
    database_seen = False
    message_count = 0
    pending_self_activation: tuple[str, int] | None = None
    conditional_roots: list[tuple[str, int]] = []
    has_alternative = False

    def fail(number: int, message: str) -> None:
        errors.append(f"Line {number}: {message}")

    def known(number: int, alias: str) -> bool:
        if alias not in declarations:
            fail(number, f"Undeclared participant {alias}")
            return False
        return True

    for number, line in lines:
        low = line.lower()
        if re.search(r"<space\s*:", line, re.I):
            fail(number, "Do not use <space:...>; draw.io may display padding markup literally")
        if re.match(r"^group\b.*\balt\s*\[", low):
            fail(number, "Use native alt/else/end, not a custom group header imitating alt")
        if restore_target is not None and not ACTIVATION.fullmatch(line):
            fail(number, "Restore incoming activations immediately after else/and before branch work")
            render_depths = restore_target.copy()  # Recover to report other errors independently.
            restore_target = None
        if pending_self_activation is not None:
            alias, call_line = pending_self_activation
            next_activation = ACTIVATION.fullmatch(line)
            if not next_activation or next_activation.group(1).lower() != "activate" or next_activation.group(2) != alias:
                fail(call_line, f"Self-call {alias} must be immediately followed by activate {alias} for a nested activation")
            pending_self_activation = None
        if re.match(r"^title\b", low):
            fail(number, "Do not render a title; identify the UC through the filename or a comment")
            continue
        if low.startswith(("show footbox", "box", "!", "autoactivate")):
            fail(number, "Footboxes, layer boxes, preprocessing, and automatic activation are unsupported")
            continue
        if line in HEADERS:
            if first_message:
                fail(number, "Header must precede messages")
            continue
        if line.startswith("@startuml") or line == "@enduml":
            continue
        decl = DECLARATION.fullmatch(line)
        if decl:
            kind, display, alias, bare = decl.groups()
            alias = alias or bare
            display = display or bare
            kind = kind.lower()
            if first_message:
                fail(number, "Participant declaration after first message")
            if database_seen and kind != "database":
                fail(number, "Declare all databases after every non-database participant")
            if kind == "database":
                database_seen = True
            if kind == "boundary" and re.search(r"\.(?:tsx?|jsx?)\b", display, re.I):
                fail(number, "Boundary labels must use readable screen names without source filenames")
            if alias in {"Gateway", "ApiGateway"} or display in {"API Gateway", "ApiGateway", ":ApiGateway"}:
                if kind != "participant" or display != ":ApiGateway":
                    fail(number, 'API Gateway must be declared as participant ":ApiGateway"')
            if alias in declarations:
                fail(number, f"Duplicate participant alias {alias}")
            declarations[alias] = (kind.lower(), display)
            if kind in {"participant", "control", "entity"} and re.fullmatch(r":\w*Client", display):
                fail(number, "Omit intermediary HTTP Client lifelines; draw REST directly to the receiving controller")
            if kind.lower() in {"participant", "control", "entity"}:
                # Class labels are colon-prefixed; real external service names may contain '&'.
                if display.startswith(":") and re.search(r"[/&+,]|\band\b", display, re.I):
                    fail(number, "Do not merge multiple classes into one participant")
            if kind.lower() == "boundary" and re.search(r"\s(?:/|&|\+|and)\s|,", display, re.I):
                fail(number, "Do not merge distinct screens into one boundary")
            continue
        activation = ACTIVATION.fullmatch(line)
        if activation:
            action, alias = activation.groups()
            if not known(number, alias):
                continue
            action = action.lower()
            rendered = render_depths.get(alias, 0)
            desired = (restore_target or {}).get(alias, 0)
            restoring = restore_target is not None and (
                (action == "activate" and rendered < desired)
                or (action == "deactivate" and rendered > desired)
            )
            if restore_target is not None and not restoring:
                fail(number, "Restore incoming activations before adding a new execution")
            if action == "activate":
                render_depths[alias] = rendered + 1
                activated.add(alias)
            elif rendered == 0:
                fail(number, f"Deactivate {alias} without a rendered activation")
            elif rendered == 1:
                render_depths.pop(alias)
            else:
                render_depths[alias] = rendered - 1
            if restoring:
                if render_depths == restore_target:
                    restore_target = None
                continue  # Rendering restoration is not another nested business execution.
            depth = depths.get(alias, 0)
            if action == "activate":
                depths[alias] = depth + 1
                activated.add(alias)
            elif depth == 0:
                fail(number, f"Deactivate {alias} without an active execution")
            elif depth == 1:
                depths.pop(alias)
            else:
                depths[alias] = depth - 1
            continue
        opening = re.match(r"^(alt|opt|loop|group|par)\b", low)
        if opening:
            kind = opening.group(1)
            if kind in {"alt", "opt"} and not any(frame.kind in {"alt", "opt"} for frame in fragments):
                conditional_roots.append((kind, number))
            if kind == "alt":
                has_alternative = True
            if opening.group(1) == "alt" and not BRANCH_OUTCOME.search(line[opening.end():].replace(r"\n", " ")):
                fail(number, "alt label must state successfully or failed")
            if kind in {"alt", "opt"} and len(line[opening.end():].split(r"\n")) > 2:
                fail(number, "Keep fragment guards to at most two explicit lines")
            fragments.append(Fragment(opening.group(1), depths.copy(), number))
            continue
        if re.match(r"^(else|and)\b", low):
            separator = low.split()[0]
            expected = "alt" if separator == "else" else "par"
            if not fragments or fragments[-1].kind != expected:
                fail(number, f"{separator} outside {expected}")
                continue
            fragment = fragments[-1]
            if separator == "else" and not BRANCH_OUTCOME.search(line[len(separator):].replace(r"\n", " ")):
                fail(number, "else label must state successfully or failed")
            if separator == "else" and len(line[len(separator):].split(r"\n")) > 2:
                fail(number, "Keep fragment guards to at most two explicit lines")
            # Unconditional 'else' is exhaustive; 'else condition' is another guard.
            if fragment.has_else:
                fail(number, "No operand may follow an unconditional else")
            fragment.has_else = fragment.has_else or low == "else"
            fragment.exits.append(depths.copy())
            depths = fragment.entry.copy()
            restore_target = depths.copy() if render_depths != depths else None
            continue
        if low == "end":
            if not fragments:
                fail(number, "end without an open fragment")
                continue
            fragment = fragments.pop()
            fragment.exits.append(depths.copy())
            if fragment.kind == "alt":
                # An explicit else label conventionally describes the complement.
                # Any else operand makes the alt exhaustive in this supported subset.
                if len(fragment.exits) == 1:
                    fragment.exits.append(fragment.entry)
                if any(state != fragment.exits[0] for state in fragment.exits[1:]):
                    fail(number, f"alt at line {fragment.line} has inconsistent activation exits")
                depths = fragment.exits[0].copy()
            elif fragment.kind in {"opt", "loop", "par"}:
                if any(state != fragment.entry for state in fragment.exits):
                    fail(number, f"{fragment.kind} at line {fragment.line} must balance activations locally")
                depths = fragment.entry.copy()
            continue
        message = MESSAGE.fullmatch(line)
        if message:
            source, arrow, target, label = message.groups()
            if len(label.split(r"\n")) > 2:
                fail(number, "Keep message labels to at most two explicit lines")
            first_message = True
            message_count += 1
            for alias in (source, target):
                known(number, alias)
                used.add(alias)
            if arrow not in {"->", "-->>", "->>"}:
                fail(number, f"Unsupported arrow {arrow}; use ->, -->>, or ->>")
            if arrow in {"->", "-->>"}:
                if not depths.get(source, 0) or not render_depths.get(source, 0):
                    fail(number, f"Message sender {source} requires an active execution at this message")
                if arrow == "-->>" and (not depths.get(target, 0) or not render_depths.get(target, 0)):
                    fail(number, f"Response receiver {target} requires an active caller execution")
            if arrow in {"->", "->>"}:
                processing_targets.add(target)
            if arrow == "->" and source == target:
                if depths.get(source, 0) == 0:
                    fail(number, f"Self-call {source} requires an active parent execution")
                pending_self_activation = (source, number)
            continue
        if line.startswith("...") or re.fullmatch(r"==.+==", line):
            continue
        fail(number, "Unsupported statement in the static sequence subset")

    for fragment in fragments:
        errors.append(f"Unclosed {fragment.kind} fragment at line {fragment.line}")
    if has_alternative and (len(conditional_roots) != 1 or conditional_roots[0][0] != "alt"):
        errors.append("Enclose dependent alt/opt fragments in one outer alt")
    for alias, depth in sorted(depths.items()):
        errors.append(f"Unclosed activation for {alias}: depth {depth}")
    for alias, depth in sorted(render_depths.items()):
        errors.append(f"Unclosed rendered activation for {alias}: depth {depth}")
    for alias in sorted(set(declarations) - used):
        errors.append(f"Unused participant {alias}")
    for alias in sorted((processing_targets | used) - activated):
        if alias in declarations:
            errors.append(f"Processing participant {alias} requires explicit activation (including actor and screen)")
    if message_count == 0:
        errors.append("At least one interaction is required")
    return errors


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        print("Usage: validate_puml.py <UC_CODE_SequenceDiagram.puml>")
        return 2
    path = Path(args[0])
    try:
        text = path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError) as exc:
        print(f"[FAIL] Cannot read {path}: {exc}")
        return 1
    errors = validate_text(text)
    if not FILENAME.fullmatch(path.name):
        errors.append("Filename must be UC_CODE_SequenceDiagram.puml (e.g. UC25.3_SequenceDiagram.puml)")
    if errors:
        for error in errors:
            print(f"[FAIL] {error}")
        return 1
    print("[OK] Static sequence validation passed; PlantUML rendering and draw.io import are not verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
