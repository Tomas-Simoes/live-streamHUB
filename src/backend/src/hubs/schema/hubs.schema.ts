import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import mongoose from "mongoose";
import { User } from "src/users/schema/users.schema";

@Schema()
export class HubIMG {
    @Prop({ required: true })
    imgUrl: string

    @Prop({ type: Object, required: true })
    position: {
        x: number,
        y: number
    }
}
export const HubIMGSchema = SchemaFactory.createForClass(HubIMG)

@Schema()
export class HubFeature {
    @Prop({ required: true })
    featureName: string

    @Prop({ type: Object, required: true })
    position: {
        x: number,
        y: number
    }
}
export const HUBFeatureSchema = SchemaFactory.createForClass(HubFeature)

@Schema()
export class Hub {
    @Prop({ required: true })
    hubName: string;

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
    user: User

    @Prop({ type: [HubIMGSchema], required: true })
    img: HubIMG[]

    @Prop({ type: [HUBFeatureSchema], required: true })
    features: HubFeature[]
}

export const HubSchema = SchemaFactory.createForClass(Hub)