import { Global, Module } from '@nestjs/common';
import { AppConfigModule } from './config/app.config.module';

@Global()
@Module({
  imports: [AppConfigModule]
})
export class CommonModule { }
