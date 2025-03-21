import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"

@Schema()
export class Hub {
    @Prop({ unique: true, required: true })
    hubName: string;
}

export const HubSchema = SchemaFactory.createForClass(Hub)