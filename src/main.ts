import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('OTP Service')
      .setDescription(
        'API para generación y verificación de códigos OTP de un solo uso. ' +
          'Canal cruzado: `mail` → OTP por SMS, `phone` → OTP por email, `id` → OTP por SMS.',
      )
      .setVersion('1.0')
      .addTag('otp', 'Generación y verificación de OTPs')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  await app.listen(config.getOrThrow<number>('PORT'));
}

void bootstrap();
