import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from '../admin/admin.service';
import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import type { Request } from 'express';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'profile', version: '1' })
export class ProfileController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService
  ) {}

  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const id = req.user.userId;
    const admin = await this.adminService.findById(id);
    const doc = admin ?? (await this.usersService.findById(id));
    if (!doc) return null;
    const obj = doc.toObject();
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    return obj;
  }

  @Patch('me')
  async updateMe(@Req() req: { user: { userId: string } }, @Body() dto: UpdateUserDto) {
    const id = req.user.userId;
    const admin = await this.adminService.findById(id);
    const updated = admin
      ? await this.adminService.update(id, dto)
      : await this.usersService.update(id, dto);
    const obj = updated.toObject();
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    return obj;
  }

  @Post('me/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
          const dir = join(process.cwd(), 'uploads', 'avatars');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: Request & { user?: { userId: string } }, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
          const id = req.user?.userId || 'user';
          const unique = Date.now();
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${id}-${unique}${ext}`);
        }
      }),
      fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | BadRequestException | null, acceptFile: boolean) => void) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new BadRequestException('Invalid file type'), false);
      },
      limits: { fileSize: 5 * 1024 * 1024 }
    })
  )
  async uploadImage(@Req() req: Request & { user: { userId: string } }, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const id = req.user.userId;
    const base = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${base}/uploads/avatars/${file.filename}`;
    const admin = await this.adminService.findById(id);
    const updated = admin
      ? await this.adminService.update(id, { imageUrl })
      : await this.usersService.update(id, { imageUrl });
    const obj = updated.toObject();
    delete obj.passwordHash;
    delete obj.refreshTokenHash;
    return { imageUrl };
  }
}
