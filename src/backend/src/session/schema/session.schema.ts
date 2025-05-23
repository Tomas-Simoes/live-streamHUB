import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema()
export class Session {
    @Prop({ required: true, unique: true, index: true })
    refreshToken: string

    @Prop({ default: false })
    isRevoked: boolean

    @Prop()
    userId: string

    @Prop()
    userAgent: string

    @Prop()
    ipAddress: string

    @Prop({ required: true })
    expiresAt: Date

    @Prop({ default: Date.now })
    createdAt: Date

    @Prop({ default: Date.now })
    updatedAt: Date
}

export const SessionSchema = SchemaFactory.createForClass(Session)