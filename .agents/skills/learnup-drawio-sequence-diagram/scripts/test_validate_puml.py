"""Behavioral regressions for branch balance, aliases, and async notation."""
import contextlib
import io
import tempfile
import unittest
from pathlib import Path

from validate_puml import HEADERS, main, validate_text


def diagram(body: str, declarations: str = '') -> str:
    return '\n'.join([
        '@startuml', "' UC25.3 - Enroll in an optional course", *HEADERS,
        'actor LEARNER', 'boundary "Course Introduction" as Screen',
        'participant ":EnrollmentsController" as EnrollmentHandler',
        declarations,
        'LEARNER -> Screen: Select course',
        'Screen -> EnrollmentHandler: POST /api/v1/enrollments',
        'activate EnrollmentHandler', body, '@enduml',
    ])


CLOSE = 'EnrollmentHandler -->> Screen: Enrollment outcome\ndeactivate EnrollmentHandler'


class ValidatorTests(unittest.TestCase):
    def test_title_free_diagram_accepts_optional_uc_comment(self):
        text = diagram(CLOSE)
        self.assertEqual(validate_text(text), [])
        without_comment = text.replace("' UC25.3 - Enroll in an optional course\n", '')
        self.assertEqual(validate_text(without_comment), [])

    def test_visible_title_is_rejected(self):
        for title in ('title UC25.3 - Enroll in an optional course', 'TITLE Course Enrollment', 'title'):
            with self.subTest(title=title):
                text = diagram(CLOSE).replace('@startuml', '@startuml\n' + title)
                self.assertTrue(any('Do not render a title' in error for error in validate_text(text)))

    def test_actual_alias_and_subcode_need_no_generic_service(self):
        self.assertEqual(validate_text(diagram(CLOSE)), [])

    def test_shared_activation_after_branch_merge(self):
        body = 'alt Eligibility checked successfully\nEnrollmentHandler -> EnrollmentHandler: Save enrollment\nelse Eligibility check failed\nEnrollmentHandler -> EnrollmentHandler: Prepare conflict\nend\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_each_exhaustive_branch_closes_incoming_activation(self):
        body = f'alt Enrollment created successfully\n{CLOSE}\nelse Enrollment creation failed\n{CLOSE}\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_nested_alternatives(self):
        body = f'alt Availability checked successfully\nalt Enrollment created successfully\n{CLOSE}\nelse Enrollment restored successfully\n{CLOSE}\nend\nelse Availability check failed\n{CLOSE}\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_missing_deactivation_on_one_branch_fails(self):
        body = f'alt Enrollment created successfully\n{CLOSE}\nelse Enrollment creation failed\nEnrollmentHandler -->> Screen: Conflict\nend'
        self.assertTrue(any('inconsistent activation exits' in e for e in validate_text(diagram(body))))

    def test_alt_without_else_has_implicit_skip_path(self):
        body = f'alt Enrollment created successfully\n{CLOSE}\nend'
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

    def test_numbering_requires_bold_period_and_trailing_space(self):
        text = diagram(CLOSE)
        self.assertEqual(validate_text(text), [])
        for directive in ('autonumber', 'autonumber "<b>0</b> "', 'autonumber "<b>0.</b>"'):
            with self.subTest(directive=directive):
                invalid = text.replace('autonumber "<b>0.</b> "', directive)
                self.assertTrue(any('autonumber' in error for error in validate_text(invalid)))

    def test_rendered_notes_are_rejected_but_source_comments_are_allowed(self):
        for note in ('note right of Screen: Technical details', 'note over Screen\nTechnical details\nend note', 'hnote over Screen\nTechnical details\nendhnote', 'rnote over Screen\nTechnical details\nendrnote'):
            with self.subTest(note=note):
                text = diagram(CLOSE).replace('@enduml', note + '\n@enduml')
                self.assertTrue(any('Do not render notes' in error for error in validate_text(text)))
        text = diagram(CLOSE).replace('@enduml', "' note: source evidence only\n@enduml")
        self.assertEqual(validate_text(text), [])

    def test_each_alt_operand_requires_an_explicit_outcome(self):
        body = 'alt Courses loaded successfully\nEnrollmentHandler -> EnrollmentHandler: Prepare list\nelse Course loading failed\nEnrollmentHandler -> EnrollmentHandler: Prepare error\nend\n' + CLOSE
        text = diagram(body)
        self.assertEqual(validate_text(text), [])
        self.assertTrue(any('alt label must state' in error for error in validate_text(text.replace('alt Courses loaded successfully', 'alt Courses available'))))
        self.assertTrue(any('else label must state' in error for error in validate_text(text.replace('else Course loading failed', 'else'))))

    def test_empty_and_populated_lists_can_both_be_successful_outcomes(self):
        body = 'alt Courses loaded successfully - courses found\nEnrollmentHandler -> EnrollmentHandler: Prepare course page\nelse Courses loaded successfully - empty list\nEnrollmentHandler -> EnrollmentHandler: Prepare empty page\nend\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_message_labels_have_at_most_two_explicit_lines(self):
        body = r'EnrollmentHandler -> EnrollmentHandler: Count InProgress learners by course\nCurrent organization'
        text = diagram(body + '\n' + CLOSE)
        self.assertEqual(validate_text(text), [])
        invalid = text.replace('Current organization', r'Current organization\nDetailed query predicate')
        self.assertTrue(any('at most two explicit lines' in error for error in validate_text(invalid)))

    def test_boundary_uses_screen_name_while_source_comments_remain_allowed(self):
        text = diagram(CLOSE).replace('Course Introduction', 'View Course Page')
        text = text.replace('@enduml', "' UI: frontend/src/pages/instructor/my.courses.tsx\n@enduml")
        self.assertEqual(validate_text(text), [])
        invalid = text.replace('View Course Page', r'MyCourses\n(instructor/my.courses.tsx)')
        self.assertTrue(any('without source filenames' in error for error in validate_text(invalid)))

    def test_api_gateway_requires_object_display_name(self):
        body = 'EnrollmentHandler -> Gateway: Forward request\nactivate Gateway\nGateway -->> EnrollmentHandler: Response\ndeactivate Gateway\n' + CLOSE
        text = diagram(body, 'participant ":ApiGateway" as Gateway')
        self.assertEqual(validate_text(text), [])
        self.assertTrue(any('API Gateway must be declared' in error for error in validate_text(text.replace('":ApiGateway"', '"API Gateway"'))))

    def test_all_databases_follow_downstream_participants(self):
        body = 'EnrollmentHandler -> Client: Query downstream data\nactivate Client\nClient -> Store: Read records\nactivate Store\nStore -->> Client: Records\ndeactivate Store\nClient -->> EnrollmentHandler: Result\ndeactivate Client\n' + CLOSE
        client = 'participant ":LookupClient" as Client'
        store = 'database "learning_db" as Store'
        self.assertEqual(validate_text(diagram(body, client + '\n' + store)), [])
        self.assertTrue(any('databases after every non-database' in error for error in validate_text(diagram(body, store + '\n' + client))))

    def test_cli_filename_and_exit_status_without_title(self):
        with tempfile.TemporaryDirectory() as directory, contextlib.redirect_stdout(io.StringIO()):
            path = Path(directory) / 'UC25.3_SequenceDiagram.puml'
            path.write_text(diagram(CLOSE), encoding='utf-8')
            self.assertEqual(main([str(path)]), 0)
            with_title = diagram(CLOSE).replace('@startuml', '@startuml\ntitle UC25.3 - Course Enrollment')
            path.write_text(with_title, encoding='utf-8')
            self.assertEqual(main([str(path)]), 1)
            wrong = Path(directory) / 'sequence.puml'
            wrong.write_text(diagram(CLOSE), encoding='utf-8')
            self.assertEqual(main([str(wrong)]), 1)
            self.assertEqual(main([str(Path(directory) / 'missing.puml')]), 1)
            self.assertEqual(main([]), 2)


if __name__ == '__main__':
    unittest.main()
