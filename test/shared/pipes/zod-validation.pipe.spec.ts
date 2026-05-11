import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../src/shared/pipes/zod-validation.pipe';

const StringSchema = z.object({ name: z.string().min(1) });
const NumberSchema = z.object({ age: z.number().int().positive() });

describe('ZodValidationPipe', () => {
  describe('con datos válidos', () => {
    it('retorna los datos parseados', () => {
      const pipe = new ZodValidationPipe(StringSchema);
      const result = pipe.transform({ name: 'Ana' });
      expect(result).toEqual({ name: 'Ana' });
    });

    it('aplica coerciones del schema si las hay', () => {
      const CoercedSchema = z.object({ value: z.coerce.number() });
      const pipe = new ZodValidationPipe(CoercedSchema);
      const result = pipe.transform({ value: '42' });
      expect(result).toEqual({ value: 42 });
    });

    it('funciona con schema de número', () => {
      const pipe = new ZodValidationPipe(NumberSchema);
      const result = pipe.transform({ age: 30 });
      expect(result).toEqual({ age: 30 });
    });
  });

  describe('con datos inválidos', () => {
    it('lanza BadRequestException', () => {
      const pipe = new ZodValidationPipe(StringSchema);
      expect(() => pipe.transform({ name: '' })).toThrow(BadRequestException);
    });

    it('lanza BadRequestException con objeto vacío', () => {
      const pipe = new ZodValidationPipe(StringSchema);
      expect(() => pipe.transform({})).toThrow(BadRequestException);
    });

    it('el error contiene el resultado de flatten()', () => {
      const pipe = new ZodValidationPipe(StringSchema);
      try {
        pipe.transform({ name: '' });
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.getResponse()).toHaveProperty('fieldErrors');
      }
    });

    it('lanza BadRequestException con tipo incorrecto', () => {
      const pipe = new ZodValidationPipe(NumberSchema);
      expect(() => pipe.transform({ age: 'not-a-number' })).toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException con valor null', () => {
      const pipe = new ZodValidationPipe(StringSchema);
      expect(() => pipe.transform(null)).toThrow(BadRequestException);
    });
  });
});
