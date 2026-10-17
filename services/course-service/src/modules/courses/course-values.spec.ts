import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { COURSE_STATUS, COURSE_TYPE } from './course-values';
import { CourseListQueryDto } from './dto/course-list-query.dto';
import { OrganizationCourseListQueryDto } from './dto/organization-course-list-query.dto';
import { CreateCourseDto } from './dto/create-course.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

describe.each([CourseListQueryDto, OrganizationCourseListQueryDto])(
  '%s Course filters',
  (metatype) => {
    const validate = (value: object) =>
      pipe.transform(value, { type: 'query', metatype });

    it.each(Object.values(COURSE_STATUS))(
      'accepts status %s unchanged',
      async (status) => {
        expect((await validate({ status })).status).toBe(status);
      },
    );

    it.each(Object.values(COURSE_STATUS).map((s) => s.toUpperCase()))(
      'rejects uppercase status %s with 400',
      async (status) => {
        await expect(validate({ status })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it.each(Object.values(COURSE_TYPE))(
      'accepts courseType %s unchanged',
      async (courseType) => {
        expect((await validate({ courseType })).courseType).toBe(courseType);
      },
    );

    it.each(['PUBLIC', 'PRIVATE', 'public', 'private', 'Unknown'])(
      'rejects courseType %s with 400',
      async (courseType) => {
        await expect(validate({ courseType })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );

    it.each(['draft', 'published', 'Unknown', '', ['Published']])(
      'rejects invalid status %s',
      async (status) => {
        await expect(validate({ status })).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  },
);

describe('CreateCourseDto', () => {
  const validate = (courseType: string) =>
    pipe.transform(
      { name: 'An toàn lao động', expectedCompletionDays: 14, courseType },
      { type: 'body', metatype: CreateCourseDto },
    );

  it.each(Object.values(COURSE_TYPE))('accepts %s', async (courseType) => {
    expect((await validate(courseType)).courseType).toBe(courseType);
  });

  it.each(['PUBLIC', 'PRIVATE', 'public', 'private'])(
    'rejects %s with 400',
    async (courseType) => {
      await expect(validate(courseType)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
});
