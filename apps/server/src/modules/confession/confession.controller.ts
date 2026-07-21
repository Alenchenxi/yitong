import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { LocateCommentQueryDto } from './dto/locate-comment-query.dto';
import { MyPostsQueryDto } from './dto/my-posts-query.dto';
import { ReportDto } from './dto/report.dto';
import { SearchPostsQueryDto } from './dto/search-posts-query.dto';
import { SearchTagsQueryDto } from './dto/search-tags-query.dto';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';

// 路由无统一前缀：/circles 与 /posts 直挂 /api/v1（与 API 规范 §6.2 对齐）
// 重要：NestJS 按方法声明顺序匹配路由。`/posts/:id` 是动态段，凡静态段（feed/mine/search 等）
// 都必须排在 `/posts/:id` 之前，否则会被 `:id` 捕走。下面顺序已避免该问题。
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

  // ===== 静态段路由（必须排在 :id 之前）=====
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

  // P1-08 我的表白墙：我点赞的帖子（按时间倒序分页）
  @Get('posts/mine/liked')
  async myLikedPosts(@Req() req: Request, @Query() q: MyPostsQueryDto) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.listMyLikedPosts(uid, q.page ?? 1, q.pageSize ?? 20));
  }

  // P1-08 我的表白墙：我评论过的帖子（按时间倒序去重分页）
  @Get('posts/mine/commented')
  async myCommentedPosts(@Req() req: Request, @Query() q: MyPostsQueryDto) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.listMyCommentedPosts(uid, q.page ?? 1, q.pageSize ?? 20));
  }

  @Get('posts/search')
  async searchPosts(@Query() q: SearchPostsQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid ?? '';
    return ok(await this.confession.searchPosts(uid, q.q, q.limit ?? 20));
  }

  @Get('users/search')
  async searchUsers(@Query() q: SearchUsersQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid ?? '';
    return ok(await this.confession.searchUsers(uid, q.q, q.limit ?? 20));
  }

  @Get('tags/search')
  async searchTags(@Query() q: SearchTagsQueryDto, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user?.uid ?? '';
    return ok(await this.confession.searchTags(uid, q.q, q.limit ?? 20));
  }

  @Get('search/hot')
  async hotKeywords() {
    return ok(await this.confession.hotKeywords());
  }

  // ===== 动态段路由 =====
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

  // P1-10 编辑帖子
  @Put('posts/:id')
  async editPost(@Param('id') id: string, @Body() dto: CreatePostDto, @Req() req: Request) {
    const user = (req as AuthenticatedRequest).user!;
    return ok(await this.confession.editPost(user.uid, id, user.openid, dto));
  }

  // P1-10 删除帖子（软删）
  @Delete('posts/:id')
  async deletePost(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.deletePost(uid, id));
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // 评论 5/min（smoke 测试场景用 throttle: 30/min 环境开关后续做）
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
  async listComments(
    @Param('id') id: string,
    @Query() q: CommentsQueryDto,
    @Req() req: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user?.uid ?? '';
    return ok(
      await this.confession.listComments(uid, id, q.page ?? 1, q.pageSize ?? 20),
    );
  }

  // P1-01 评论跳转定位（静态段，排在 :id/comments/:commentId 之前）
  @Get('posts/:id/comments/locate')
  async locateComment(@Param('id') id: string, @Query() q: LocateCommentQueryDto) {
    return ok(await this.confession.locateComment(id, q.commentId, q.pageSize ?? 20));
  }

  // P1-01 回复分页
  @Get('posts/:id/comments/:commentId/replies')
  async listReplies(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Query() q: CommentsQueryDto,
    @Req() req: Request,
  ) {
    const uid = (req as AuthenticatedRequest).user?.uid ?? '';
    return ok(
      await this.confession.listReplies(uid, id, commentId, q.page ?? 1, q.pageSize ?? 10),
    );
  }

  // P1-02 评论点赞 toggle（静态段 + 顶级评论或回复都接受，必须在 comments/:commentId/replies 之前已声明动态段：当前 /comments/:id 顶层路由无冲突，可放这里）
  // 备注：NestJS 不会因为 comments/:id/like 与 comments/:id/comments/locate/... 路径匹配冲突而误匹配（路径段数不同）
  @Post('comments/:id/like')
  async toggleCommentLike(@Param('id') id: string, @Req() req: Request) {
    const uid = (req as AuthenticatedRequest).user!.uid;
    return ok(await this.confession.toggleCommentLike(uid, id));
  }
}
