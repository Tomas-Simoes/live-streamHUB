import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { Hub } from "src/hubs/schema/hubs.schema";

@Schema()
export class User {
    @Prop({ unique: true, required: true })
    username: string

    @Prop({ required: true })
    password: string

    @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hub' }] })
    hubs: Hub[]

    _id: mongoose.Types.ObjectId
}

export const UserSchema = SchemaFactory.createForClass(User)