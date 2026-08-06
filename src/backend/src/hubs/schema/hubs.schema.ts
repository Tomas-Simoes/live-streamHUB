import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import mongoose from "mongoose";
import { User } from "src/users/schema/users.schema";

@Schema()
export class HubIMG {
    @Prop({ required: true })
    imgUrl: string

    @Prop({ required: true })
    htmlId: string

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
    feature: string

    @Prop({ required: true })
    htmlId: string

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

    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false })
    user: User

    @Prop({ type: [HubIMGSchema], default: [] })
    imgs: HubIMG[]

    @Prop({ type: [HUBFeatureSchema], default: [] })
    features: HubFeature[]

    @Prop({ type: Object, default: null })
    layout: Record<string, any>
}

export const HubSchema = SchemaFactory.createForClass(Hub)
