import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { BillingService } from './billing.service.js';
import { ListInvoicesDto, RecordPaymentDto, UpdateBillingSettingsDto, UpdateInvoiceStatusDto } from './dto.js';

@Controller('billing')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get('settings') getSettings(@CurrentUser() actor: SessionUser) { return this.billing.getSettings(actor); }
  @Patch('settings') updateSettings(@CurrentUser() actor: SessionUser, @Body() dto: UpdateBillingSettingsDto, @Req() req: Request) { return this.billing.updateSettings(actor, dto, req.ip); }
  @Get('invoices') list(@CurrentUser() actor: SessionUser, @Query() query: ListInvoicesDto) { return this.billing.list(actor, query); }
  @Get('invoices/:id') detail(@CurrentUser() actor: SessionUser, @Param('id') id: string) { return this.billing.detail(actor, id); }
  @Get('invoices/:id/pdf') async pdf(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Res() response: Response) { const result = await this.billing.pdf(actor, id); response.setHeader('content-type', 'application/pdf'); response.setHeader('content-disposition', `inline; filename="${result.filename}"`); response.send(result.buffer); }
  @Post('orders/:orderId/invoice') generate(@CurrentUser() actor: SessionUser, @Param('orderId') orderId: string, @Req() req: Request) { return this.billing.generate(actor, orderId, req.ip); }
  @Patch('invoices/:id/status') updateStatus(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: UpdateInvoiceStatusDto, @Req() req: Request) { return this.billing.updateStatus(actor, id, dto, req.ip); }
  @Post('invoices/:id/payments') payment(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: RecordPaymentDto, @Req() req: Request) { return this.billing.recordPayment(actor, id, dto, req.ip); }
}
