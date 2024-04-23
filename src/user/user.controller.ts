import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Res,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/user.dto';
import { Response } from 'express';

@Controller('api/')
export class UserController {
  constructor(private readonly userService: UserService) { }

  // create user
  @Post('users')
  create(@Body() user: UserDto, @Res() res: Response) {
    const result = this.userService.create(user, res);
    return result;
  }

  // get user by ID
  @Get('user/:userId')
  async getUser(@Param('userId') userId: string, @Res() res: Response) {
    return this.userService.getUser(userId, res);
  }

  // get user avatar
  @Get('user/:userId/avatar')
  async getAvatar(@Param('userId') userId: string, @Res() res: Response) {
    return this.userService.getAvatar(userId, res);
  }

  // delete user avatar
  @Delete('user/:userId/avatar')
  async removeAvatar(@Param('userId') userId: string, @Res() res: Response) {
    return this.userService.removeAvatar(userId, res);
  }
}
