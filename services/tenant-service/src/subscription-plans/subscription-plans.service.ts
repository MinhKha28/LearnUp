import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from '../../generated/prisma/client';
import { PlanResponse } from './interfaces/subscription-plan.interface';

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async findOffered(): Promise<PlanResponse[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isOffered: true },
      orderBy: { price: 'asc' },
    });
    return plans.map((plan) => SubscriptionPlansService.toResponse(plan));
  }

  static toResponse(plan: SubscriptionPlan): PlanResponse {
    return {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      durationDays: plan.durationDays,
      maxLearners: plan.maxLearners,
      maxInstructors: plan.maxInstructors,
      maxCourseChains: plan.maxCourseChains,
      maxStorageBytes: Number(plan.maxStorageBytes),
    };
  }
}
