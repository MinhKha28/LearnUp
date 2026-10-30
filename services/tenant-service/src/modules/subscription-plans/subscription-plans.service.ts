import { ConflictException, Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '../../../generated/prisma/client';
import { SubscriptionStatus } from '../../common/constants/tenant.constants';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plans.dto';
import { IAdminPlan } from './interfaces/admin-plan.interface';
import { PlanResponse } from './interfaces/subscription-plan.interface';
import { SubscriptionPlansRepository } from './subscription-plans.repository';

const CURRENT_SUBSCRIPTION_STATUSES = [
  SubscriptionStatus.Active,
  SubscriptionStatus.Grace,
  SubscriptionStatus.Suspended,
];

@Injectable()
export class SubscriptionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionPlansRepository: SubscriptionPlansRepository,
  ) {}

  async findOffered(): Promise<PlanResponse[]> {
    const plans = await this.subscriptionPlansRepository.findOffered();
    return plans.map((plan) => SubscriptionPlansService.toResponse(plan));
  }

  /** UC43 (BR-1, BR-3): Admin xem mọi gói, kể cả gói đã ngừng cung cấp. */
  async findAllForAdmin(): Promise<IAdminPlan[]> {
    const [plans, counts] = await Promise.all([
      this.subscriptionPlansRepository.findAll(),
      this.subscriptionPlansRepository.countOrganizationsByPlan(
        CURRENT_SUBSCRIPTION_STATUSES,
      ),
    ]);
    return plans.map((plan) => this.toAdminResponse(plan, counts.get(plan.id)));
  }

  /** UC43.1 (BR-1, BR-2): gói mới đang cung cấp ngay; tên không trùng gói khác, không phân biệt hoa thường. */
  async create(dto: CreateSubscriptionPlanDto): Promise<IAdminPlan> {
    const plan = await this.prisma.$transaction(async (tx) => {
      await this.subscriptionPlansRepository.lockPlanName(dto.name, tx);
      if (
        await this.subscriptionPlansRepository.findByNameInsensitive(
          dto.name,
          tx,
        )
      ) {
        throw new ConflictException({
          code: 'PLAN_NAME_TAKEN',
          message: 'Đã có gói dịch vụ cùng tên.',
        });
      }
      return this.subscriptionPlansRepository.create(
        {
          name: dto.name,
          price: BigInt(dto.price),
          durationDays: dto.durationDays,
          maxLearners: dto.maxLearners,
          maxInstructors: dto.maxInstructors,
          maxCourseChains: dto.maxCourseChains,
          maxStorageBytes: BigInt(dto.maxStorageBytes),
          isOffered: true,
        },
        tx,
      );
    });
    return this.toAdminResponse(plan, 0);
  }

  private toAdminResponse(
    plan: SubscriptionPlan,
    organizationCount = 0,
  ): IAdminPlan {
    return {
      ...SubscriptionPlansService.toResponse(plan),
      isOffered: plan.isOffered,
      organizationCount,
      createdAt: plan.createdAt,
    };
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
