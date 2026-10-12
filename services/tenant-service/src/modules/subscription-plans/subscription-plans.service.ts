import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '../../../generated/prisma/client';
import { PlanResponse } from './interfaces/subscription-plan.interface';
import { SubscriptionPlansRepository } from './subscription-plans.repository';

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly subscriptionPlansRepository: SubscriptionPlansRepository,
  ) {}

  async findOffered(): Promise<PlanResponse[]> {
    const plans = await this.subscriptionPlansRepository.findOffered();
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
