"""Behavioral regressions for branch balance, aliases, and async notation."""
import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from validate_puml import HEADERS, main, validate_text


def diagram(body: str, declarations: str = '') -> str:
    return '\n'.join([
        '@startuml', 'title UC25.3 - Enroll in an optional course', *HEADERS,
        'actor LEARNER', 'boundary "Course Introduction" as Screen',
        'participant ":EnrollmentsController" as EnrollmentHandler',
        declarations,
        'LEARNER -> Screen: Select course',
        'Screen -> EnrollmentHandler: POST /api/v1/enrollments',
        'activate EnrollmentHandler', body, '@enduml',
    ])


CLOSE = 'EnrollmentHandler -->> Screen: Enrollment outcome\ndeactivate EnrollmentHandler'


class ValidatorTests(unittest.TestCase):
    def test_actual_alias_and_subcode_need_no_generic_service(self):
        self.assertEqual(validate_text(diagram(CLOSE)), [])

    def test_shared_activation_after_branch_merge(self):
        body = 'alt Eligible\nEnrollmentHandler -> EnrollmentHandler: Save enrollment\nelse Rejected\nEnrollmentHandler -> EnrollmentHandler: Prepare conflict\nend\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_each_exhaustive_branch_closes_incoming_activation(self):
        body = f'alt Eligible\n{CLOSE}\nelse Rejected\n{CLOSE}\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_nested_alternatives(self):
        body = f'alt Available\nalt New enrollment\n{CLOSE}\nelse Restored\n{CLOSE}\nend\nelse Unavailable\n{CLOSE}\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_missing_deactivation_on_one_branch_fails(self):
        body = f'alt Eligible\n{CLOSE}\nelse Rejected\nEnrollmentHandler -->> Screen: Conflict\nend'
        self.assertTrue(any('inconsistent activation exits' in e for e in validate_text(diagram(body))))

    def test_alt_without_else_has_implicit_skip_path(self):
        body = f'alt Eligible\n{CLOSE}\nend'
        self.assertTrue(any('inconsistent activation exits' in e for e in validate_text(diagram(body))))

    def test_locally_balanced_optional_and_loop(self):
        for fragment in ('opt Refresh data', 'loop Each learner'):
            with self.subTest(fragment=fragment):
                body = f'{fragment}\nEnrollmentHandler -> Store: Save record\nactivate Store\nStore -->> EnrollmentHandler: Saved\ndeactivate Store\nend\n{CLOSE}'
                self.assertEqual(validate_text(diagram(body, 'database "learning_db" as Store')), [])

    def test_optional_or_repeated_body_cannot_close_incoming_execution(self):
        for fragment in ('opt Requested', 'loop Each item'):
            with self.subTest(fragment=fragment):
                self.assertTrue(any('balance activations locally' in e for e in validate_text(diagram(f'{fragment}\n{CLOSE}\nend'))))

    def test_async_event_delivery_is_not_a_return(self):
        body = 'EnrollmentHandler ->> Broker: Publish implemented event\nactivate Broker\nBroker -->> EnrollmentHandler: Accepted\ndeactivate Broker\n' + CLOSE + '\nBroker ->> Consumer: Deliver event\nactivate Consumer\nConsumer -> Consumer: Apply update\ndeactivate Consumer'
        declarations = 'queue "Kafka" as Broker\nparticipant ":CompletionConsumer" as Consumer'
        self.assertEqual(validate_text(diagram(body, declarations)), [])

    def test_concurrent_operands_must_balance_locally(self):
        body = f'par First task\nEnrollmentHandler -> EnrollmentHandler: Process first task\nand Second task\nEnrollmentHandler -> EnrollmentHandler: Process second task\nend\n{CLOSE}'
        self.assertEqual(validate_text(diagram(body)), [])
        self.assertTrue(any('balance activations locally' in e for e in validate_text(diagram(f'par Task\n{CLOSE}\nend'))))

    def test_unmatched_activation_and_underflow_fail(self):
        self.assertTrue(any('Unclosed activation' in e for e in validate_text(diagram('EnrollmentHandler -->> Screen: Done'))))
        self.assertTrue(any('without an active execution' in e for e in validate_text(diagram(CLOSE + '\ndeactivate EnrollmentHandler'))))

    def test_rejects_undeclared_duplicate_unused_and_late_participants(self):
        cases = (
            (diagram(CLOSE + '\nMissing -> Screen: Result'), 'Undeclared participant'),
            (diagram(CLOSE, 'participant ":Duplicate" as EnrollmentHandler'), 'Duplicate participant'),
            (diagram(CLOSE, 'participant ":Idle" as Idle'), 'Unused participant'),
            (diagram(CLOSE + '\nparticipant ":Late" as Late'), 'after first message'),
        )
        for text, expected in cases:
            with self.subTest(expected=expected):
                self.assertTrue(any(expected in e for e in validate_text(text)))

    def test_processing_target_requires_activation(self):
        text = diagram('EnrollmentHandler -> Store: Save\nStore -->> EnrollmentHandler: Saved\n' + CLOSE, 'database "learning_db" as Store')
        self.assertTrue(any('Store requires explicit activation' in e for e in validate_text(text)))

    def test_rejects_closed_return_arrow_and_shorthand(self):
        for arrow in ('-->', '->++'):
            self.assertTrue(any('Unsupported arrow' in e for e in validate_text(diagram(CLOSE.replace('-->>', arrow)))))

    def test_rejects_grouped_class_and_colored_configuration(self):
        text = diagram(CLOSE).replace(':EnrollmentsController', ':Controller / Service')
        self.assertTrue(any('merge multiple classes' in e for e in validate_text(text)))
        self.assertTrue(validate_text(diagram(CLOSE).replace('skinparam backgroundColor white', 'skinparam backgroundColor red')))

    def test_comment_does_not_satisfy_required_header(self):
        text = diagram(CLOSE).replace('hide footbox', "' hide footbox")
        self.assertTrue(any('hide footbox' in e for e in validate_text(text)))

    def test_cli_filename_title_and_exit_status(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            path = Path(directory) / 'UC25.3_SequenceDiagram.puml'
            path.write_text(diagram(CLOSE), encoding='utf-8')
            self.assertEqual(main([str(path)]), 0)
            path.write_text(diagram(CLOSE).replace('title UC25.3', 'title UC26'), encoding='utf-8')
            self.assertEqual(main([str(path)]), 1)
            wrong = Path(directory) / 'sequence.puml'
            wrong.write_text(diagram(CLOSE), encoding='utf-8')
            self.assertEqual(main([str(wrong)]), 1)
            self.assertEqual(main([str(Path(directory) / 'missing.puml')]), 1)
            self.assertEqual(main([]), 2)


if __name__ == '__main__':
    unittest.main()
