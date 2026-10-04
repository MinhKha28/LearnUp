# @learnup/ts-storage

Shared framework-neutral storage library for LearnUP TypeScript services.

## Responsibilities

- Storage provider abstraction
- Cloudinary upload/delete
- File MIME validation
- File size validation
- Provider response normalization

## Non-responsibilities

This package does not contain:

- NestJS controllers
- Prisma logic
- Database logic
- Course business logic
- Assessment business logic
- Organization quota rules

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```
