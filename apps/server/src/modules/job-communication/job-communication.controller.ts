import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ok } from '../../common/dto/api-response';
import type { JwtPayload } from '../auth/types';
import {
  CreateInterviewInvitationDto,
  ParseMeetingDto,
  RespondJobExchangeDto,
  RespondInterviewInvitationDto,
  SendJobExchangeDto,
  SendJobMessageDto,
} from './dto/job-communication.dto';
import { JobCommunicationService } from './job-communication.service';

type JobCommunicationRequest = { user: JwtPayload };

@Controller()
export class JobCommunicationController {
  constructor(private readonly communication: JobCommunicationService) {}

  @Post('job-applications/:id/conversation')
  async ensure(@Param('id') id: string, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.ensureConversation(req.user.uid, id));
  }

  @Get('job-conversations/:id')
  async detail(@Param('id') id: string, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.getConversation(req.user.uid, id));
  }

  @Get('job-conversations/:id/messages')
  async messages(@Param('id') id: string, @Query('cursor') cursor: string | undefined, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.listMessages(req.user.uid, id, cursor));
  }

  @Post('job-conversations/:id/messages')
  async send(@Param('id') id: string, @Body() dto: SendJobMessageDto, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.sendText(req.user.uid, id, dto.content, dto.clientMessageId));
  }

  @Post('job-conversations/:id/exchanges')
  async exchange(@Param('id') id: string, @Body() dto: SendJobExchangeDto, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.sendExchange(req.user.uid, id, dto.kind, dto.clientMessageId));
  }

  @Post('job-conversations/:id/exchanges/:messageId/respond')
  async respondExchange(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() dto: RespondJobExchangeDto,
    @Req() req: JobCommunicationRequest,
  ) {
    return ok(await this.communication.respondExchange(req.user.uid, id, messageId, dto.action));
  }

  @Post('job-applications/:id/interviews/parse')
  async parse(@Param('id') id: string, @Body() dto: ParseMeetingDto, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.parseMeetingShare(req.user.uid, id, dto.input));
  }

  @Post('job-applications/:id/interviews')
  async invite(@Param('id') id: string, @Body() dto: CreateInterviewInvitationDto, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.sendInterviewInvitation(req.user.uid, id, dto));
  }

  @Post('interview-invitations/:id/cancel')
  async cancel(@Param('id') id: string, @Req() req: JobCommunicationRequest) {
    return ok(await this.communication.cancelInterviewInvitation(req.user.uid, id));
  }

  @Post('interview-invitations/:id/respond')
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondInterviewInvitationDto,
    @Req() req: JobCommunicationRequest,
  ) {
    return ok(await this.communication.respondInterviewInvitation(req.user.uid, id, dto.action));
  }
}
