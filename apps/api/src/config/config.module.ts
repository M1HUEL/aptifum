import { Global, Module } from '@nestjs/common';
import { AppEnv, loadEnv } from '@aptifum/config';

export class ConfigService {
  readonly env: AppEnv;

  constructor(overrides: Partial<AppEnv> = {}) {
    const base = loadEnv();
    this.env = { ...base, ...overrides };
  }
}

@Global()
@Module({
  providers: [{ provide: ConfigService, useFactory: () => new ConfigService() }],
  exports: [ConfigService],
})
export class ConfigModule {}
