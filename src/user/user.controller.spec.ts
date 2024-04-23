import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserDto } from './dto/user.dto';

class MockUserService {
  async create(userDto: UserDto, res: any) {
    return true;
  }
}

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useClass: MockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call userService', () => {
    const userDto: UserDto = { 
      userId: '1',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      avatar: 'avatar_url'
    };
    const response = {
      send: jest.fn(),
    };
    const spy = jest.spyOn(userService, 'create');
    controller.create(userDto, response as any);
    expect(spy).toHaveBeenCalledWith(userDto, response);
  });
});