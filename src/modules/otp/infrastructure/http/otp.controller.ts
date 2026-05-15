import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { SendOtpUseCase } from '../../application/use-cases/send-otp.use-case';
import { VerifyOtpUseCase } from '../../application/use-cases/verify-otp.use-case';
import {
  SendOtpSchema,
  type SendOtpDto,
} from '../../application/dto/send-otp.schema';
import {
  VerifyOtpSchema,
  type VerifyOtpDto,
} from '../../application/dto/verify-otp.schema';
import {
  SendOtpResponseSchema,
  VerifyOtpResponseSchema,
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  toOpenApiSchema,
} from '../../application/dto/otp-response.schemas';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';

@ApiTags('otp')
@Controller('otp')
export class OtpController {
  constructor(
    private readonly sendOtp: SendOtpUseCase,
    private readonly verifyOtp: VerifyOtpUseCase,
  ) {}

  @Post('send')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Enviar OTP',
    description:
      'Genera un OTP de 6 dígitos, lo persiste en DynamoDB con TTL configurable ' +
      'y lo envía al cliente por el canal correspondiente (lógica de canal cruzado).',
  })
  @ApiBody({ schema: toOpenApiSchema(SendOtpSchema) })
  @ApiResponse({
    status: 201,
    description: 'OTP generado y enviado exitosamente.',
    schema: toOpenApiSchema(SendOtpResponseSchema),
  })
  @ApiResponse({
    status: 400,
    description: 'Body inválido — falla validación de campos.',
    schema: toOpenApiSchema(ValidationErrorResponseSchema),
  })
  send(@Body(new ZodValidationPipe(SendOtpSchema)) dto: SendOtpDto) {
    return this.sendOtp.execute(dto);
  }

  @Post('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verificar OTP',
    description:
      'Verifica el código OTP contra la sesión activa. ' +
      'La sesión es eliminada inmediatamente tanto en éxito como en fallo (single-use, sin reintentos). ' +
      'Una sesión inexistente o ya consumida devuelve 404; una sesión expirada devuelve 410.',
  })
  @ApiBody({ schema: toOpenApiSchema(VerifyOtpSchema) })
  @ApiResponse({
    status: 200,
    description: 'OTP verificado correctamente.',
    schema: toOpenApiSchema(VerifyOtpResponseSchema),
  })
  @ApiResponse({
    status: 400,
    description:
      'Código incorrecto — sesión eliminada. También puede ser error de validación de campos.',
    schema: {
      oneOf: [
        toOpenApiSchema(ErrorResponseSchema),
        toOpenApiSchema(ValidationErrorResponseSchema),
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Sesión no encontrada o ya consumida.',
    schema: toOpenApiSchema(ErrorResponseSchema),
  })
  @ApiResponse({
    status: 410,
    description: 'Sesión expirada — ya no está disponible.',
    schema: toOpenApiSchema(ErrorResponseSchema),
  })
  verify(@Body(new ZodValidationPipe(VerifyOtpSchema)) dto: VerifyOtpDto) {
    return this.verifyOtp.execute(dto);
  }
}
