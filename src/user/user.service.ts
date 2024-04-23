import * as fs from 'fs';
import axios from 'axios';
import * as download from 'download';
import * as CryptoJS from 'crypto-js';
import { Injectable, BadRequestException } from '@nestjs/common';
import { Inject } from '@nestjs/common/decorators';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schema/user.schema';
import { UserDto } from './dto/user.dto';
import { MailerService } from '@nestjs-modules/mailer';
import { config } from 'dotenv';
import { createUserSchema } from './validator/user.validator';
import { ClientProxy } from '@nestjs/microservices/client';
config();

const reqResBaseUrl = process.env.REQ_RES_BASE_URL;
const uploadsDir = './src/uploads';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private readonly mailservice: MailerService,
    @Inject('USER_CREATION') private readonly client: ClientProxy,
  ) { }

  async create(payload: UserDto, res) {
    try {
      // sanitize and validate input
      const { error } = createUserSchema.validate(payload);

      if (error)
        throw new BadRequestException(this.getErrorMessage(error.message));

      // store the user with reqres create API
      const { data = {} } = await axios.post(`${reqResBaseUrl}users`, payload);

      // send email
      this.sendEmail(payload.email);

      // publish rabbit event
      this.client.emit('User_Created', payload);

      return res
        .status(201)
        .send({ message: 'User created successfully', data });
    } catch (error) {
      const { status: statusCode, message } = error;
      return res.status(statusCode).json({ message });
    }
  }

  async getUser(userId: string, res) {
    try {
      const { data: { data } = {} } = await axios.get(
        `${process.env.REQ_RES_BASE_URL}users/${userId}`,
      );
      if (!data) {
        return res.json({
          message: 'User Not Found',
        });
      }
      return res.json({
        message: 'User retrieved successfully',
        data,
      });
    } catch (error) {
      const { status: statusCode, message } = error;
      return res.status(statusCode).send({ message });
    }
  }

  async getAvatar(userId: string, res) {
    try {
      const user = await this.userModel.findOne(
        { userId },
        { avatar: 1, _id: 0 },
      );
      if (user) {
        const base64EncodedHash = user.toObject()?.avatar;

        // decrypt the base-64 hashed string
        const bytes = CryptoJS.AES.decrypt(
          base64EncodedHash,
          process.env.HASH_SECRET,
        );
        const decodedData = bytes.toString(CryptoJS.enc.Utf8);

        return res.json({
          message: 'Image retrieved successfully',
          avatar: decodedData,
        });
      }

      const { data: { data: { avatar = '' } = {} } = {} } = await axios.get(
        `${process.env.REQ_RES_BASE_URL}users/${userId}`,
      );

      // save the image as a plain file in uploads directory
      const imageData = await this.saveImage(avatar);
      if (imageData) {
        // convert the image to base-64
        const base64Encoded = imageData.toString('base64');

        // hash the encoded base-64 string
        CryptoJS.AES;
        const base64Hash = CryptoJS.AES.encrypt(
          base64Encoded,
          process.env.HASH_SECRET,
        ).toString();

        // create the entry
        await this.userModel.create({ userId, avatar: base64Hash });
        return res.json({
          message: 'Image retrieved successfully',
          avatar: base64Encoded,
        });
      }
    } catch (error) {
      return res
        .status(404)
        .json({ message: 'Unable to retrieve avatar for given user Id' });
    }
  }

  async removeAvatar(userId: string, res) {
    const filePath = `${uploadsDir}/${userId}-image.jpg`;
    try {
      const user = await this.userModel.deleteOne({ userId });
      if (user.deletedCount) {
        fs.unlinkSync(filePath); // remove avatar from file system
        return res.json({ message: 'User avatar removed successfully' });
      }
      return res
        .status(404)
        .json({ message: 'Unable to delete the user avatar' });
    } catch (error) {
      return res.status(500).json({ message: 'Internal server error' });
    }
  }

  public sendEmail(email: string) {
    this.mailservice.sendMail({
      to: email,
      from: process.env.USER_EMAIL,
      subject: 'User Created',
      text: 'Hi, there! User account created successfully',
    });
  }

  private async saveImage(avatar: string) {
    try {
      // if uploads directory does not exist then make one
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

      const result = await download(avatar, uploadsDir);
      return result;
    } catch (error) {
      return false;
    }
  }

  private getErrorMessage(errMsg) {
    const errPattern = /\"/gi;
    const message = errMsg.replaceAll(errPattern, '');
    return message;
  }
}
