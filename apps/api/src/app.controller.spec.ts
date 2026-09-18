import { Test } from '@nestjs/testing';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports a healthy API', () => {
      expect(appController.health()).toEqual({ status: 'ok', service: 'bond-therapy-api' });
    });
  });
});
