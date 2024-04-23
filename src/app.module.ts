import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailerModule } from '@nestjs-modules/mailer';
import { config } from 'dotenv';
import { UserModule } from './user/user.module';
config();

@Module({
  imports: [
    MongooseModule.forRoot(process.env.DB_URI),
    MailerModule.forRoot({
      transport: {
        host: process.env.EMAIL_HOSTNAME,
        port: Number(process.env.EMAIL_PORT),
        secure: true,
        logger: true,
        debug: true,
        auth: {
          user: process.env.USER_EMAIL,
          pass: process.env.USER_EMAIL_PASSWORD,
        },
        tls: {
          rejectUnauthorized: true,
        },
      },
    }),
    UserModule,
  ],
})
export class AppModule {}
