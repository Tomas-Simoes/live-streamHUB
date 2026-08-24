import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { AutofocusDirective } from './components/directives/autofocus.directive';
import { EditorComponent } from './components/editor.component';
import { GroupEditorComponent } from './components/layer-editors/group-editor.component';
import { ImageEditorComponent } from './components/layer-editors/image-editor.component';
import { StatEditorComponent } from './components/layer-editors/stat-editor.component';
import { TextEditorComponent } from './components/layer-editors/text-editor.component';
import { VideoEditorComponent } from './components/layer-editors/video-editor.component';
import { LayerLoadersModule } from './layer-loaders.module';

@NgModule({
  declarations: [
    EditorComponent,
    AutofocusDirective,
    TextEditorComponent,
    ImageEditorComponent,
    VideoEditorComponent,
    StatEditorComponent,
    GroupEditorComponent,
  ],
  imports: [RouterModule, LayerLoadersModule],
  exports: [EditorComponent],
})
export class EditorModule { }
