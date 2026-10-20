"""Behavioral regressions for branch balance, aliases, and async notation."""
import contextlib
import io
import re
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
        'activate LEARNER',
        'LEARNER -> Screen: Select course',
        'activate Screen',
        'Screen -> EnrollmentHandler: POST /api/v1/enrollments',
        'activate EnrollmentHandler', body, 'deactivate Screen', 'deactivate LEARNER', '@enduml',
    ])


CLOSE = 'EnrollmentHandler -->> Screen: Enrollment outcome\ndeactivate EnrollmentHandler'


def self_call(alias: str, action: str) -> str:
    return f'{alias} -> {alias}: {action}\nactivate {alias}\ndeactivate {alias}'


class ValidatorTests(unittest.TestCase):
    def test_balanced_paths_can_still_be_missing_rendered_else_activations(self):
        body = f'alt Lookup completed successfully\n{CLOSE}\nelse Lookup failed\n{CLOSE}\nend'
        self.assertTrue(any('Restore incoming activations' in error for error in validate_text(diagram(body))))

    def test_restore_is_render_only_and_not_a_child_execution(self):
        body = f'alt Lookup completed successfully\n{CLOSE}\nelse Lookup failed\nactivate EnrollmentHandler\n{CLOSE}\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_partial_restore_cannot_hide_missing_callers(self):
        close = 'EnrollmentHandler -->> Screen: Result\ndeactivate EnrollmentHandler\nScreen -->> LEARNER: Show result\ndeactivate Screen'
        body = 'alt Lookup completed successfully\n' + close + '\nelse Lookup failed\nactivate EnrollmentHandler\n' + close + '\nend'
        text = diagram(body).replace('end\ndeactivate Screen', 'end')
        self.assertTrue(any('Restore incoming activations' in error for error in validate_text(text)))

    def test_inactive_return_sender_and_caller_are_rejected(self):
        for body,expected in (
            (CLOSE + '\nEnrollmentHandler -->> Screen: Too late', 'Message sender EnrollmentHandler'),
            ('deactivate Screen\n' + CLOSE + '\nactivate Screen', 'Response receiver Screen'),
        ):
            with self.subTest(body=body):
                self.assertTrue(any(expected in error for error in validate_text(diagram(body))))

    def test_actor_and_screen_activations_are_required(self):
        text = diagram(CLOSE)
        for alias in ('LEARNER', 'Screen'):
            with self.subTest(alias=alias):
                missing = re.sub(rf'^(?:activate|deactivate) {alias}\n', '', text, flags=re.M)
                self.assertTrue(any(f'{alias} requires explicit activation' in error for error in validate_text(missing)))

    def test_extra_restoration_is_not_silently_ignored(self):
        body = f'alt Lookup completed successfully\n{CLOSE}\nelse Lookup failed\nactivate EnrollmentHandler\nactivate EnrollmentHandler\n{CLOSE}\nend'
        self.assertTrue(any('inconsistent activation exits' in error for error in validate_text(diagram(body))))

    def test_padding_markup_and_custom_alt_headers_are_rejected(self):
        body = f'group <space:20>alt [Lookup completed successfully]\n{CLOSE}\nelse Lookup failed\nactivate EnrollmentHandler\n{CLOSE}\nend'
        self.assertTrue(any('Do not use <space:' in error for error in validate_text(diagram(body))))
        plain_group = body.replace('<space:20>', '')
        self.assertTrue(any('Use native alt/else/end' in error for error in validate_text(diagram(plain_group))))
        native = body.replace('group <space:20>alt [Lookup completed successfully]', 'alt <space:20>Lookup completed successfully')
        self.assertTrue(any('Do not use <space:' in error for error in validate_text(diagram(native))))

    def test_multiline_guards_keep_outcome_keywords_after_line_break(self):
        body = 'alt Access checked\\nsuccessfully\n' + CLOSE + '\nelse Access check\\nfailed\nactivate EnrollmentHandler\n' + CLOSE + '\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_sequential_phases_can_converge_inside_one_outer_frame(self):
        phase = 'alt Lookup completed successfully\n' + self_call('EnrollmentHandler', 'Prepare result') + '\nelse Lookup failed\n' + self_call('EnrollmentHandler', 'Prepare error') + '\nend\n'
        body = 'alt Access checked successfully\n' + phase + phase + CLOSE + '\nelse Access check failed\nactivate EnrollmentHandler\n' + CLOSE + '\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_optional_preparation_can_converge_before_guarded_continuation(self):
        body = 'alt Access checked successfully\nopt Cover selected\n' + self_call('EnrollmentHandler', 'Upload cover') + '\nend\nalt Cover prepared successfully\n' + CLOSE + '\nelse Cover preparation failed\nactivate EnrollmentHandler\n' + CLOSE + '\nend\nelse Access check failed\nactivate EnrollmentHandler\n' + CLOSE + '\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_fragment_guards_have_at_most_two_explicit_lines(self):
        body = 'alt Lookup completed\\nsuccessfully\n' + CLOSE + '\nelse Lookup\\nfailed\nactivate EnrollmentHandler\n' + CLOSE + '\nend'
        self.assertEqual(validate_text(diagram(body)), [])
        for text in (
            body.replace('Lookup completed\\nsuccessfully', 'Lookup\\ncompleted\\nsuccessfully'),
            body.replace('Lookup\\nfailed', 'Lookup\\nrequest\\nfailed'),
        ):
            self.assertTrue(any('fragment guards' in error for error in validate_text(diagram(text))))

    def test_each_operand_can_have_its_own_nested_continuation(self):
        phase = 'alt Record saved successfully\n' + CLOSE + '\nelse Record saving failed\nactivate EnrollmentHandler\n' + CLOSE + '\nend\n'
        body = 'alt Cover choice checked successfully - selected\n' + phase + 'else Cover choice checked successfully - none\nactivate EnrollmentHandler\n' + phase + 'end'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_named_independent_phases_can_each_have_a_decision(self):
        phase = 'alt Lookup completed successfully\n' + self_call('EnrollmentHandler', 'Prepare result') + '\nelse Lookup failed\n' + self_call('EnrollmentHandler', 'Prepare error') + '\nend\n'
        body = 'alt Access checked successfully\ngroup First independent phase\n' + phase + 'end\ngroup Second independent phase\n' + phase + 'end\n' + CLOSE + '\nelse Access check failed\nactivate EnrollmentHandler\n' + CLOSE + '\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_intermediary_http_client_lifelines_are_rejected(self):
        for client in ('LearningClient', 'TenantClient', 'LookupClient'):
            with self.subTest(client=client):
                body = 'EnrollmentHandler -> Adapter: Query records\nactivate Adapter\nAdapter -->> EnrollmentHandler: Records\ndeactivate Adapter\n' + CLOSE
                self.assertTrue(any('Omit intermediary HTTP Client' in error for error in validate_text(diagram(body, f'participant ":{client}" as Adapter'))))

    def test_direct_rest_to_downstream_controller_is_accepted(self):
        body = 'EnrollmentHandler -> CourseController: GET /api/v1/courses\nactivate CourseController\nCourseController -->> EnrollmentHandler: 200 OK\ndeactivate CourseController\n' + CLOSE
        self.assertEqual(validate_text(diagram(body, 'participant ":CoursesController" as CourseController')), [])

    def test_outer_alternative_encloses_optional_and_nested_outcome_frames(self):
        body = 'alt Access checked successfully\nopt Records available\nalt Lookup completed successfully\n' + self_call('EnrollmentHandler', 'Prepare result') + '\nelse Lookup failed\n' + self_call('EnrollmentHandler', 'Prepare error') + '\nend\nend\n' + CLOSE + '\nelse Access check failed\nactivate EnrollmentHandler\n' + CLOSE + '\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_separate_top_level_alternatives_require_an_enclosing_frame(self):
        first = 'alt Access checked successfully\n' + self_call('EnrollmentHandler', 'Prepare access result') + '\nelse Access check failed\n' + self_call('EnrollmentHandler', 'Prepare access error') + '\nend\n'
        second = 'alt Result prepared successfully\n' + self_call('EnrollmentHandler', 'Return result') + '\nelse Result preparation failed\n' + self_call('EnrollmentHandler', 'Return error') + '\nend\n'
        self.assertTrue(any('one outer alt' in error for error in validate_text(diagram(first + second + CLOSE))))

    def test_optional_processing_cannot_float_before_or_after_outer_alternative(self):
        optional = 'opt Cover selected\n' + self_call('EnrollmentHandler', 'Prepare cover') + '\nend\n'
        alternative = 'alt Request checked successfully\n' + self_call('EnrollmentHandler', 'Prepare request') + '\nelse Request check failed\n' + self_call('EnrollmentHandler', 'Prepare error') + '\nend\n'
        for body in (optional + alternative, alternative + optional):
            with self.subTest(body=body):
                self.assertTrue(any('one outer alt' in error for error in validate_text(diagram(body + CLOSE))))

    def test_pure_optional_flow_does_not_require_a_fabricated_alternative(self):
        body = 'opt Cover selected\n' + self_call('EnrollmentHandler', 'Prepare cover') + '\nend\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_nested_self_activation_preserves_parent_and_accepts_self_return(self):
        body = 'EnrollmentHandler -> EnrollmentHandler: Verify access\nactivate EnrollmentHandler\nEnrollmentHandler -->> EnrollmentHandler: Access result\ndeactivate EnrollmentHandler\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_self_call_without_child_activation_is_rejected(self):
        body = 'EnrollmentHandler -> EnrollmentHandler: Verify access\n' + CLOSE
        self.assertTrue(any('must be immediately followed by activate EnrollmentHandler' in error for error in validate_text(diagram(body))))

    def test_self_call_requires_an_active_parent(self):
        body = CLOSE + '\n' + self_call('EnrollmentHandler', 'Verify access')
        self.assertTrue(any('requires an active parent execution' in error for error in validate_text(diagram(body))))

    def test_recursive_self_calls_can_reach_depth_three(self):
        body = 'EnrollmentHandler -> EnrollmentHandler: Prepare result\nactivate EnrollmentHandler\nEnrollmentHandler -> EnrollmentHandler: Normalize result\nactivate EnrollmentHandler\ndeactivate EnrollmentHandler\ndeactivate EnrollmentHandler\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])
        broken = body.replace('deactivate EnrollmentHandler\ndeactivate EnrollmentHandler', 'deactivate EnrollmentHandler')
        self.assertTrue(any('Unclosed activation' in error for error in validate_text(diagram(broken))))

    def test_child_execution_spans_work_and_closes_on_each_branch(self):
        body = 'EnrollmentHandler -> EnrollmentHandler: Load records\nactivate EnrollmentHandler\nalt Lookup completed successfully\nEnrollmentHandler -> Store: Read records\nactivate Store\nStore -->> EnrollmentHandler: Records\ndeactivate Store\nEnrollmentHandler -->> EnrollmentHandler: Lookup result\ndeactivate EnrollmentHandler\nelse Lookup failed\nactivate EnrollmentHandler\nEnrollmentHandler -->> EnrollmentHandler: Lookup error\ndeactivate EnrollmentHandler\nend\n' + CLOSE
        declarations = 'database "learning_db" as Store'
        self.assertEqual(validate_text(diagram(body, declarations)), [])
        broken = body.replace('Lookup error\ndeactivate EnrollmentHandler', 'Lookup error')
        self.assertTrue(any('inconsistent activation exits' in error for error in validate_text(diagram(broken, declarations))))

    def test_source_comments_can_separate_self_call_and_child_activation(self):
        body = self_call('EnrollmentHandler', 'Verify access').replace('\nactivate EnrollmentHandler', "\n\n' Internal access check\nactivate EnrollmentHandler") + '\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_async_self_message_does_not_require_synchronous_nesting(self):
        body = 'EnrollmentHandler ->> EnrollmentHandler: Schedule later processing\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_another_lifelines_activation_cannot_satisfy_self_call_nesting(self):
        body = 'EnrollmentHandler -> EnrollmentHandler: Verify access\nactivate Screen\ndeactivate Screen\n' + CLOSE
        self.assertTrue(any('must be immediately followed by activate EnrollmentHandler' in error for error in validate_text(diagram(body))))

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
        body = 'alt Eligibility checked successfully\n' + self_call('EnrollmentHandler', 'Save enrollment') + '\nelse Eligibility check failed\n' + self_call('EnrollmentHandler', 'Prepare conflict') + '\nend\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_each_exhaustive_branch_closes_incoming_activation(self):
        body = f'alt Enrollment created successfully\n{CLOSE}\nelse Enrollment creation failed\nactivate EnrollmentHandler\n{CLOSE}\nend'
        self.assertEqual(validate_text(diagram(body)), [])

    def test_nested_alternatives(self):
        body = f'alt Availability checked successfully\nalt Enrollment created successfully\n{CLOSE}\nelse Enrollment restored successfully\nactivate EnrollmentHandler\n{CLOSE}\nend\nelse Availability check failed\nactivate EnrollmentHandler\n{CLOSE}\nend'
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
        body = 'EnrollmentHandler ->> Broker: Publish implemented event\nactivate Broker\nBroker -->> EnrollmentHandler: Accepted\ndeactivate Broker\n' + CLOSE + '\nBroker ->> Consumer: Deliver event\nactivate Consumer\n' + self_call('Consumer', 'Apply update') + '\ndeactivate Consumer'
        declarations = 'queue "Kafka" as Broker\nparticipant ":CompletionConsumer" as Consumer'
        self.assertEqual(validate_text(diagram(body, declarations)), [])

    def test_concurrent_operands_must_balance_locally(self):
        body = 'par First task\n' + self_call('EnrollmentHandler', 'Process first task') + '\nand Second task\n' + self_call('EnrollmentHandler', 'Process second task') + '\nend\n' + CLOSE
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
        body = 'alt Courses loaded successfully\n' + self_call('EnrollmentHandler', 'Prepare list') + '\nelse Course loading failed\n' + self_call('EnrollmentHandler', 'Prepare error') + '\nend\n' + CLOSE
        text = diagram(body)
        self.assertEqual(validate_text(text), [])
        self.assertTrue(any('alt label must state' in error for error in validate_text(text.replace('alt Courses loaded successfully', 'alt Courses available'))))
        self.assertTrue(any('else label must state' in error for error in validate_text(text.replace('else Course loading failed', 'else'))))

    def test_empty_and_populated_lists_can_both_be_successful_outcomes(self):
        body = 'alt Courses loaded successfully - courses found\n' + self_call('EnrollmentHandler', 'Prepare course page') + '\nelse Courses loaded successfully - empty list\n' + self_call('EnrollmentHandler', 'Prepare empty page') + '\nend\n' + CLOSE
        self.assertEqual(validate_text(diagram(body)), [])

    def test_message_labels_have_at_most_two_explicit_lines(self):
        body = self_call('EnrollmentHandler', r'Count InProgress learners by course\nCurrent organization')
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
        client = 'participant ":LookupController" as Client'
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
