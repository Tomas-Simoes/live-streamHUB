import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AutofocusDirective } from './components/directives/autofocus.directive';
import { EditorComponent } from './components/editor.component';
import { GroupEditorComponent } from './components/layer-editors/group-editor.component';
import { ImageEditorComponent } from './components/layer-editors/image-editor.component';
import { StatEditorComponent } from './components/layer-editors/stat-editor.component';
import { TextEditorComponent } from './components/layer-editors/text-editor.component';
import { VideoEditorComponent } from './components/layer-editors/video-editor.component';
import { GroupLoaderComponent } from './components/layer-loaders/group-loader.component';
import { ImageLoaderComponent } from './components/layer-loaders/image-loader.component';
import { KillsLoaderComponent } from './components/layer-loaders/kills-loader.component';
import { TextLoaderComponent } from './components/layer-loaders/text-loader.component';
import { TowersLoaderComponent } from './components/layer-loaders/towers-loader.component';
import { VideoLoaderComponent } from './components/layer-loaders/video-loader.component';

@NgModule({
  declarations: [
    EditorComponent,
    AutofocusDirective,
    TextEditorComponent,
    ImageEditorComponent,
    VideoEditorComponent,
    StatEditorComponent,
    GroupEditorComponent,
    TextLoaderComponent,
    ImageLoaderComponent,
    VideoLoaderComponent,
    KillsLoaderComponent,
    TowersLoaderComponent,
    GroupLoaderComponent,
  ],
  imports: [RouterModule],
  exports: [EditorComponent],
})
export class EditorModule { }
