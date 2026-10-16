import { Module } from '@nestjs/common';
import { LettersController, LetterVerificationController, MyLettersController } from './letters.controller.js';
import { LettersService } from './letters.service.js';

@Module({ controllers: [LettersController, MyLettersController, LetterVerificationController], providers: [LettersService] })
export class LettersModule {}
