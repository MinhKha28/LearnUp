"""Regression checks for class structure, relationship direction, and display modes."""
import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from validate_puml import HEADERS, main, validate_text


def classifier(alias, kind='class', body='--', display=None):
    return f'{kind} "{display or alias}" as {alias} {{\n{body}\n}}'


def diagram(declarations, links=''):
    return '\n'.join([
        '@startuml', 'top to bottom direction', *HEADERS, declarations, links, '@enduml',
    ])


class ValidatorTests(unittest.TestCase):
    def assert_valid(self, text, mode='overview'):
        self.assertEqual(validate_text(text, mode).errors, [])

    def assert_error(self, text, expected, mode='overview'):
        self.assertTrue(any(expected in error for error in validate_text(text, mode).errors))

    def test_source_backed_bundled_example(self):
        path = Path(__file__).resolve().parents[1] / 'references' / 'LearningPersistence_ClassDiagram.puml'
        self.assert_valid(path.read_text(encoding='utf-8'))

    def test_overview_preserves_empty_compartments(self):
        self.assert_valid(diagram(classifier('EnrollmentsController')))
        self.assert_error(diagram(classifier('EnrollmentsController', body='')), 'one -- separator')
        self.assert_error(diagram(classifier('EnrollmentsController', body='--\n--')), 'one -- separator')

    def test_overview_rejects_members_but_detailed_accepts_them(self):
        text = diagram(classifier('EnrollmentsService', body='- repository: EnrollmentsRepository\n--\n+ enrollOptional(courseId: string): Promise<CreatedEnrollment>'))
        self.assert_error(text, 'overview body')
        self.assert_valid(text, 'detailed')

    def test_detailed_supports_static_methods_and_enum_values(self):
        text = diagram(classifier('Status', 'enum', 'Active\nWithdrawn') + '\n' + classifier('Factory', body='--\n{static} + create(): Status'), 'Factory ..> Status : Dependency')
        self.assert_valid(text, 'detailed')

    def test_real_and_abstract_parent_with_both_arrow_directions(self):
        declarations = classifier('Repository') + '\n' + classifier('BaseRepository', 'abstract class')
        for link in ('Repository --|> BaseRepository : Inheritance', 'BaseRepository <|-- Repository : Inheritance'):
            self.assert_valid(diagram(declarations, link))

    def test_interface_extends_generic_interface(self):
        declarations = classifier('UserRepository', 'interface') + '\n' + classifier('JpaUserRepository', 'interface', display='JpaRepository<User, UUID>')
        self.assert_valid(diagram(declarations, 'UserRepository --|> JpaUserRepository : Inheritance'))

    def test_realization_points_from_class_to_interface(self):
        declarations = classifier('Client') + '\n' + classifier('Contract', 'interface')
        for link in ('Client ..|> Contract : Implements', 'Contract <|.. Client : Implements'):
            self.assert_valid(diagram(declarations, link))
        self.assert_error(diagram(declarations, 'Contract ..|> Client : Implements'), 'Realization must connect')
        self.assert_error(diagram(declarations, 'Client --|> Contract : Inheritance'), 'compatible parent')

    def test_interface_cannot_extend_class_or_enum(self):
        for kind in ('class', 'enum'):
            text = diagram(classifier('Contract', 'interface') + '\n' + classifier('Target', kind), 'Contract --|> Target : Inheritance')
            self.assert_error(text, 'compatible parent')

    def test_inheritance_cycle_and_self_inheritance(self):
        declarations = '\n'.join(classifier(alias) for alias in ('A', 'B', 'C'))
        self.assert_error(diagram(declarations, 'A --|> B : Inheritance\nB --|> C : Inheritance\nC --|> A : Inheritance'), 'contains a cycle')
        self.assert_error(diagram(classifier('A'), 'A --|> A : Inheritance'), 'contains a cycle')

    def test_association_dependency_and_diamonds_are_accepted(self):
        declarations = classifier('A') + '\n' + classifier('B')
        labels = {'-->': 'Association', '<--': 'Association', '..>': 'Dependency', '<..': 'Dependency', '--': 'Association', 'o--': 'Aggregation', '--o': 'Aggregation', '*--': 'Composition', '--*': 'Composition'}
        for arrow in labels:
            with self.subTest(arrow=arrow):
                self.assert_valid(diagram(declarations, f'A {arrow} B : {labels[arrow]}'))

    def test_multiplicities_are_association_metadata(self):
        declarations = classifier('A') + '\n' + classifier('B')
        self.assert_valid(diagram(declarations, 'A "1" --> "0..*" B : Association'))
        self.assert_error(diagram(declarations, 'A "1" --|> B : Inheritance'), 'cannot have multiplicities')
        self.assert_error(diagram(declarations, 'A ..> "*" B : Dependency'), 'cannot have multiplicities')
        self.assert_error(diagram(declarations, 'A --> "many" B'), 'Invalid UML multiplicity')
        self.assert_error(diagram(declarations, 'A --> "5..2" B'), 'Reversed multiplicity')

    def test_undeclared_endpoint_and_duplicate_alias(self):
        self.assert_error(diagram(classifier('A'), 'A --> Missing'), 'Undeclared relationship endpoint')
        self.assert_error(diagram(classifier('A') + '\n' + classifier('A')), 'Duplicate alias')

    def test_semantically_duplicate_reverse_relation(self):
        declarations = classifier('A') + '\n' + classifier('B', 'abstract class')
        self.assert_error(diagram(declarations, 'A --|> B : Inheritance\nB <|-- A : Inheritance'), 'Duplicate generalization')

    def test_hidden_links_do_not_create_semantic_relationships(self):
        declarations = classifier('A') + '\n' + classifier('B')
        result = validate_text(diagram(declarations, 'A -[hidden]right-> B'))
        self.assertEqual(result.errors, [])
        self.assertEqual(len(result.warnings), 2)
        self.assert_error(diagram(declarations, 'A -[hidden]down-> Missing'), 'Undeclared relationship endpoint')

    def test_unlinked_class_is_warning_not_forced_fabricated_relation(self):
        result = validate_text(diagram(classifier('A') + '\n' + classifier('B')))
        self.assertEqual(result.errors, [])
        self.assertEqual(len(result.warnings), 2)

    def test_service_packages_allow_duplicate_display_names_with_unique_aliases(self):
        declarations = 'package "identity-service" {\n' + classifier('IdentityUser', display='User') + '\n}\npackage "tenant-service" {\n' + classifier('TenantUser', display='User') + '\n}'
        self.assert_valid(diagram(declarations))

    def test_unclosed_class_package_and_stray_brace(self):
        self.assert_error(diagram(classifier('A')[:-1]), 'Unclosed class body')
        self.assert_error(diagram('package "learning-service" {\n' + classifier('A')), 'Unclosed package')
        self.assert_error(diagram(classifier('A') + '\n}'), 'Unexpected closing brace')

    def test_rejects_sequence_syntax_and_colored_style(self):
        for extra in ('activate A', 'participant A', 'skinparam classBackgroundColor red', '!include remote.puml'):
            with self.subTest(extra=extra):
                self.assertTrue(validate_text(diagram(classifier('A')) + '\n' + extra).errors)

    def test_rejects_collapsed_compartments_and_grouped_class(self):
        self.assertTrue(validate_text(diagram(classifier('A')).replace('show empty members', 'hide empty members')).errors)
        self.assert_error(diagram(classifier('A', display='Controller / Service')), 'one classifier name')
        self.assert_error(diagram(classifier('A', display=':Controller')), 'instance colon prefix')

    def test_declarations_must_precede_links(self):
        text = diagram(classifier('A') + '\n' + classifier('B'), 'A --> B\n' + classifier('C'))
        self.assert_error(text, 'Classifier declared after relationships')

    def test_cli_filename_scope_modes_and_read_failure(self):
        with tempfile.TemporaryDirectory(prefix='learnup-class-test-', dir=Path.cwd()) as directory, contextlib.redirect_stdout(io.StringIO()):
            path = Path(directory) / 'UC25.3_ClassDiagram.puml'
            path.write_text(diagram(classifier('A')), encoding='utf-8')
            self.assertEqual(main([str(path)]), 0)
            path.write_text(diagram(classifier('A', body='+id: string\n--\n+save(): void')), encoding='utf-8')
            self.assertEqual(main([str(path)]), 1)
            self.assertEqual(main([str(path), '--mode', 'detailed']), 0)
            path.write_text(diagram(classifier('A')) + '\ntitle UC26 - Unwanted Title\n', encoding='utf-8')
            self.assertEqual(main([str(path)]), 1)
            wrong = Path(directory) / 'diagram.puml'
            wrong.write_text(diagram(classifier('A')), encoding='utf-8')
            self.assertEqual(main([str(wrong)]), 1)
            self.assertEqual(main([str(Path(directory) / 'Missing_ClassDiagram.puml')]), 1)


if __name__ == '__main__':
    unittest.main()
