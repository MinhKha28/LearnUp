import { HttpException, Injectable, type PipeTransform } from '@nestjs/common';

@Injectable()
export class CompleteReadingPipe implements PipeTransform<unknown, void> {
  transform(body: unknown): void {
    if (
      body !== undefined &&
      (body === null ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).length !== 0)
    ) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Reading completion accepts no business payload.',
        },
        422,
      );
    }
  }
}
