import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getModelToken } from '@nestjs/mongoose';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from './schema/user.schema';
import axios from 'axios';
import * as CryptoJS from 'crypto-js';
import * as fs from 'fs';
import * as download from 'download';
import { createUserSchema } from './validator/user.validator';
import { UserDto } from './dto/user.dto';
import { getBase64Url } from '../utils/helper';

jest.mock('./validator/user.validator', () => ({
  createUserSchema: {
    validate: jest.fn(),
  },
}));

jest.mock('axios');
jest.mock('download');
jest.mock('fs');
jest.mock('crypto-js');

const mockUserModel = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
});

const mockClientProxy = () => ({
  emit: jest.fn(),
});

const mockMailerService = () => ({
  sendMail: jest.fn(),
});

const mockUser: UserDto = {
  userId: '12345',
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  avatar: 'path/to/avatar.jpg',
};

describe('UserService', () => {
  let userService: UserService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useFactory: mockUserModel,
        },
        {
          provide: 'USER_CREATION',
          useFactory: mockClientProxy,
        },
        {
          provide: MailerService,
          useFactory: mockMailerService,
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    model = module.get(getModelToken(User.name));
  });

  describe('Create User', () => {
    it('Should handle an error if the given payload is invalid or missing', async () => {
      const payload: UserDto = {
        userId: '12345',
        email: '',
        first_name: 'John',
        last_name: 'Doe',
        avatar: 'path/to/avatar.jpg',
      };

      const responseMock = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      (createUserSchema.validate as jest.Mock).mockReturnValue({
        error: {
          message: 'email is not allowed to be empty',
        },
      });

      await userService.create(payload, responseMock);

      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'email is not allowed to be empty',
      });
    });

    it('Should successfully create a user', async () => {
      const payload: UserDto = {
        userId: '12345',
        email: 'test@example.com',
        first_name: 'John',
        last_name: 'Doe',
        avatar: 'path/to/avatar.jpg',
      };

      const responseMock = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      (axios.post as jest.Mock).mockResolvedValue({
        data: { success: true, id: '12345' },
      });
      (createUserSchema.validate as jest.Mock).mockReturnValue({
        value: payload,
        error: null,
      });

      await userService.create(payload, responseMock);

      expect(responseMock.status).toHaveBeenCalledWith(201);
      expect(responseMock.send).toHaveBeenCalledWith({
        message: 'User created successfully',
        data: { success: true, id: '12345' },
      });
    });
  });

  describe('Get User', () => {
    it('Should retrieve user successfully', async () => {
      const userId = '123';
      const responseMock = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };
      (axios.get as jest.Mock).mockResolvedValue({ data: { data: mockUser } });

      await userService.getUser(userId, responseMock);
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'User retrieved successfully',
        data: mockUser,
      });
    });

    it('Should handle errors when user is not found', async () => {
      const userId = 'unknown';
      const responseMock = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      (axios.get as jest.Mock).mockResolvedValue({ data: {} });
      await userService.getUser(userId, responseMock);
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'User Not Found',
      });
    });
  });

  describe('Get Avatar', () => {
    it('Should retrieve and decrypt an existing avatar successfully', async () => {
      const userId = '123';
      const mockAvatarEncodedHash = 'encoded-hash';
      const mockAvatarDecodedData = 'decoded-avatar-data';

      const responseMock = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      model.findOne.mockResolvedValue({
        toObject: () => ({ avatar: mockAvatarEncodedHash }),
      });

      CryptoJS.AES.decrypt.mockReturnValue({
        toString: jest.fn(() => mockAvatarDecodedData),
      });

      await userService.getAvatar(userId, responseMock);
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'Image retrieved successfully',
        avatar: getBase64Url(mockAvatarDecodedData),
      });
    });

    it('Should fetch, store, and return a new avatar if none exists locally', async () => {
      const userId = '456';
      const mockFetchedAvatarUrl = 'http://example.com/avatar.jpg';
      const mockAvatarData = Buffer.from('new-avatar-data');
      const mockBase64Avatar = getBase64Url(mockAvatarData.toString('base64'));

      const responseMock = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      model.findOne.mockResolvedValue(null); // Ensure no avatar is found locally
      (axios.get as jest.Mock).mockResolvedValue({
        data: { data: { avatar: mockFetchedAvatarUrl } },
      });
      download.mockResolvedValue(mockAvatarData);
      CryptoJS.AES.encrypt.mockReturnValue({
        toString: jest.fn(() => 'encrypted-hash'),
      });

      await userService.getAvatar(userId, responseMock);

      expect(download).toHaveBeenCalledWith(
        mockFetchedAvatarUrl,
        expect.anything(),
      ); // Check if download is called correctly
      expect(model.create).toHaveBeenCalledWith({
        userId: userId,
        avatar: 'encrypted-hash',
      }); // Check if the avatar is stored correctly
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'Image retrieved successfully',
        avatar: mockBase64Avatar,
      }); // Ensure the response is correct
    });

    it('Should return an error if avatar for the given user on axios request returned an error', async () => {
      const userId = '1-wrong-id';
      const responseMock = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      // setup mocks to trigger the error condition
      model.findOne.mockResolvedValue(null); // Assuming no user found triggers a 400 error
      (axios.get as jest.Mock).mockRejectedValue(
        new Error('Error fetching data'),
      ); // Simulate an error from axios

      await userService.getAvatar(userId, responseMock);

      // Verify the call to status
      expect(responseMock.status).toHaveBeenCalledWith(404);
      // Verify the call to json
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'Unable to retrieve avatar for given user Id',
      });
    });

    it('Should return an error if the avatar is not downloaded as a plain file into the file system', async () => {
      const userId = '1';
      const responseMock = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      (axios as any).get.mockRejectedValue({});

      await userService.getAvatar(userId, responseMock as any);

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'Unable to retrieve avatar for given user Id',
      });
    });
  });

  describe('Remove Avatar', () => {
    it('Should successfully remove a user avatar', async () => {
      const userId = '2';
      (fs.existsSync as jest.Mock).mockReturnValue(true); // Ensure that file exists
      model.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const responseMock = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await userService.removeAvatar(userId, responseMock);

      const filePath = `./src/uploads/${userId}-image.jpg`;

      expect(fs.existsSync(filePath)).toBe(true);

      expect(fs.unlinkSync(filePath)).toBe(undefined);

      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'User avatar removed successfully',
      });
    });

    it('Should return error if the avatar for the given user is not found in DB', async () => {
      const userId = '100';
      model.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const responseMock = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await userService.removeAvatar(userId, responseMock);

      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock.json).toHaveBeenCalledWith({
        message: 'Unable to delete the user avatar',
      });
    });
  });
});