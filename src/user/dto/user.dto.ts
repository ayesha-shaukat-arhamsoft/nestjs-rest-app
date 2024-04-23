import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UserDto {
  @IsString()
  readonly userId: string;

  @IsString()
  readonly first_name: string;

  @IsString()
  readonly last_name: string;

  @IsNotEmpty()
  @IsEmail({}, { message: 'Please provide a valid email' })
  readonly email: string;

  @IsString()
  readonly avatar: string;
}
