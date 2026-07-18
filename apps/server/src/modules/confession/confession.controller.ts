import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ok } from '../../common/dto/api-response';
import type { AuthenticatedRequest } from '../auth/types';
import { ConfessionService } from './confession.service';
import { CommentsQueryDto } from './dto/comments-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedQueryDto } from './dto/feed-query.dto';
import { ReportDto } from './dto/report.dto';

// 路由无统一前缀：/circles 与 /posts 直挂 /api/v1（与 API 规范 §6.2 对齐）
@Controller()
export class ConfessionController {
  constructor(private readonly confession: ConfessionService) {}

  @Get('circles')
  async circles() {
    return ok(await this.confession.listCircles());
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 发帖 5/min（API 规范 §8）
  @Post('circles/:id/posts')
  async createPost(
    @Param('id') id: string,
    @Body() dto: CreatePostDto,
    @Req() req: Request,
  ) {
    const user = (req as AuthenticatedRequest).user!;
    return ok(await this.confession.createPost(user.uid, user.openid, id, dto));
  }

  @Get('circles/:id/posts')
  async listCirclePosts(
    @Param('id') id: string,
    @Query() q: FeedQueryDto,
    @Req() req: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.listCirclePosts(uid, id, q));
  }

  @Get('posts/feed')
  async feed(@Query() q: FeedQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.feed(uid, q));
  }

  @Get('posts/mine')
  async myPosts(@Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.listMyPosts(uid));
  }

  @Get('posts/:id')
  async getPost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.getPost(uid, id));
  }

  @Post('posts/:id/like')
  async like(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.toggleLike(uid, id));
  }

  @Post('posts/:id/report')
  async report(@Param('id') id: string, @Body() dto: ReportDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.reportPost(uid, id, dto.reason));
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 评论 5/min
  @Post('posts/:id/comments')
  async createComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @Req() req: Request,
  ) {
    const user = (req as AuthenticatedRequest).user!;
    return ok(await this.confession.createComment(user.uid, user.openid, id, dto));
  }

  @Get('posts/:id/comments')
  async listComments(@Param('id') id: string, @Query() q: CommentsQueryDto) {
    return ok(
      await this.confession.listComments(id, q.page ?? 1, q.pageSize ?? 20),
    );
  }
}
