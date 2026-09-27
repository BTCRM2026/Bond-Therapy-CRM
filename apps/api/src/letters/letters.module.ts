import { Module } from '@nestjs/common';
import { LettersController, LetterVerificationController } from './letters.controller.js';
import { LettersService } from './letters.service.js';

@Module({ controllers: [LettersController, LetterVerificationController], providers: [LettersService] })
export class LettersModule {}
