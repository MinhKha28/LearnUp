import { Injectable } from '@nestjs/common';

@Injectable()
export class DemoService {
  findAll() {
    return `This action returns all demo`;
  }
}
