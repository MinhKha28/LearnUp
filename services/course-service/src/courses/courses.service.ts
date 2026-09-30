import { Injectable } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateCourseDto) {
    const createdCourse = await this.prisma.course.create({
      data: {
        title: dto.title,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        trainingObjective: dto.trainingObjective,
        estimatedCompletionDays: dto.estimatedCompletionDays,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
      },
    });
    return createdCourse;
  }

  async findAll() {
    return await this.prisma.course.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
