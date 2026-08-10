import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { User } from 'src/users/schema/users.schema';

export class HubIMG {
  @ApiProperty({
    description: 'Public URL or asset path for the image displayed on the hub.',
    example: 'https://cdn.example.com/assets/team-logo.png',
  })
  imgUrl: string;

  @ApiProperty({
    description:
      'HTML element id used by the editor to identify this image layer.',
    example: 'team-logo-blue',
  })
  htmlId: string;

  @ApiProperty({
    description: 'Canvas position where the image layer should be placed.',
    example: { x: 120, y: 80 },
  })
  position: {
    x: number;
    y: number;
  };
}

export class HubFeature {
  @ApiProperty({
    description: 'Game data binding or feature key rendered by this hub layer.',
    example: 'blueTeam.kills',
  })
  feature: string;

  @ApiProperty({
    description:
      'HTML element id used by the editor to identify this feature layer.',
    example: 'blue-kills-counter',
  })
  htmlId: string;

  @ApiProperty({
    description: 'Canvas position where the feature layer should be placed.',
    example: { x: 960, y: 120 },
  })
  position: {
    x: number;
    y: number;
  };
}

export class Hub {
  @ApiProperty({
    description: 'Unique hub id.',
    example: '66b8fa3b54a0f1c6f9d7a101',
  })
  _id: string;

  id: string;

  @ApiProperty({
    description: 'Human-readable name shown for this hub layout.',
    example: 'League Finals Overlay',
  })
  hubName: string;

  @ApiPropertyOptional({
    description: 'Owner user id for this hub.',
    example: '66b8f9a254a0f1c6f9d7a001',
    type: String,
  })
  user?: User | string | null;

  @ApiProperty({
    description: 'Image layers rendered in the hub.',
    type: () => [HubIMG],
  })
  imgs: HubIMG[];

  @ApiProperty({
    description: 'Dynamic game-data feature layers rendered in the hub.',
    type: () => [HubFeature],
  })
  features: HubFeature[];

  @ApiPropertyOptional({
    description:
      'Free-form editor layout metadata, such as dimensions, layer order, and style configuration.',
    example: {
      id: 'league-finals-overlay',
      width: 1920,
      height: 1080,
      layers: ['team-logo-blue', 'blue-kills-counter'],
    },
    type: 'object',
    additionalProperties: true,
  })
  layout: Record<string, any> | null;
}
