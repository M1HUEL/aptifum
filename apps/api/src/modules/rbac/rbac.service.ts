import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '@aptifum/database';

@Injectable()
export class PermissionsService {
  constructor(@InjectRepository(User) private readonly usersRepo: Repository<User>) {}

  async permissionsFor(userId: string): Promise<string[]> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: { roles: true },
      select: { id: true },
    });
    if (!user) {
      return [];
    }
    const permissions = new Set<string>();
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        permissions.add(permission);
      }
    }
    return [...permissions];
  }
}
