import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  timestamps: true,
})
export class User extends Document {
  @Prop()
  userId: string;

  @Prop()
  avatar: string; // hashed avatar
}

export const UserSchema = SchemaFactory.createForClass(User);
