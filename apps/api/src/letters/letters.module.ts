import { Module } from '@nestjs/common';
import { LettersController } from './letters.controller.js';
import { LettersService } from './letters.service.js';

@Module({ controllers: [LettersController], providers: [LettersService] })
export class LettersModule {}
