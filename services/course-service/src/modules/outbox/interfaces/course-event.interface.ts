export type CourseComponentType = 'Lesson' | 'Material';

export type CourseEventType =
  | 'CourseDisabled'
  | 'CourseReactivated'
  | 'CourseComponentDisabled'
  | 'CourseComponentReactivated';

export interface BaseCourseEvent {
  organizationId: string;
  courseId: string;
  occurredAt: Date;
}

export type CourseEventInput =
  | (BaseCourseEvent & {
      eventType: 'CourseDisabled' | 'CourseReactivated';
    })
  | (BaseCourseEvent & {
      eventType: 'CourseComponentDisabled' | 'CourseComponentReactivated';
      componentType: CourseComponentType;
      componentId: string;
    });
