import {
  createApiError,
  HEADER_NAMES,
  type CurrentUser,
} from '@learnup/ts-common';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';

const CAP = 1000;
const sources = {
  learner: {
    service: 'TENANT',
    path: '/api/v1/users/learners',
    size: 50,
    page: 'page',
    query: 'keyword',
    items: 'items',
    code: 'LEARNER_SEARCH_UNAVAILABLE',
  },
  course: {
    service: 'COURSE',
    path: '/api/v1/courses/organization',
    size: 100,
    page: 'current',
    query: 'search',
    items: 'result',
    code: 'COURSE_SEARCH_UNAVAILABLE',
  },
} as const;

@Injectable()
export class AssignmentKeywordSearch {
  private readonly logger = new Logger(AssignmentKeywordSearch.name);

  constructor(private readonly config: ConfigService) {}

  async ids(user: CurrentUser, kind: keyof typeof sources, keyword: string) {
    const source = sources[kind];
    const ids = new Set<string>();
    const params = new URLSearchParams({
      [source.query]: keyword,
      pageSize: String(source.size),
    });
    const baseUrl = this.config
      .getOrThrow<string>(source.service + '_SERVICE_URL')
      .trim()
      .replace(/\/+$/, '');
    const timeout = Number(
      this.config.get(source.service + '_SERVICE_TIMEOUT_MS') ?? 3000,
    );
    const headers = {
      [HEADER_NAMES.INTERNAL_KEY]: this.config
        .getOrThrow<string>('INTERNAL_SERVICE_KEY')
        .trim(),
      [HEADER_NAMES.USER_ID]: user.userId,
      [HEADER_NAMES.USER_ROLE]: user.role,
      [HEADER_NAMES.ORGANIZATION_ID]: user.organizationId!,
      accept: 'application/json',
    };

    // Bound the number of pages even if an upstream repeats IDs while the list changes.
    for (let page = 1; page <= Math.floor(CAP / source.size) + 1; page++) {
      params.set(source.page, String(page));
      const { items, total } = await this.readPage(
        baseUrl + source.path + '?' + params,
        source,
        headers,
        timeout,
      );
      for (const id of items) {
        ids.add(id);
        if (ids.size > CAP) this.tooBroad();
      }
      if (items.length < source.size || page * source.size >= total)
        return [...ids];
    }
    this.tooBroad();
  }

  private tooBroad(): never {
    throw new UnprocessableEntityException(
      createApiError(
        'SEARCH_TOO_BROAD',
        'Từ khóa quá rộng, hãy nhập cụ thể hơn.',
      ),
    );
  }

  private async readPage(
    url: string,
    source: (typeof sources)[keyof typeof sources],
    headers: Record<string, string>,
    timeout: number,
  ) {
    let status: number | null = null;
    let code: string | null = null;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(timeout),
      });
      status = response.status;
      const body = (await response.json()) as {
        data?: {
          items?: unknown;
          result?: unknown;
          meta?: { total?: unknown };
        };
        error?: { code?: unknown };
        errorCode?: unknown;
      } | null;
      if (!response.ok) {
        const upstreamCode = body?.error?.code ?? body?.errorCode;
        code =
          typeof upstreamCode === 'string' &&
          /^[A-Z0-9_]{1,80}$/.test(upstreamCode)
            ? upstreamCode
            : null;
        throw new Error('Upstream HTTP error');
      }
      const items = body?.data?.[source.items];
      const total = body?.data?.meta?.total;
      if (
        !Array.isArray(items) ||
        items.length > source.size ||
        typeof total !== 'number' ||
        !Number.isSafeInteger(total) ||
        total < items.length
      ) {
        throw new Error('Invalid search page');
      }
      return {
        items: items.map((item: { id?: unknown } | null) => {
          const id = item?.id;
          if (typeof id !== 'string' || !isUUID(id))
            throw new Error('Invalid search ID');
          return id;
        }),
        total,
      };
    } catch (error) {
      this.logger.warn({
        errorClass: error instanceof Error ? error.constructor.name : 'Unknown',
        status,
        code,
        method: 'GET',
        path: source.path,
      });
      throw new ServiceUnavailableException(
        createApiError(
          source.code,
          'Tìm kiếm tạm thời không khả dụng. Vui lòng thử lại.',
        ),
      );
    }
  }
}
