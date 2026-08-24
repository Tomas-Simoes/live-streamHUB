import { NgModule } from '@angular/core';

import { GroupLoaderComponent } from './components/layer-loaders/group-loader.component';
import { ImageLoaderComponent } from './components/layer-loaders/image-loader.component';
import { KillsLoaderComponent } from './components/layer-loaders/kills-loader.component';
import { StatLoaderComponent } from './components/layer-loaders/stat-loader.component';
import { TextLoaderComponent } from './components/layer-loaders/text-loader.component';
import { TowersLoaderComponent } from './components/layer-loaders/towers-loader.component';
import { VideoLoaderComponent } from './components/layer-loaders/video-loader.component';

@NgModule({
  declarations: [
    TextLoaderComponent,
    ImageLoaderComponent,
    VideoLoaderComponent,
    KillsLoaderComponent,
    TowersLoaderComponent,
    StatLoaderComponent,
    GroupLoaderComponent,
  ],
  exports: [
    TextLoaderComponent,
    ImageLoaderComponent,
    VideoLoaderComponent,
    KillsLoaderComponent,
    TowersLoaderComponent,
    StatLoaderComponent,
    GroupLoaderComponent,
  ],
})
export class LayerLoadersModule {}
